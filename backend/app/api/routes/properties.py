from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, computed_field
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.location import Location
from app.models.property import Property

router = APIRouter(prefix="/v1/properties", tags=["properties"])
DbSession = Annotated[Session, Depends(get_db)]


class PropertyResponse(BaseModel):
    """Datos de una tarjeta de catálogo, incluidos los valores calculados."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    location: str
    price: float
    previous_price: float | None
    bedrooms: int
    bathrooms: int
    area: int
    image_url: str | None

    @computed_field
    @property
    def price_per_m2(self) -> float:
        return round(self.price / self.area, 2)

    @computed_field
    @property
    def has_price_drop(self) -> bool:
        return self.previous_price is not None and self.previous_price > self.price


class PaginatedProperties(BaseModel):
    items: list[PropertyResponse]
    page: int
    limit: int
    total: int


def in_location(location_id: int) -> ColumnElement[bool]:
    # una ciudad abarca sus barrios y codigos postales, un barrio o un cp solo a si mismo
    area = select(Location.id).where(
        or_(Location.id == location_id, Location.parent_id == location_id)
    )
    return or_(Property.neighborhood_id.in_(area), Property.postal_code_id.in_(area))


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
) -> PaginatedProperties:
    query = select(Property)
    if location_id is not None:
        query = query.where(in_location(location_id))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    properties = db.scalars(
        query.order_by(Property.created_at.desc(), Property.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return PaginatedProperties(items=properties, page=page, limit=limit, total=total)
