from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
)


class AuthRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        handler = super().get_route_handler()

        async def handle(request: Request) -> Response:
            try:
                return await handler(request)
            except RequestValidationError as exc:
                # no retornem dades sensibles als errors de validacio
                errors = [
                    {key: value for key, value in error.items() if key not in {"input", "ctx"}}
                    for error in exc.errors()
                ]
                return JSONResponse(status_code=422, content=jsonable_encoder({"detail": errors}))

        return handle


router = APIRouter(prefix="/auth", tags=["auth"], route_class=AuthRoute)
DbSession = Annotated[Session, Depends(get_db)]


def get_auth_settings(settings: Annotated[Settings, Depends(get_settings)]) -> Settings:
    if settings.secret_key is None or not settings.secret_key.get_secret_value().strip():
        raise HTTPException(status_code=503, detail="El registro no está configurado")
    return settings


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=RegisterResponse)
def register(
    payload: RegisterRequest,
    db: DbSession,
    settings: Annotated[Settings, Depends(get_auth_settings)],
) -> RegisterResponse:
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    try:
        db.flush()
        token = create_access_token(user.id, settings)
        public_user = UserResponse.model_validate(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # la restriccio tambe protegeix els registres simultanis
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "uq_users_email":
            raise HTTPException(status_code=409, detail="El email ya está registrado") from exc
        raise
    return RegisterResponse(access_token=token, user=public_user)


# --- US 4.2.1: login y perfil del usuario autenticado ---------------------------------

# auto_error=False: sin cabecera se responde 401 con nuestro mensaje (no 403 genérico).
# tokenUrl activa el botón "Authorize" de Swagger con usuario (email) y contraseña.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

INVALID_CREDENTIALS = "Correo electrónico o contraseña incorrectos"


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_token_settings(settings: Annotated[Settings, Depends(get_settings)]) -> Settings:
    if settings.secret_key is None or not settings.secret_key.get_secret_value().strip():
        raise HTTPException(status_code=503, detail="La autenticación no está configurada")
    return settings


async def read_login_credentials(request: Request) -> LoginRequest:
    """Acepta JSON `{email, password}` o el formulario OAuth2 `username` + `password`."""
    content_type = request.headers.get("content-type", "")
    try:
        if content_type.startswith(("application/x-www-form-urlencoded", "multipart/form-data")):
            form = await request.form()
            data: object = {
                "email": form.get("username") or form.get("email"),
                "password": form.get("password"),
            }
        else:
            data = await request.json()
    except ValueError as exc:
        raise RequestValidationError(
            [{"type": "json_invalid", "loc": ("body",), "msg": "JSON no válido"}]
        ) from exc
    try:
        return LoginRequest.model_validate(data)
    except ValidationError as exc:
        # Mismo formato que la validación nativa de FastAPI: loc empieza por "body".
        errors = [{**err, "loc": ("body", *err["loc"])} for err in exc.errors(include_url=False)]
        raise RequestValidationError(errors) from exc


LOGIN_REQUEST_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {"schema": LoginRequest.model_json_schema()},
            "application/x-www-form-urlencoded": {
                "schema": {
                    "type": "object",
                    "required": ["username", "password"],
                    "properties": {
                        "username": {"type": "string", "description": "Correo electrónico"},
                        "password": {"type": "string", "format": "password"},
                    },
                }
            },
        },
    }
}


@router.post(
    "/login",
    response_model=LoginResponse,
    openapi_extra=LOGIN_REQUEST_BODY,
    responses={401: {"description": "Credenciales incorrectas"}},
)
def login(
    credentials: Annotated[LoginRequest, Depends(read_login_credentials)],
    db: DbSession,
    settings: Annotated[Settings, Depends(get_token_settings)],
) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == credentials.email))
    # Se verifica siempre (también sin usuario) para no revelar qué emails existen.
    password_ok = verify_password(credentials.password, user.hashed_password if user else None)
    if user is None or not password_ok or not user.is_active:
        raise unauthorized(INVALID_CREDENTIALS)
    return LoginResponse(
        access_token=create_access_token(user.id, settings),
        user=UserResponse.model_validate(user),
    )


def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: DbSession,
    settings: Annotated[Settings, Depends(get_token_settings)],
) -> User:
    """Dependencia para las rutas que requieren `Authorization: Bearer <token>`."""
    if not token:
        raise unauthorized("No autenticado")
    try:
        user_id = decode_access_token(token, settings)
    except jwt.InvalidTokenError as exc:
        raise unauthorized("Token no válido o caducado") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized("Token no válido o caducado")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get(
    "/me",
    response_model=UserResponse,
    responses={401: {"description": "Sin token o token no válido"}},
)
def read_me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)
