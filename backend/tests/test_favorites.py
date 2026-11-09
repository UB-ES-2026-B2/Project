"""US 1.2.1: POST/DELETE /api/v1/favorites/{property_id} y GET /api/v1/favorites."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.models.favorite import Favorite
from app.models.property import Property
from app.models.user import User

# Reutiliza los fixtures de test_auth (settings con SECRET_KEY, BD con savepoint y cliente).
from tests.test_auth import auth_settings, client, db  # noqa: F401


def make_user(db: Session, email: str) -> User:  # noqa: F811
    user = User(email=email, hashed_password=hash_password("contrasenya-segura"))
    db.add(user)
    db.flush()
    return user


def make_property(db: Session, title: str = "Piso de prueba") -> Property:  # noqa: F811
    prop = Property(
        title=title, location="Barcelona", price=300000, bedrooms=2, bathrooms=1, area=75
    )
    db.add(prop)
    db.flush()
    return prop


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, get_settings())}"}


def count_favorites(db: Session, user: User) -> int:  # noqa: F811
    return db.scalar(select(func.count()).where(Favorite.user_id == user.id)) or 0


@pytest.fixture
def user(db: Session) -> User:  # noqa: F811
    return make_user(db, "fav@example.com")


@pytest.fixture
def prop(db: Session) -> Property:  # noqa: F811
    return make_property(db)


# --- POST ----------------------------------------------------------------------------


def test_add_favorite_returns_201_and_persists(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    response = client.post(f"/api/v1/favorites/{prop.id}", headers=auth(user))

    assert response.status_code == 201
    assert response.content == b""
    assert db.get(Favorite, (user.id, prop.id)) is not None


def test_add_favorite_twice_is_idempotent(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    first = client.post(f"/api/v1/favorites/{prop.id}", headers=auth(user))
    second = client.post(f"/api/v1/favorites/{prop.id}", headers=auth(user))

    assert (first.status_code, second.status_code) == (201, 201)
    assert count_favorites(db, user) == 1


def test_add_favorite_unknown_property_is_404(client: TestClient, user: User) -> None:  # noqa: F811
    response = client.post("/api/v1/favorites/999999999", headers=auth(user))

    assert response.status_code == 404
    assert response.json() == {"detail": "El inmueble no existe"}


@pytest.mark.parametrize("bad_id", ["0", "-1", "abc", "99999999999"])
def test_add_favorite_invalid_id_is_422(client: TestClient, user: User, bad_id: str) -> None:  # noqa: F811
    assert client.post(f"/api/v1/favorites/{bad_id}", headers=auth(user)).status_code == 422


# --- DELETE --------------------------------------------------------------------------


def test_remove_favorite_returns_204(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    client.post(f"/api/v1/favorites/{prop.id}", headers=auth(user))

    response = client.delete(f"/api/v1/favorites/{prop.id}", headers=auth(user))

    assert response.status_code == 204
    assert response.content == b""
    assert db.get(Favorite, (user.id, prop.id)) is None


def test_remove_favorite_not_saved_is_idempotent(
    client: TestClient,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    assert client.delete(f"/api/v1/favorites/{prop.id}", headers=auth(user)).status_code == 204


def test_remove_favorite_unknown_property_is_404(client: TestClient, user: User) -> None:  # noqa: F811
    assert client.delete("/api/v1/favorites/999999999", headers=auth(user)).status_code == 404


# --- GET -----------------------------------------------------------------------------


def test_list_favorites_newest_first_and_only_own(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
) -> None:
    first, second = make_property(db, "Primero"), make_property(db, "Segundo")
    other_user = make_user(db, "otra@example.com")
    db.add_all(
        [
            Favorite(
                user_id=user.id,
                property_id=first.id,
                created_at=datetime.now(UTC) - timedelta(hours=1),
            ),
            Favorite(user_id=user.id, property_id=second.id, created_at=datetime.now(UTC)),
            Favorite(user_id=other_user.id, property_id=first.id),
        ]
    )
    db.flush()

    response = client.get("/api/v1/favorites", headers=auth(user))

    assert response.status_code == 200
    assert response.json() == {"property_ids": [second.id, first.id]}


def test_list_favorites_empty(client: TestClient, user: User) -> None:  # noqa: F811
    assert client.get("/api/v1/favorites", headers=auth(user)).json() == {"property_ids": []}


def test_one_user_cannot_remove_another_users_favorite(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    other_user = make_user(db, "otra@example.com")
    client.post(f"/api/v1/favorites/{prop.id}", headers=auth(other_user))

    client.delete(f"/api/v1/favorites/{prop.id}", headers=auth(user))

    assert db.get(Favorite, (other_user.id, prop.id)) is not None


# --- Seguridad -----------------------------------------------------------------------


@pytest.mark.parametrize("method", ["get", "post", "delete"])
@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer no.es.jwt"}],
    ids=["no-token", "bad-token"],
)
def test_favorites_require_valid_token(
    client: TestClient,  # noqa: F811
    prop: Property,
    method: str,
    headers: dict,
) -> None:
    path = "/api/v1/favorites" if method == "get" else f"/api/v1/favorites/{prop.id}"

    response = getattr(client, method)(path, headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_expired_token_is_401(client: TestClient, user: User, prop: Property) -> None:  # noqa: F811
    settings = get_settings()
    now = datetime.now(UTC)
    expired = jwt.encode(
        {"sub": str(user.id), "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
        settings.secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )

    response = client.post(
        f"/api/v1/favorites/{prop.id}", headers={"Authorization": f"Bearer {expired}"}
    )

    assert response.status_code == 401


# --- Integridad ----------------------------------------------------------------------


def test_deleting_user_or_property_cascades(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    user: User,
    prop: Property,
) -> None:
    other = make_property(db, "Otro")
    client.post(f"/api/v1/favorites/{prop.id}", headers=auth(user))
    client.post(f"/api/v1/favorites/{other.id}", headers=auth(user))

    db.delete(prop)
    db.flush()
    db.expire_all()
    assert count_favorites(db, user) == 1

    db.delete(user)
    db.flush()
    assert db.scalar(select(func.count()).select_from(Favorite)) == 0
