import logging
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, computed_field
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.api.routes.auth import CurrentUser
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.location import Location
from app.models.property import Property
from app.models.user import User
from app.services.media import s3_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/properties", tags=["properties"])
DbSession = Annotated[Session, Depends(get_db)]

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Price = Annotated[Decimal, Field(gt=0, le=Decimal("99999999.99"))]
ImageUrl = Annotated[HttpUrl, Field(max_length=500)]
PropertyDescription = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)
]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=160)]

CREATE_RESPONSES = {
    201: {"description": "Anuncio publicado"},
    401: {"description": "Sin token o token no válido"},
    422: {"description": "Datos del anuncio o ubicación no válidos"},
}


OperationType = Literal["sale", "rent"]
SortOrder = Literal["newest", "price_asc", "price_desc", "area_asc", "area_desc"]
PropertyType = Literal["flat", "house", "local", "office", "garage", "storage"]


class PropertyCreate(BaseModel):
    """Datos necesarios para publicar un anuncio inmobiliario."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    location_id: int = Field(ge=1)
    operation_type: OperationType
    property_type: PropertyType
    description: PropertyDescription
    address: Address
    price: Price
    bedrooms: int = Field(default=0, ge=0, le=50)
    bathrooms: int = Field(default=0, ge=0, le=50)
    area: int = Field(ge=1, le=100_000)
    image_url: ImageUrl | None = None


class PropertyResponse(BaseModel):
    """Datos de una tarjeta de catálogo, incluidos los valores calculados."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int | None = None
    title: str
    location: str
    price: float
    previous_price: float | None
    bedrooms: int
    bathrooms: int
    area: int
    image_url: str | None
    is_active: bool = True

    @computed_field
    @property
    def price_per_m2(self) -> float:
        return round(self.price / self.area, 2)

    @computed_field
    @property
    def has_price_drop(self) -> bool:
        return self.previous_price is not None and self.previous_price > self.price


class PropertyDetailResponse(PropertyResponse):
    """Ficha completa del inmueble (US 5.1.1)."""

    operation_type: str | None
    property_type: str | None
    description: str | None
    address: str | None
    created_at: datetime
    images: list[str]


DETAIL_RESPONSES = {404: {"description": "El inmueble no existe"}}


def image_urls(property_: Property) -> list[str]:
    """Fotos en orden (la primera es la portada); si no hay, la imagen de la tarjeta."""
    urls = [image.url for image in property_.images]
    if not urls and property_.image_url:
        urls = [property_.image_url]
    return urls


class PaginatedProperties(BaseModel):
    items: list[PropertyResponse]
    page: int
    limit: int
    total: int


SORT_COLUMNS = {
    "newest": (Property.created_at.desc(),),
    "price_asc": (Property.price.asc(),),
    "price_desc": (Property.price.desc(),),
    "area_asc": (Property.area.asc(),),
    "area_desc": (Property.area.desc(),),
}


def in_location(location_id: int) -> ColumnElement[bool]:
    # una ciudad abarca sus barrios y codigos postales, un barrio o un cp solo a si mismo
    area = select(Location.id).where(
        or_(Location.id == location_id, Location.parent_id == location_id)
    )
    return or_(Property.neighborhood_id.in_(area), Property.postal_code_id.in_(area))


def location_values(db: Session, location: Location) -> tuple[str, int | None, int | None]:
    """Convierte una ubicación seleccionada en los campos que usa el catálogo."""
    parent = db.get(Location, location.parent_id) if location.parent_id is not None else None
    location_text = f"{location.name}, {parent.name}" if parent is not None else location.name

    if location.type == "postal_code":
        return location_text, None, location.id
    # El filtro trata la ciudad como parte del área; se guarda en neighborhood_id
    # porque el modelo actual no tiene city_id (y US 6.1.1 no añade esa columna).
    return location_text, location.id, None


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=PropertyResponse,
    responses=CREATE_RESPONSES,
)
def create_property(payload: PropertyCreate, user: CurrentUser, db: DbSession) -> Property:
    """Publica un inmueble asociado al usuario autenticado."""
    selected_location = db.get(Location, payload.location_id)
    if selected_location is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La ubicación indicada no existe",
        )

    location_text, neighborhood_id, postal_code_id = location_values(db, selected_location)
    property_ = Property(
        operation_type=payload.operation_type,
        property_type=payload.property_type,
        description=payload.description,
        address=payload.address,
        title=payload.title,
        location=location_text,
        price=payload.price,
        previous_price=None,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        area=payload.area,
        image_url=str(payload.image_url) if payload.image_url is not None else None,
        neighborhood_id=neighborhood_id,
        postal_code_id=postal_code_id,
        owner_id=user.id,
    )
    db.add(property_)
    db.commit()
    db.refresh(property_)
    return property_


@router.get("", response_model=PaginatedProperties)
def list_properties(
    db: DbSession,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
    location_id: int | None = Query(
        default=None,
        ge=1,
        le=2_147_483_647,
        description="Id de una sugerencia de GET /api/v1/locations/suggest",
    ),
    operation_type: Annotated[
        OperationType | None, Query(description="Compra (`sale`) o alquiler (`rent`)")
    ] = None,
    property_types: Annotated[
        list[PropertyType] | None,
        Query(description="Tipologías; se repite: `?property_types=flat&property_types=office`"),
    ] = None,
    sort: Annotated[
        SortOrder,
        Query(description="Orden: más recientes, precio o superficie (US 1.6)"),
    ] = "newest",
) -> PaginatedProperties:
    query = select(Property).where(Property.is_active.is_(True))
    if location_id is not None:
        query = query.where(in_location(location_id))
    if operation_type is not None:
        query = query.where(Property.operation_type == operation_type)
    if property_types:
        query = query.where(Property.property_type.in_(set(property_types)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    properties = db.scalars(
        query.order_by(*SORT_COLUMNS[sort], Property.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return PaginatedProperties(items=properties, page=page, limit=limit, total=total)


FORBIDDEN = "Solo el anunciante puede modificar este anuncio"
OWNER_RESPONSES = {
    401: {"description": "Sin token o token no válido"},
    403: {"description": FORBIDDEN},
    404: {"description": "El inmueble no existe"},
}
PathPropertyId = Annotated[int, Path(ge=1, le=2_147_483_647)]


class PropertyUpdate(BaseModel):
    """Campos que el anunciante puede cambiar; solo se actualizan los que llegan (US 6.3.1)."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    operation_type: OperationType | None = None
    property_type: PropertyType | None = None
    description: PropertyDescription | None = None
    address: Address | None = None
    price: Price | None = None
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    bathrooms: int | None = Field(default=None, ge=0, le=50)
    area: int | None = Field(default=None, ge=1, le=100_000)


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class MyProperties(BaseModel):
    items: list[PropertyResponse]


def owned_property(db: Session, property_id: int, user: User) -> Property:
    property_ = db.get(Property, property_id)
    if property_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El inmueble no existe")
    if property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN)
    return property_


def apply_price(property_: Property, new_price: Decimal) -> None:
    """Una bajada guarda el precio anterior para la etiqueta de rebaja (US 1.1)."""
    current = Decimal(property_.price)
    if new_price < current:
        if property_.previous_price is None or Decimal(property_.previous_price) < current:
            property_.previous_price = current
    elif property_.previous_price is not None and new_price >= Decimal(property_.previous_price):
        property_.previous_price = None
    property_.price = new_price


@router.get("/mine", response_model=MyProperties, responses={401: OWNER_RESPONSES[401]})
def list_my_properties(user: CurrentUser, db: DbSession) -> MyProperties:
    """Anuncios del usuario, activos y desactivados, del más reciente al más antiguo."""
    properties = db.scalars(
        select(Property)
        .where(Property.owner_id == user.id)
        .order_by(Property.created_at.desc(), Property.id.desc())
    ).all()
    return MyProperties(items=[PropertyResponse.model_validate(p) for p in properties])


@router.patch("/{property_id}", response_model=PropertyResponse, responses=OWNER_RESPONSES)
def update_property(
    property_id: PathPropertyId, payload: PropertyUpdate, user: CurrentUser, db: DbSession
) -> Property:
    property_ = owned_property(db, property_id, user)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    new_price = changes.pop("price", None)
    for field, value in changes.items():
        setattr(property_, field, value)
    if new_price is not None:
        apply_price(property_, new_price)
    db.commit()
    db.refresh(property_)
    return property_


@router.patch("/{property_id}/status", response_model=PropertyResponse, responses=OWNER_RESPONSES)
def update_status(
    property_id: PathPropertyId, payload: StatusUpdate, user: CurrentUser, db: DbSession
) -> Property:
    """Activa o desactiva el anuncio. Desactivado, deja de salir en el catálogo."""
    property_ = owned_property(db, property_id, user)
    property_.is_active = payload.is_active
    db.commit()
    db.refresh(property_)
    return property_


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=OWNER_RESPONSES,
)
def delete_property(
    property_id: PathPropertyId,
    user: CurrentUser,
    db: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    """Borra el anuncio, sus fotos y los favoritos que lo apuntaban."""
    property_ = owned_property(db, property_id, user)
    keys = [image.s3_key for image in property_.images if image.s3_key]
    db.delete(property_)
    db.commit()
    if keys and settings.media_bucket:
        storage = s3_storage(settings.media_bucket, settings.aws_region)
        for key in keys:
            try:
                storage.delete(key)
            except (BotoCoreError, ClientError) as error:
                logger.warning("No se pudo borrar %s de S3: %s", key, error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{property_id}", response_model=PropertyDetailResponse, responses=DETAIL_RESPONSES)
def get_property(
    db: DbSession,
    property_id: Annotated[int, Path(ge=1, le=2_147_483_647)],
) -> PropertyDetailResponse:
    """Ficha del inmueble. Un anuncio desactivado se devuelve con `is_active: false`."""
    property_ = db.get(Property, property_id)
    if property_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El inmueble no existe")
    base = PropertyResponse.model_validate(property_).model_dump(
        exclude={"price_per_m2", "has_price_drop"}
    )
    return PropertyDetailResponse(
        **base,
        operation_type=property_.operation_type,
        property_type=property_.property_type,
        description=property_.description,
        address=property_.address,
        created_at=property_.created_at,
        images=image_urls(property_),
    )
