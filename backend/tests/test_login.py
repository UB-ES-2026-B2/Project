"""US 4.2.1: POST /api/auth/login y GET /api/auth/me."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User

# Reutiliza los fixtures de test_auth (settings con SECRET_KEY, BD con savepoint y cliente).
from tests.test_auth import auth_settings, client, db  # noqa: F401

EMAIL = "persona@example.com"
PASSWORD = "contraseña-segura"
INVALID = "Correo electrónico o contraseña incorrectos"


@pytest.fixture
def user(db: Session) -> User:  # noqa: F811
    person = User(email=EMAIL, hashed_password=hash_password(PASSWORD), full_name="Persona Prova")
    db.add(person)
    db.flush()
    return person


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def claims(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "iat", "exp"]},
    )


def make_token(sub: str, minutes: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": sub, "iat": now, "exp": now + timedelta(minutes=minutes)},
        settings.secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


# --- POST /api/auth/login -------------------------------------------------------------


def test_login_json_returns_token_and_public_user(client: TestClient, user: User) -> None:  # noqa: F811
    response = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"access_token", "token_type", "user"}
    assert body["token_type"] == "bearer"
    assert body["user"] == {
        "id": user.id,
        "email": EMAIL,
        "full_name": "Persona Prova",
        "is_active": True,
        "created_at": body["user"]["created_at"],
    }
    assert "hashed_password" not in response.text
    token_claims = claims(body["access_token"])
    assert token_claims["sub"] == str(user.id)
    assert token_claims["exp"] - token_claims["iat"] == 30 * 60


def test_login_oauth2_form_for_swagger(client: TestClient, user: User) -> None:  # noqa: F811
    response = client.post("/api/auth/login", data={"username": EMAIL, "password": PASSWORD})

    assert response.status_code == 200
    assert claims(response.json()["access_token"])["sub"] == str(user.id)


def test_login_email_is_case_insensitive(client: TestClient, user: User) -> None:  # noqa: F811
    response = client.post(
        "/api/auth/login", json={"email": "PERSONA@Example.COM", "password": PASSWORD}
    )

    assert response.status_code == 200


@pytest.mark.parametrize(
    "email,password",
    [(EMAIL, "contraseña-mala"), ("nadie@example.com", PASSWORD), (EMAIL, "x" * 100)],
    ids=["wrong-password", "unknown-email", "password-over-72-bytes"],
)
def test_login_bad_credentials_same_401(
    client: TestClient,  # noqa: F811
    user: User,
    email: str,
    password: str,
) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": INVALID}
    assert response.headers["www-authenticate"] == "Bearer"


def test_login_rejects_correct_password_with_extra_bytes(client: TestClient, db: Session) -> None:  # noqa: F811
    # bcrypt trunca a 72 bytes: "contraseña de 72 bytes + sufijo" no debe dar acceso.
    password = "a" * 72
    db.add(User(email="larga@example.com", hashed_password=hash_password(password)))
    db.flush()
    ok = client.post("/api/auth/login", json={"email": "larga@example.com", "password": password})
    extra = client.post(
        "/api/auth/login", json={"email": "larga@example.com", "password": password + "zzz"}
    )

    assert ok.status_code == 200
    assert extra.status_code == 401


def test_login_with_corrupt_hash_is_401(client: TestClient, db: Session) -> None:  # noqa: F811
    db.add(User(email="roto@example.com", hashed_password="no-es-bcrypt"))
    db.flush()

    response = client.post("/api/auth/login", json={"email": "roto@example.com", "password": "x"})

    assert response.status_code == 401


def test_login_inactive_user_is_rejected(client: TestClient, db: Session, user: User) -> None:  # noqa: F811
    user.is_active = False
    db.flush()

    response = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 401
    assert response.json() == {"detail": INVALID}


@pytest.mark.parametrize(
    "kwargs",
    [
        {"json": {"email": "no-es-un-email", "password": "secreto-que-no-sale"}},
        {"json": {"email": EMAIL}},
        {"json": {"email": EMAIL, "password": ""}},
        {"json": ["lista"]},
        {"content": b"{no json", "headers": {"content-type": "application/json"}},
        {"data": {"username": EMAIL}},
    ],
    ids=["bad-email", "no-password", "empty-password", "not-object", "bad-json", "form-no-pw"],
)
def test_login_validation_errors_do_not_echo_input(client: TestClient, kwargs: dict) -> None:  # noqa: F811
    response = client.post("/api/auth/login", **kwargs)

    assert response.status_code == 422
    assert "secreto-que-no-sale" not in response.text
    for error in response.json()["detail"]:
        assert error["loc"][0] == "body"
        assert "input" not in error
        assert "ctx" not in error


def test_login_without_secret_key_returns_503(
    client: TestClient,  # noqa: F811
    user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SECRET_KEY", "")
    get_settings.cache_clear()

    response = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 503


def test_openapi_documents_login_and_bearer_scheme(client: TestClient) -> None:  # noqa: F811
    schema = client.get("/api/openapi.json").json()
    login_body = schema["paths"]["/api/auth/login"]["post"]["requestBody"]["content"]

    assert set(login_body) == {"application/json", "application/x-www-form-urlencoded"}
    assert (
        schema["components"]["securitySchemes"]["OAuth2PasswordBearer"]["flows"]["password"][
            "tokenUrl"
        ]
        == "/api/auth/login"
    )
    assert schema["paths"]["/api/auth/me"]["get"]["security"] == [{"OAuth2PasswordBearer": []}]


# --- GET /api/auth/me -----------------------------------------------------------------


def test_me_returns_the_logged_in_user(client: TestClient, user: User) -> None:  # noqa: F811
    token = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()[
        "access_token"
    ]

    response = client.get("/api/auth/me", headers=bearer(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "email", "full_name", "is_active", "created_at"}
    assert body["id"] == user.id
    assert body["email"] == EMAIL


def test_me_accepts_the_token_from_register(client: TestClient) -> None:  # noqa: F811
    registered = client.post(
        "/api/auth/register", json={"email": "nueva@example.com", "password": PASSWORD}
    ).json()

    response = client.get("/api/auth/me", headers=bearer(registered["access_token"]))

    assert response.status_code == 200
    assert response.json()["email"] == "nueva@example.com"


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer "}, {"Authorization": "Basic abc"}, bearer("no.es.jwt")],
    ids=["no-header", "empty-bearer", "basic", "garbage"],
)
def test_me_without_valid_token_is_401(client: TestClient, headers: dict) -> None:  # noqa: F811
    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_rejects_expired_token(client: TestClient, user: User) -> None:  # noqa: F811
    response = client.get("/api/auth/me", headers=bearer(make_token(str(user.id), -1)))

    assert response.status_code == 401
    assert response.json() == {"detail": "Token no válido o caducado"}


def test_me_rejects_token_signed_with_other_key(client: TestClient, user: User) -> None:  # noqa: F811
    now = datetime.now(UTC)
    forged = jwt.encode(
        {"sub": str(user.id), "iat": now, "exp": now + timedelta(minutes=5)},
        "otra-clave-que-no-es-la-del-servidor-0123456789",
        algorithm="HS256",
    )

    assert client.get("/api/auth/me", headers=bearer(forged)).status_code == 401


def test_me_rejects_alg_none_token(client: TestClient, user: User) -> None:  # noqa: F811
    now = datetime.now(UTC)
    unsigned = jwt.encode(
        {"sub": str(user.id), "iat": now, "exp": now + timedelta(minutes=5)}, None, algorithm="none"
    )

    assert client.get("/api/auth/me", headers=bearer(unsigned)).status_code == 401


@pytest.mark.parametrize("sub", ["abc", "999999999"], ids=["non-numeric-sub", "deleted-user"])
def test_me_rejects_token_for_unknown_user(client: TestClient, sub: str) -> None:  # noqa: F811
    response = client.get("/api/auth/me", headers=bearer(make_token(sub, 5)))

    assert response.status_code == 401


def test_me_rejects_deactivated_user(client: TestClient, db: Session, user: User) -> None:  # noqa: F811
    token = make_token(str(user.id), 5)
    user.is_active = False
    db.flush()

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401
