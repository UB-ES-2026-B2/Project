"""US 1.2.1: guardar y quitar inmuebles favoritos del usuario autenticado."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.routes.auth import CurrentUser
from app.db.session import get_db
from app.models.favorite import Favorite
from app.models.property import Property

router = APIRouter(prefix="/v1/favorites", tags=["favorites"])
DbSession = Annotated[Session, Depends(get_db)]
PropertyId = Annotated[int, Path(ge=1, le=2_147_483_647, description="Id del inmueble")]

NOT_FOUND = "El inmueble no existe"
AUTH_RESPONSES = {
    401: {"description": "Sin token o token no válido"},
    404: {"description": NOT_FOUND},
}


class FavoriteIds(BaseModel):
    property_ids: list[int]


def ensure_property_exists(db: Session, property_id: int) -> None:
    if db.get(Property, property_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)


@router.get("", response_model=FavoriteIds, responses={401: AUTH_RESPONSES[401]})
def list_favorites(user: CurrentUser, db: DbSession) -> FavoriteIds:
    """Ids de los inmuebles favoritos del usuario, del más reciente al más antiguo."""
    ids = db.scalars(
        select(Favorite.property_id)
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc(), Favorite.property_id.desc())
    ).all()
    return FavoriteIds(property_ids=list(ids))


@router.post(
    "/{property_id}",
    status_code=status.HTTP_201_CREATED,
    response_class=Response,
    responses={**AUTH_RESPONSES, 201: {"description": "Guardado en favoritos"}},
)
def add_favorite(property_id: PropertyId, user: CurrentUser, db: DbSession) -> Response:
    ensure_property_exists(db, property_id)
    # Idempotente: pulsar dos veces (o dos pestañas a la vez) no duplica ni da error.
    db.execute(
        insert(Favorite)
        .values(user_id=user.id, property_id=property_id)
        .on_conflict_do_nothing(index_elements=["user_id", "property_id"])
    )
    db.commit()
    return Response(status_code=status.HTTP_201_CREATED)


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses={**AUTH_RESPONSES, 204: {"description": "Quitado de favoritos"}},
)
def remove_favorite(property_id: PropertyId, user: CurrentUser, db: DbSession) -> Response:
    ensure_property_exists(db, property_id)
    favorite = db.get(Favorite, (user.id, property_id))
    # Idempotente: quitar uno que no estaba guardado también responde 204.
    if favorite is not None:
        db.delete(favorite)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
