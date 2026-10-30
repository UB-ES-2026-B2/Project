import secrets
from collections.abc import Generator
from datetime import UTC, datetime

import jwt
import pytest
from fastapi.testclient import TestClient
from passlib.hash import bcrypt
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.user import User

PAYLOAD = {
    "email": "Usuari@example.com",
    "password": "contrasenya-segura",
    "full_name": "Usuari Prova",
}


@pytest.fixture(autouse=True)
def auth_settings(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("SECRET_KEY", secrets.token_urlsafe(64))
    monkeypatch.setenv("JWT_ALGORITHM", "HS256")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def db() -> Generator[Session, None, None]:
    engine = create_engine(get_settings().database_url)
    with engine.connect() as connection:
        transaction = connection.begin()
        # cada prova queda aillada sense esborrar els usuaris locals
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()
    engine.dispose()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides = previous_overrides


def test_register_returns_public_user_and_signed_token(client: TestClient, db: Session) -> None:
    response = client.post("/api/auth/register", json=PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"access_token", "token_type", "user"}
    assert body["token_type"] == "bearer"
    assert set(body["user"]) == {"id", "email", "full_name", "is_active", "created_at"}
    assert body["user"]["email"] == "usuari@example.com"
    assert body["user"]["full_name"] == PAYLOAD["full_name"]
    assert body["user"]["is_active"] is True
    assert datetime.fromisoformat(body["user"]["created_at"]).tzinfo is not None

    settings = get_settings()
    claims = jwt.decode(
        body["access_token"],
        settings.secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "iat", "exp"]},
    )
    assert claims["sub"] == str(body["user"]["id"])
    assert claims["exp"] - claims["iat"] == 30 * 60
    assert claims["exp"] > datetime.now(UTC).timestamp()
    assert "password" not in response.text
    assert PAYLOAD["password"] not in response.text

    user = db.scalar(select(User).where(User.id == body["user"]["id"]))
    assert user is not None
    assert user.hashed_password != PAYLOAD["password"]
    assert bcrypt.verify(PAYLOAD["password"], user.hashed_password)
    assert not bcrypt.verify("contrasenya-incorrecta", user.hashed_password)
    assert user.hashed_password not in response.text


def test_register_without_optional_name(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"email": "sense-nom@example.com", "password": "12345678"}
    )
    assert response.status_code == 201
    assert response.json()["user"]["full_name"] is None


@pytest.mark.parametrize("email", ["usuari@example.com", "USUARI@EXAMPLE.COM"])
def test_duplicate_email_returns_409(client: TestClient, db: Session, email: str) -> None:
    assert client.post("/api/auth/register", json=PAYLOAD).status_code == 201
    response = client.post("/api/auth/register", json={**PAYLOAD, "email": email})
    assert response.status_code == 409
    assert PAYLOAD["password"] not in response.text
    assert db.scalar(select(func.count()).select_from(User).where(User.email == email.lower())) == 1
    assert (
        client.post(
            "/api/auth/register", json={**PAYLOAD, "email": "altre@example.com"}
        ).status_code
        == 201
    )


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "usuari@example.com"},
        {"password": "contrasenya-segura"},
        {**PAYLOAD, "email": "no-es-un-email"},
        {**PAYLOAD, "email": None},
        {**PAYLOAD, "password": "1234567"},
        {**PAYLOAD, "password": ""},
        {**PAYLOAD, "password": None},
        {**PAYLOAD, "password": "a" * 73},
        {**PAYLOAD, "password": "ñ" * 37},
        {**PAYLOAD, "password": "contrasenya\x00nul"},
        {**PAYLOAD, "full_name": "a" * 256},
    ],
)
def test_invalid_registration_returns_422(client: TestClient, db: Session, payload: dict) -> None:
    count = db.scalar(select(func.count()).select_from(User))
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert "detail" in response.json()
    assert all("input" not in error for error in response.json()["detail"])
    assert db.scalar(select(func.count()).select_from(User)) == count


def test_password_accepts_72_bytes(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={**PAYLOAD, "password": "ñ" * 36})
    assert response.status_code == 201


def test_jwt_uses_environment_configuration(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("JWT_ALGORITHM", "HS512")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "7")
    get_settings.cache_clear()
    response = client.post("/api/auth/register", json=PAYLOAD)
    assert response.status_code == 201
    token = response.json()["access_token"]
    claims = jwt.decode(token, get_settings().secret_key.get_secret_value(), algorithms=["HS512"])
    assert jwt.get_unverified_header(token)["alg"] == "HS512"
    assert claims["exp"] - claims["iat"] == 7 * 60
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, secrets.token_urlsafe(64), algorithms=["HS512"])


@pytest.mark.parametrize("secret", [None, "", "   "])
def test_missing_secret_prevents_registration(
    client: TestClient, db: Session, secret: str | None
) -> None:
    settings = Settings(_env_file=None, secret_key=secret)
    app.dependency_overrides[get_settings] = lambda: settings
    count = db.scalar(select(func.count()).select_from(User))
    assert client.post("/api/auth/register", json=PAYLOAD).status_code == 503
    assert db.scalar(select(func.count()).select_from(User)) == count
    with pytest.raises(ValueError, match="SECRET_KEY"):
        create_access_token(1, settings)


def test_model_normalizes_email(db: Session) -> None:
    user = User(email="  Model@EXAMPLE.COM  ", hashed_password="hash-de-prova")
    db.add(user)
    db.flush()
    assert user.email == "model@example.com"
    assert user.is_active is True
    assert user.created_at is not None


def test_database_enforces_unique_email(db: Session) -> None:
    db.add(User(email="unic@example.com", hashed_password="hash-de-prova"))
    db.flush()
    with pytest.raises(IntegrityError) as exc, db.begin_nested():
        db.add(User(email="UNIC@example.com", hashed_password="altre-hash-de-prova"))
        db.flush()
    assert exc.value.orig.diag.constraint_name == "uq_users_email"


def test_database_rejects_unnormalized_email(db: Session) -> None:
    with pytest.raises(IntegrityError) as exc, db.begin_nested():
        db.execute(
            text("INSERT INTO users (email, hashed_password) VALUES (:email, :hash)"),
            {"email": "Majuscules@example.com", "hash": "hash-de-prova"},
        )
    assert exc.value.orig.diag.constraint_name == "ck_users_email_lowercase"
