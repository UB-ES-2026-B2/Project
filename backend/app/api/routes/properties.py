from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, computed_field
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.api.routes.auth import CurrentUser
from app.db.session import get_db
from app.models.location import Location
from app.models.property import Property

router = APIRouter(prefix="/v1/properties", tags=["properties"])
DbSession = Annotated[Session, Depends(get_db)]

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Price = Annotated[Decimal, Field(gt=0, le=Decimal("99999999.99"))]
ImageUrl = Annotated[HttpUrl, Field(max_length=500)]

CREATE_RESPONSES = {
    201: {"description": "Anuncio publicado"},
    401: {"description": "Sin token o token no válido"},
    422: {"description": "Datos del anuncio o ubicación no válidos"},
}


class PropertyCreate(BaseModel):
    """Datos necesarios para publicar un anuncio inmobiliario."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    location_id: int = Field(ge=1)
    price: Price
    bedrooms: int = Field(ge=0, le=50)
    bathrooms: int = Field(ge=0, le=50)
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
