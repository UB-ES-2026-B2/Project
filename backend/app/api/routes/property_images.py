"""US 6.2.1: fotos de un anuncio (subida directa a S3, orden, portada y borrado)."""

import logging
import uuid
from typing import Annotated, Literal

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.auth import CurrentUser
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.property import Property
from app.models.property_image import PropertyImage
from app.models.user import User
from app.services.media import MediaStorage, s3_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/properties/{property_id}/images", tags=["property images"])
DbSession = Annotated[Session, Depends(get_db)]
PropertyId = Annotated[int, Path(ge=1, le=2_147_483_647, description="Id del inmueble")]
ImageId = Annotated[int, Path(ge=1, le=2_147_483_647, description="Id de la foto")]

MAX_IMAGES = 20
MAX_SIZE_BYTES = 5 * 1024 * 1024
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
NOT_FOUND = "El inmueble no existe"
FORBIDDEN = "Solo el anunciante puede gestionar las fotos de este anuncio"

OWNER_RESPONSES = {
    401: {"description": "Sin token o token no válido"},
    403: {"description": FORBIDDEN},
    404: {"description": NOT_FOUND},
}


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    position: int


class UploadUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size: int = Field(
        gt=0, le=MAX_SIZE_BYTES, description="Tamaño del fichero en bytes (máx. 5 MB)"
    )


class UploadUrlResponse(BaseModel):
    image: ImageResponse
    upload_url: str
    # Cabeceras que el navegador tiene que enviar en el PUT (la firma incluye Content-Type).
    headers: dict[str, str]


class ReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_ids: list[int] = Field(min_length=1, max_length=MAX_IMAGES)
    cover_id: int | None = Field(default=None, description="Foto de portada; va la primera")


def get_media_storage(settings: Annotated[Settings, Depends(get_settings)]) -> MediaStorage:
    if not settings.media_bucket:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida de fotos no está configurada",
        )
    return s3_storage(settings.media_bucket, settings.aws_region)


Storage = Annotated[MediaStorage, Depends(get_media_storage)]


def owned_property(db: Session, property_id: int, user: User) -> Property:
    property_ = db.get(Property, property_id)
    if property_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    if property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN)
    return property_


def sync_cover(property_: Property) -> None:
    """La foto de la tarjeta del catálogo es siempre la primera de la ficha."""
    property_.image_url = property_.images[0].url if property_.images else None


@router.get("", response_model=list[ImageResponse])
def list_images(property_id: PropertyId, db: DbSession) -> list[PropertyImage]:
    property_ = db.get(Property, property_id)
    if property_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return property_.images


@router.post(
    "/upload-url",
    status_code=status.HTTP_201_CREATED,
    response_model=UploadUrlResponse,
    responses={**OWNER_RESPONSES, 409: {"description": "Máximo de fotos alcanzado"}},
)
def create_upload_url(
    property_id: PropertyId,
    payload: UploadUrlRequest,
    user: CurrentUser,
    db: DbSession,
    storage: Storage,
    settings: Annotated[Settings, Depends(get_settings)],
) -> UploadUrlResponse:
    """Reserva una foto y devuelve la URL prefirmada para subirla directamente a S3."""
    property_ = owned_property(db, property_id, user)
    if len(property_.images) >= MAX_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un anuncio admite como máximo {MAX_IMAGES} fotos",
        )

    relative = f"properties/{property_.id}/{uuid.uuid4().hex}.{EXTENSIONS[payload.content_type]}"
    key = f"{settings.media_key_prefix}{relative}"
    try:
        upload_url = storage.presigned_put(key, payload.content_type)
    except (BotoCoreError, ClientError) as error:
        logger.warning("No se pudo firmar la subida de %s: %s", key, error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida de fotos no está disponible",
        ) from error

    last = db.scalar(
        select(func.max(PropertyImage.position)).where(PropertyImage.property_id == property_.id)
    )
    image = PropertyImage(
        property_id=property_.id,
        url=f"{settings.media_base_url.rstrip('/')}/{relative}",
        s3_key=key,
        position=0 if last is None else last + 1,
    )
    property_.images.append(image)
    db.flush()
    sync_cover(property_)
    db.commit()
    db.refresh(image)
    return UploadUrlResponse(
        image=ImageResponse.model_validate(image),
        upload_url=upload_url,
        headers={"Content-Type": payload.content_type},
    )


@router.put("/reorder", response_model=list[ImageResponse], responses=OWNER_RESPONSES)
def reorder_images(
    property_id: PropertyId, payload: ReorderRequest, user: CurrentUser, db: DbSession
) -> list[PropertyImage]:
    """Guarda el orden de las fotos; `cover_id`, si llega, pasa a ser la primera."""
    property_ = owned_property(db, property_id, user)
    current = {image.id: image for image in property_.images}
    ordered = list(dict.fromkeys(payload.image_ids))
    if payload.cover_id is not None:
        ordered = [payload.cover_id] + [i for i in ordered if i != payload.cover_id]
    if set(ordered) != set(current) or len(ordered) != len(payload.image_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La lista tiene que incluir cada foto del anuncio una sola vez",
        )

    for position, image_id in enumerate(ordered):
        current[image_id].position = position
    db.flush()
    db.refresh(property_, ["images"])
    sync_cover(property_)
    db.commit()
    return property_.images


@router.delete(
    "/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=OWNER_RESPONSES,
)
def delete_image(
    property_id: PropertyId,
    image_id: ImageId,
    user: CurrentUser,
    db: DbSession,
    storage: Storage,
) -> Response:
    property_ = owned_property(db, property_id, user)
    image = next((i for i in property_.images if i.id == image_id), None)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La foto no existe")

    if image.s3_key:
        try:
            storage.delete(image.s3_key)
        except (BotoCoreError, ClientError) as error:
            # La foto deja de verse igualmente; el objeto huérfano no rompe nada.
            logger.warning("No se pudo borrar %s de S3: %s", image.s3_key, error)
    property_.images.remove(image)
    db.flush()
    for position, remaining in enumerate(property_.images):
        remaining.position = position
    sync_cover(property_)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
