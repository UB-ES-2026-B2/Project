"""US 5.1.1: GET /api/v1/properties/{id} (ficha del inmueble)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.property_image import PropertyImage

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401

PROPERTIES = "/api/v1/properties"


def make_property(db: Session, **extra) -> Property:  # noqa: F811
    values = {
        "title": "Ático con terraza",
        "location": "Gràcia, Barcelona",
        "price": 420000,
        "previous_price": 450000,
        "bedrooms": 3,
        "bathrooms": 2,
        "area": 110,
        "operation_type": "sale",
        "property_type": "flat",
        "description": "Ático muy luminoso con terraza de 30 m2.",
        "address": "Carrer de Verdi 12",
        "image_url": "https://example.com/portada.jpg",
    } | extra
    property_ = Property(**values)
    db.add(property_)
    db.flush()
    return property_


def test_detail_returns_every_field_and_photos_in_order(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    property_ = make_property(db)
    db.add_all(
        [
            PropertyImage(property_id=property_.id, url="https://example.com/2.jpg", position=1),
            PropertyImage(property_id=property_.id, url="https://example.com/1.jpg", position=0),
            PropertyImage(property_id=property_.id, url="https://example.com/3.jpg", position=2),
        ]
    )
    db.flush()

    response = client.get(f"{PROPERTIES}/{property_.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == property_.id
    assert body["title"] == "Ático con terraza"
    assert body["description"] == "Ático muy luminoso con terraza de 30 m2."
    assert body["address"] == "Carrer de Verdi 12"
    assert (body["operation_type"], body["property_type"]) == ("sale", "flat")
    assert body["price"] == 420000
    assert body["has_price_drop"] is True
    assert body["price_per_m2"] == round(420000 / 110, 2)
    assert body["is_active"] is True
    assert body["created_at"]
    assert body["images"] == [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
    ]


def test_detail_without_photos_falls_back_to_card_image(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    with_image = make_property(db)
    without_image = make_property(db, image_url=None)

    assert client.get(f"{PROPERTIES}/{with_image.id}").json()["images"] == [
        "https://example.com/portada.jpg"
    ]
    assert client.get(f"{PROPERTIES}/{without_image.id}").json()["images"] == []


def test_inactive_property_keeps_its_detail_but_leaves_the_catalog(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    inactive = make_property(db, title="Piso retirado", is_active=False)
    active = make_property(db, title="Piso disponible")

    detail = client.get(f"{PROPERTIES}/{inactive.id}")
    catalog_ids = [
        item["id"] for item in client.get(PROPERTIES, params={"limit": 50}).json()["items"]
    ]

    assert detail.status_code == 200
    assert detail.json()["is_active"] is False
    assert inactive.id not in catalog_ids
    assert active.id in catalog_ids


def test_unknown_property_is_404(client: TestClient) -> None:  # noqa: F811
    response = client.get(f"{PROPERTIES}/999999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "El inmueble no existe"}


def test_invalid_id_is_422(client: TestClient) -> None:  # noqa: F811
    assert client.get(f"{PROPERTIES}/0").status_code == 422
    assert client.get(f"{PROPERTIES}/abc").status_code == 422


def test_deleting_a_property_deletes_its_photos(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    property_ = make_property(db)
    db.add(PropertyImage(property_id=property_.id, url="https://example.com/x.jpg"))
    db.flush()

    db.delete(property_)
    db.flush()

    assert db.query(PropertyImage).count() == 0
