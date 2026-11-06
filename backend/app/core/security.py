from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import Settings

password_context = CryptContext(schemes=["bcrypt"], bcrypt__truncate_error=True)

# Hash de una contraseña aleatoria: se compara contra él cuando el email no existe para que
# el login tarde lo mismo con y sin usuario (no se puede averiguar qué emails están dados de alta).
_DUMMY_HASH = password_context.hash("contrasenya-que-no-usa-nadie")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    """Comprueba la contraseña contra su hash bcrypt en tiempo constante."""
    # bcrypt solo mira los 72 primeros bytes: sin este control, "contraseña buena + basura"
    # también entraría. El registro ya no admite contraseñas más largas.
    too_long = len(password.encode("utf-8")) > 72
    try:
        if hashed_password is None or too_long:
            password_context.verify(password[:72], _DUMMY_HASH)
            return False
        return password_context.verify(password, hashed_password)
    except ValueError:
        # Hash corrupto o no bcrypt.
        return False


def _secret(settings: Settings) -> str:
    if settings.secret_key is None or not settings.secret_key.get_secret_value().strip():
        raise ValueError("SECRET_KEY no configurada")
    return settings.secret_key.get_secret_value()


def create_access_token(user_id: int, settings: Settings) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        },
        _secret(settings),
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str, settings: Settings) -> int:
    """Verifica firma y caducidad del JWT y devuelve el id de usuario (claim `sub`).

    Lanza `jwt.InvalidTokenError` si el token no es válido.
    """
    claims = jwt.decode(
        token,
        _secret(settings),
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "iat", "exp"]},
    )
    try:
        return int(claims["sub"])
    except (TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("sub no válido") from exc
