# PLACEHOLDER DevOps: pruebas mínimas del contrato GET /api/health.
# test_health_ok necesita la base de datos de DATABASE_URL (en la CI, el servicio de Postgres;
# en local, `docker compose up db` y DATABASE_URL apuntando a localhost).
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_engine

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_engine():
    get_engine.cache_clear()
    yield
    get_engine.cache_clear()


def test_health_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    # Puerto 1: nadie escucha, la conexión falla al momento.
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:app@127.0.0.1:1/app")
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json()["status"] == "error"
