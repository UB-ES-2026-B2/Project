"""US 1.7.1: GET /api/v1/favorites/me con los datos de cada inmueble."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.favorite import Favorite

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401
from tests.test_favorites import auth, make_property, make_user

ME = "/api/v1/favorites/me"


def test_returns_full_cards_newest_first_and_only_own(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    user, other = make_user(db, "me@example.com"), make_user(db, "otra@example.com")
    older, newer = make_property(db, "Antiguo"), make_property(db, "Reciente")
    now = datetime.now(UTC)
    db.add_all(
        [
            Favorite(user_id=user.id, property_id=older.id, created_at=now - timedelta(hours=1)),
            Favorite(user_id=user.id, property_id=newer.id, created_at=now),
            Favorite(user_id=other.id, property_id=older.id),
        ]
    )
    db.flush()

    response = client.get(ME, headers=auth(user))

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["title"] for item in items] == ["Reciente", "Antiguo"]
    assert {"price", "area", "image_url", "price_per_m2", "is_active"} <= set(items[0])


def test_inactive_properties_stay_with_is_active_false(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
) -> None:
    user = make_user(db, "me@example.com")
    retired = make_property(db, "Retirado")
    retired.is_active = False
    db.add(Favorite(user_id=user.id, property_id=retired.id))
    db.flush()

    items = client.get(ME, headers=auth(user)).json()["items"]

    assert [(item["title"], item["is_active"]) for item in items] == [("Retirado", False)]


def test_empty_list(client: TestClient, db: Session) -> None:  # noqa: F811
    user = make_user(db, "me@example.com")

    assert client.get(ME, headers=auth(user)).json() == {"items": []}


def test_requires_token(client: TestClient) -> None:  # noqa: F811
    response = client.get(ME)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
