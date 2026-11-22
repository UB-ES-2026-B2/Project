"""US 1.5.1: filtros de precio, habitaciones y superficie en GET /api/v1/properties."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.property import Property

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401

PROPERTIES = "/api/v1/properties"


@pytest.fixture
def catalog(db: Session) -> set[str]:  # noqa: F811
    rows = [
        ("num-estudio", 90000, 0, 35),
        ("num-piso", 250000, 2, 80),
        ("num-familiar", 400000, 4, 140),
        ("num-casa", 800000, 5, 300),
    ]
    for title, price, rooms, area in rows:
        db.add(
            Property(
                title=title,
                location="Num",
                price=price,
                bedrooms=rooms,
                bathrooms=1,
                area=area,
                property_type="storage",
            )
        )
    db.flush()
    return {title for title, *_ in rows}


def found(client: TestClient, catalog: set[str], **params) -> set[str]:  # noqa: F811
    response = client.get(PROPERTIES, params={"limit": 50, "property_types": "storage", **params})
    assert response.status_code == 200
    return {item["title"] for item in response.json()["items"]} & catalog


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"min_price": 200000}, {"num-piso", "num-familiar", "num-casa"}),
        ({"max_price": 250000}, {"num-estudio", "num-piso"}),
        ({"min_price": 100000, "max_price": 500000}, {"num-piso", "num-familiar"}),
        ({"min_rooms": 4}, {"num-familiar", "num-casa"}),
        ({"min_surface": 80, "max_surface": 140}, {"num-piso", "num-familiar"}),
        ({"min_price": 0, "min_rooms": 0}, {"num-estudio", "num-piso", "num-familiar", "num-casa"}),
    ],
)
def test_numeric_filters(
    client: TestClient,  # noqa: F811
    catalog: set[str],
    params: dict,
    expected: set[str],
) -> None:
    assert found(client, catalog, **params) == expected


@pytest.mark.parametrize(
    "params,detail",
    [
        ({"min_price": 500000, "max_price": 100000}, "El precio mínimo no puede ser mayor"),
        ({"min_surface": 200, "max_surface": 50}, "La superficie mínima no puede ser mayor"),
    ],
)
def test_inverted_ranges_are_422(client: TestClient, params: dict, detail: str) -> None:  # noqa: F811
    response = client.get(PROPERTIES, params=params)

    assert response.status_code == 422
    assert response.json()["detail"].startswith(detail)


@pytest.mark.parametrize("params", [{"min_price": -1}, {"min_rooms": 51}, {"max_surface": "mucho"}])
def test_invalid_values_are_422(client: TestClient, params: dict) -> None:  # noqa: F811
    assert client.get(PROPERTIES, params=params).status_code == 422
