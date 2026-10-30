from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, RegisterResponse, UserResponse


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
