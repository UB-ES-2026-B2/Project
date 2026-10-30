from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import Settings

password_context = CryptContext(schemes=["bcrypt"], bcrypt__truncate_error=True)


def hash_password(password: str) -> str:
    return password_context.hash(password)


def create_access_token(user_id: int, settings: Settings) -> str:
    if settings.secret_key is None or not settings.secret_key.get_secret_value().strip():
        raise ValueError("SECRET_KEY no configurada")
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        },
        settings.secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
