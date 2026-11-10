from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import Settings

# Se usa bcrypt directamente: passlib está abandonado y no funciona con bcrypt >= 4.1.
# Los hashes tienen el mismo formato ($2b$...), así que los ya guardados siguen valiendo.

# Hash de una contraseña aleatoria: se compara contra él cuando el email no existe para que
# el login tarde lo mismo con y sin usuario (no se puede averiguar qué emails están dados de alta).
_DUMMY_HASH = bcrypt.hashpw(b"contrasenya-que-no-usa-nadie", bcrypt.gensalt())


def hash_password(password: str) -> str:
    """Hash bcrypt. Lanza ValueError con más de 72 bytes (el registro no lo permite)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed_password: str | None) -> bool:
    """Comprueba la contraseña contra su hash bcrypt en tiempo constante."""
    # bcrypt solo mira los 72 primeros bytes: sin este control, "contraseña buena + basura"
    # también entraría. El registro ya no admite contraseñas más largas.
    secret = password.encode("utf-8")
    try:
        if hashed_password is None or len(secret) > 72:
            bcrypt.checkpw(secret[:72], _DUMMY_HASH)
            return False
        return bcrypt.checkpw(secret, hashed_password.encode("ascii"))
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
