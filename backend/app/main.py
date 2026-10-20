"""Punto de entrada de la API y rutas comunes del backend."""

from functools import lru_cache

from fastapi import APIRouter, FastAPI, Response
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.api.routes.properties import router as properties_router
from app.core.config import get_settings

app = FastAPI(title="ES-B2 API", docs_url="/api/docs", openapi_url="/api/openapi.json")

api = APIRouter(prefix="/api")


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        connect_args={"connect_timeout": 3},
        pool_pre_ping=True,
    )


@api.get("/health")
def health(response: Response) -> dict[str, str]:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return {"status": "error", "database": "unreachable"}
    return {"status": "ok"}


api.include_router(properties_router)
app.include_router(api)
