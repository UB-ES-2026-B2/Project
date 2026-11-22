"""US 6.3.1: el anunciante lista, edita, desactiva y borra sus anuncios."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.favorite import Favorite
from app.models.property import Property
from app.models.property_image import PropertyImage
from app.services import media

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401
from tests.test_favorites import auth, make_user

PROPERTIES = "/api/v1/properties"


@pytest.fixture
def owner(db: Session):  # noqa: F811
    return make_user(db, "anunciante@example.com")


@pytest.fixture
def stranger(db: Session):  # noqa: F811
    return make_user(db, "otra@example.com")


def make_listing(db: Session, owner, title: str = "Piso en venta", **extra) -> Property:  # noqa: F811
    values = {
        "title": title,
        "location": "Barcelona",
        "price": Decimal("300000"),
        "bedrooms": 2,
        "bathrooms": 1,
        "area": 80,
        "owner_id": owner.id,
    } | extra
    property_ = Property(**values)
    db.add(property_)
    db.flush()
    return property_


def test_mine_lists_own_listings_including_inactive(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
    stranger,
) -> None:
    make_listing(db, owner, "Activo")
    make_listing(db, owner, "Desactivado", is_active=False)
    make_listing(db, stranger, "Ajeno")

    response = client.get(f"{PROPERTIES}/mine", headers=auth(owner))

    assert response.status_code == 200
    items = {item["title"]: item["is_active"] for item in response.json()["items"]}
    assert items == {"Activo": True, "Desactivado": False}
    assert client.get(f"{PROPERTIES}/mine").status_code == 401


def test_patch_updates_only_the_fields_sent(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
) -> None:
    listing = make_listing(db, owner, description="Antes")

    response = client.patch(
        f"{PROPERTIES}/{listing.id}",
        json={"title": "  Piso reformado  ", "area": 85},
        headers=auth(owner),
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["title"], body["area"], body["bedrooms"]) == ("Piso reformado", 85, 2)
    db.refresh(listing)
    assert listing.description == "Antes"


def test_price_drop_keeps_the_previous_price_and_a_rise_clears_it(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
) -> None:
    listing = make_listing(db, owner)
    url = f"{PROPERTIES}/{listing.id}"

    dropped = client.patch(url, json={"price": "280000"}, headers=auth(owner)).json()
    dropped_again = client.patch(url, json={"price": "270000"}, headers=auth(owner)).json()
    raised = client.patch(url, json={"price": "310000"}, headers=auth(owner)).json()

    assert (dropped["previous_price"], dropped["has_price_drop"]) == (300000, True)
    assert dropped_again["previous_price"] == 300000
    assert (raised["previous_price"], raised["has_price_drop"]) == (None, False)


@pytest.mark.parametrize(
    "payload",
    [{"price": "-5"}, {"title": "abc"}, {"owner_id": 1}, {"property_type": "castle"}],
    ids=["negative-price", "short-title", "unknown-field", "bad-type"],
)
def test_patch_validates_the_payload(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
    payload: dict,
) -> None:
    listing = make_listing(db, owner)

    assert (
        client.patch(f"{PROPERTIES}/{listing.id}", json=payload, headers=auth(owner)).status_code
        == 422
    )


def test_status_toggle_hides_and_shows_the_listing(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
) -> None:
    listing = make_listing(db, owner, "Piso conmutado")
    url = f"{PROPERTIES}/{listing.id}/status"

    def in_catalog() -> bool:
        items = client.get(PROPERTIES, params={"limit": 50}).json()["items"]
        return listing.id in {item["id"] for item in items}

    off = client.patch(url, json={"is_active": False}, headers=auth(owner))
    hidden = not in_catalog()
    on = client.patch(url, json={"is_active": True}, headers=auth(owner))

    assert (off.status_code, off.json()["is_active"]) == (200, False)
    assert hidden
    assert on.json()["is_active"] is True
    assert in_catalog()


def test_delete_removes_listing_photos_and_favorites(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
    stranger,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deleted: list[str] = []

    class FakeStorage:
        def delete(self, key: str) -> None:
            deleted.append(key)

    monkeypatch.setattr(
        "app.api.routes.properties.s3_storage", lambda bucket, region: FakeStorage()
    )
    monkeypatch.setenv("MEDIA_BUCKET", "bucket-de-prueba")
    get_settings.cache_clear()
    listing = make_listing(db, owner)
    db.add_all(
        [
            PropertyImage(property_id=listing.id, url="/media/a.jpg", s3_key="media/a.jpg"),
            PropertyImage(property_id=listing.id, url="https://ext.example.com/b.jpg"),
            Favorite(user_id=stranger.id, property_id=listing.id),
        ]
    )
    db.flush()
    listing_id = listing.id

    response = client.delete(f"{PROPERTIES}/{listing_id}", headers=auth(owner))

    assert response.status_code == 204
    db.expire_all()
    assert db.get(Property, listing_id) is None
    assert db.query(PropertyImage).filter_by(property_id=listing_id).count() == 0
    assert db.query(Favorite).filter_by(property_id=listing_id).count() == 0
    assert deleted == ["media/a.jpg"]
    assert client.get(f"{PROPERTIES}/{listing_id}").status_code == 404


def test_only_the_owner_can_change_a_listing(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    owner,
    stranger,
) -> None:
    listing = make_listing(db, owner)
    url = f"{PROPERTIES}/{listing.id}"

    assert client.patch(url, json={"area": 90}, headers=auth(stranger)).status_code == 403
    assert (
        client.patch(f"{url}/status", json={"is_active": False}, headers=auth(stranger))
    ).status_code == 403
    assert client.delete(url, headers=auth(stranger)).status_code == 403
    assert client.delete(url).status_code == 401
    assert client.patch(f"{PROPERTIES}/999999999", json={}, headers=auth(owner)).status_code == 404


def test_media_module_is_the_one_patched() -> None:
    # Si alguien cambia el import en properties.py, el test de borrado dejaría de aislar S3.
    from app.api.routes import properties

    assert properties.s3_storage is media.s3_storage
