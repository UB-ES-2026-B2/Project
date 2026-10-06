# PLACEHOLDER DevOps: esqueleto mínimo para que la CI y el Dockerfile tengan algo que probar.
# El equipo de backend lo sustituye por la app real. Lo único que debe mantenerse es
# GET /api/health -> 200 {"status": "ok"} si la base de datos responde, 503 si no
# (lo usan el healthcheck del contenedor y el rollback automático del despliegue).
import os
from functools import lru_cache

from fastapi import APIRouter, FastAPI, Response
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

app = FastAPI(title="ES-B2 API", docs_url="/api/docs", openapi_url="/api/openapi.json")

api = APIRouter(prefix="/api")


@lru_cache
def get_engine() -> Engine:
    return create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)


@api.get("/health")
def health(response: Response) -> dict[str, str]:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return {"status": "error", "database": "unreachable"}
    return {"status": "ok"}


app.include_router(api)
