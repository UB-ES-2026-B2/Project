import asyncio
from collections.abc import Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.main import app
from app.models.property import Base, Property

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base.metadata.create_all(engine)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


async def get(path: str):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


@pytest.fixture(autouse=True)
def clear_properties() -> Generator[None, None, None]:
    with TestingSession() as db:
        db.query(Property).delete()
        db.commit()
    yield


def test_list_properties_is_paginated() -> None:
    with TestingSession() as db:
        db.add_all(
            [
                Property(
                    title="Piso de prueba",
                    location="Barcelona",
                    price=300000,
                    previous_price=320000,
                    bedrooms=2,
                    bathrooms=1,
                    area=75,
                ),
                Property(
                    title="Ático de prueba",
                    location="Barcelona",
                    price=450000,
                    bedrooms=3,
                    bathrooms=2,
                    area=90,
                ),
            ]
        )
        db.commit()

    response = asyncio.run(get("/api/v1/properties?page=1&limit=2"))

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["limit"] == 2
    assert body["total"] == 2
    assert len(body["items"]) == 2
    property_with_drop = next(item for item in body["items"] if item["title"] == "Piso de prueba")
    assert property_with_drop["price_per_m2"] == 4000.0
    assert property_with_drop["has_price_drop"] is True


@pytest.mark.parametrize(
    "path",
    ["/api/v1/properties?page=0", "/api/v1/properties?limit=51", "/api/v1/properties?page=one"],
)
def test_list_properties_rejects_invalid_pagination(path: str) -> None:
    response = asyncio.run(get(path))

    assert response.status_code == 422
