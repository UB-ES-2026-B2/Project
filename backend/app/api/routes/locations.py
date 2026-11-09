"""US 1.3.1: autocompletado de ubicaciones del buscador."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import String, case, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.location import Location

router = APIRouter(prefix="/v1/locations", tags=["locations"])
DbSession = Annotated[Session, Depends(get_db)]

MIN_QUERY_LENGTH = 3
MAX_SUGGESTIONS = 10


class LocationSuggestion(BaseModel):
    id: str
    name: str
    type: Literal["city", "neighborhood", "postal_code"]


def escape_like(value: str) -> str:
    # lo que escribe el usuario se busca tal cual, sin comodines de like
    for char in ("/", "%", "_"):
        value = value.replace(char, f"/{char}")
    return value


@router.get("/suggest", response_model=list[LocationSuggestion])
def suggest_locations(
    db: DbSession,
    q: str = Query(max_length=100, description="Texto que escribe el usuario"),
) -> list[LocationSuggestion]:
    """Hasta 10 ubicaciones que contienen `q`, primero las que empiezan por `q`.

    Con menos de 3 caracteres devuelve una lista vacía: el buscador llama mientras se escribe.
    """
    text = q.strip()
    if len(text) < MIN_QUERY_LENGTH:
        return []

    # misma expresion que el indice ix_locations_name_trgm, si cambia postgres no lo usa
    name = func.f_unaccent(func.lower(Location.name), type_=String)
    term = func.f_unaccent(func.lower(escape_like(text)), type_=String)
    starts_with_q = case((name.like(term + "%", escape="/"), 0), else_=1)

    locations = db.scalars(
        select(Location)
        .where(name.like("%" + term + "%", escape="/"))
        .order_by(starts_with_q, func.length(Location.name), Location.name)
        .limit(MAX_SUGGESTIONS)
    ).all()
    return [
        LocationSuggestion(id=str(location.id), name=location.name, type=location.type)
        for location in locations
    ]
