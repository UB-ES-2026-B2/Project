"""US 6.1.1: POST /api/v1/properties para publicar un anuncio."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.models.location import Location
from app.models.property import Property
from app.models.user import User

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401

PROPERTIES = "/api/v1/properties"


def make_user(db: Session) -> User:  # noqa: F811
    user = User(email="publisher@example.com", hashed_password=hash_password("clave-segura"))
    db.add(user)
    db.flush()
    return user


def make_area(db: Session) -> tuple[Location, Location]:  # noqa: F811
    city = Location(name="Ciutat Publicació", type="city")
    db.add(city)
    db.flush()
    neighborhood = Location(name="Barri Publicació", type="neighborhood", parent_id=city.id)
    db.add(neighborhood)
    db.flush()
    return city, neighborhood


def auth(user: User) -> dict[str, str]:
    token = create_access_token(user.id, get_settings())
    return {"Authorization": f"Bearer {token}"}


def valid_payload(location_id: int) -> dict:
    return {
        "title": "  Piso luminoso de prueba  ",
        "location_id": location_id,
        "operation_type": "sale",
        "property_type": "flat",
        "description": "Un piso luminoso de prueba.",
        "address": "Carrer de prova 10",
        "price": "275000.50",
        "area": 90,
        "image_url": "https://example.com/property.jpg",
    }


def test_publish_property_returns_201_and_is_listed_for_its_city(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    user = make_user(db)
    city, neighborhood = make_area(db)

    response = client.post(PROPERTIES, json=valid_payload(neighborhood.id), headers=auth(user))

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["owner_id"] == user.id
    assert body["title"] == "Piso luminoso de prueba"
    assert body["location"] == "Barri Publicació, Ciutat Publicació"
    assert body["previous_price"] is None

    stored = db.get(Property, body["id"])
    assert stored is not None
    assert stored.owner_id == user.id
    assert stored.neighborhood_id == neighborhood.id
    assert stored.postal_code_id is None
    assert stored.operation_type == "sale"
    assert stored.property_type == "flat"
    assert stored.description == "Un piso luminoso de prueba."
    assert stored.address == "Carrer de prova 10"
    assert stored.bedrooms == 0
    assert stored.bathrooms == 0

    listed = client.get(PROPERTIES, params={"location_id": city.id, "limit": 50})
    assert listed.status_code == 200
    assert body["id"] in {item["id"] for item in listed.json()["items"]}


def test_publish_property_without_token_is_401(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    _, neighborhood = make_area(db)

    response = client.post(PROPERTIES, json=valid_payload(neighborhood.id))

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "change",
    [
        {"price": 0},
        {"price": -1},
        {"area": 0},
        {"title": None},
        {"operation_type": "purchase"},
        {"property_type": "apartment"},
        {"description": "   "},
        {"address": "abc"},
        {"unexpected": "not allowed"},
    ],
    ids=[
        "zero-price",
        "negative-price",
        "zero-area",
        "missing-title",
        "invalid-operation",
        "invalid-property-type",
        "empty-description",
        "short-address",
        "extra-field",
    ],
)
def test_publish_property_rejects_invalid_payload(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    change: dict,
) -> None:
    user = make_user(db)
    _, neighborhood = make_area(db)
    payload = valid_payload(neighborhood.id)
    if change == {"title": None}:
        payload.pop("title")
    else:
        payload.update(change)

    response = client.post(PROPERTIES, json=payload, headers=auth(user))

    assert response.status_code == 422


def test_publish_property_rejects_unknown_location(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    user = make_user(db)

    response = client.post(PROPERTIES, json=valid_payload(2_000_000_000), headers=auth(user))

    assert response.status_code == 422
    assert response.json() == {"detail": "La ubicación indicada no existe"}
