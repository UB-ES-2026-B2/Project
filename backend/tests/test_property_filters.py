"""US 1.4.1: filtros operation_type y property_types en GET /api/v1/properties."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.property import Property

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401

PROPERTIES = "/api/v1/properties"


@pytest.fixture
def catalog(db: Session) -> dict[str, int]:  # noqa: F811
    rows = {
        "piso-venta": ("sale", "flat"),
        "piso-alquiler": ("rent", "flat"),
        "casa-venta": ("sale", "house"),
        "oficina-alquiler": ("rent", "office"),
        "garaje-venta": ("sale", "garage"),
        "sin-datos": (None, None),
    }
    ids = {}
    for title, (operation, kind) in rows.items():
        property_ = Property(
            title=title,
            location="Barcelona",
            price=100000,
            bedrooms=1,
            bathrooms=1,
            area=50,
            operation_type=operation,
            property_type=kind,
        )
        db.add(property_)
        db.flush()
        ids[title] = property_.id
    return ids


def titles(client: TestClient, params: list[tuple[str, str]]) -> set[str]:  # noqa: F811
    response = client.get(PROPERTIES, params=[("limit", "50"), *params])
    assert response.status_code == 200
    return {item["title"] for item in response.json()["items"]}


def test_without_filters_lists_everything(client: TestClient, catalog: dict) -> None:  # noqa: F811
    assert set(catalog) <= titles(client, [])


def test_filter_by_operation(client: TestClient, catalog: dict) -> None:  # noqa: F811
    found = titles(client, [("operation_type", "rent")]) & set(catalog)

    assert found == {"piso-alquiler", "oficina-alquiler"}


def test_filter_by_several_property_types(client: TestClient, catalog: dict) -> None:  # noqa: F811
    found = titles(client, [("property_types", "flat"), ("property_types", "office")]) & set(
        catalog
    )

    assert found == {"piso-venta", "piso-alquiler", "oficina-alquiler"}


def test_operation_and_types_combine(client: TestClient, catalog: dict) -> None:  # noqa: F811
    params = [("operation_type", "sale"), ("property_types", "flat"), ("property_types", "house")]

    assert titles(client, params) & set(catalog) == {"piso-venta", "casa-venta"}


def test_total_counts_only_filtered_rows(client: TestClient, catalog: dict) -> None:  # noqa: F811
    response = client.get(PROPERTIES, params={"operation_type": "sale", "property_types": "garage"})

    body = response.json()
    assert body["total"] == len(body["items"])
    assert {item["title"] for item in body["items"]} & set(catalog) == {"garaje-venta"}


@pytest.mark.parametrize(
    "params",
    [{"operation_type": "swap"}, {"property_types": "castle"}],
    ids=["bad-operation", "bad-type"],
)
def test_unknown_values_are_422(client: TestClient, params: dict) -> None:  # noqa: F811
    assert client.get(PROPERTIES, params=params).status_code == 422
