"""US 1.6: ordenación del catálogo con el parámetro sort."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.property import Property

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401

PROPERTIES = "/api/v1/properties"


@pytest.fixture
def catalog(db: Session) -> list[str]:  # noqa: F811
    now = datetime.now(UTC)
    rows = [
        ("orden-a", 300000, 90, now - timedelta(days=2)),
        ("orden-b", 150000, 120, now),
        ("orden-c", 450000, 60, now - timedelta(days=1)),
    ]
    for title, price, area, created in rows:
        db.add(
            Property(
                title=title,
                location="Sort",
                price=price,
                bedrooms=1,
                bathrooms=1,
                area=area,
                created_at=created,
                operation_type="sale",
                property_type="local",
            )
        )
    db.flush()
    return [title for title, *_ in rows]


def order(client: TestClient, sort: str | None, catalog: list[str]) -> list[str]:  # noqa: F811
    params = {"limit": 50, "operation_type": "sale", "property_types": "local"}
    if sort:
        params["sort"] = sort
    items = client.get(PROPERTIES, params=params).json()["items"]
    return [item["title"] for item in items if item["title"] in catalog]


@pytest.mark.parametrize(
    "sort,expected",
    [
        (None, ["orden-b", "orden-c", "orden-a"]),
        ("newest", ["orden-b", "orden-c", "orden-a"]),
        ("price_asc", ["orden-b", "orden-a", "orden-c"]),
        ("price_desc", ["orden-c", "orden-a", "orden-b"]),
        ("area_asc", ["orden-c", "orden-a", "orden-b"]),
        ("area_desc", ["orden-b", "orden-a", "orden-c"]),
    ],
)
def test_sort_orders(
    client: TestClient,  # noqa: F811
    catalog: list[str],
    sort: str | None,
    expected: list[str],
) -> None:
    assert order(client, sort, catalog) == expected


def test_unknown_sort_is_422(client: TestClient) -> None:  # noqa: F811
    assert client.get(PROPERTIES, params={"sort": "cheapest"}).status_code == 422
