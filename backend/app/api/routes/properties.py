from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, computed_field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
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


@router.get("", response_model=PaginatedProperties)
def list_properties(
    db: DbSession,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
) -> PaginatedProperties:
    total = db.scalar(select(func.count()).select_from(Property)) or 0
    properties = db.scalars(
        select(Property)
        .order_by(Property.created_at.desc(), Property.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return PaginatedProperties(items=properties, page=page, limit=limit, total=total)
