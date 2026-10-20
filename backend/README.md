# Backend

API mínima del portal inmobiliario, construida con FastAPI y PostgreSQL/PostGIS.

## Contrato actual

- `GET /api/health` devuelve `{"status": "ok"}` cuando la base de datos responde.
- Devuelve `503` si la base de datos no está disponible.
- `GET /api/v1/properties` devuelve el catálogo paginado de la página de inicio.
- La configuración llega por variables de entorno; no se guardan secretos en el código.

La estructura y el alcance del primer vertical están explicados en
[ARCHITECTURE.md](ARCHITECTURE.md).

## Levantar la API con Docker

1. Abre Docker Desktop y espera a que esté iniciado.
2. Desde la raíz del proyecto, ejecuta:

```bash
docker compose up --build
```

La primera vez descarga las imágenes y tarda unos minutos. Después quedan disponibles:

- API: `http://localhost:8000/api/health`
- Swagger: `http://localhost:8000/api/docs`
- PostgreSQL/PostGIS: `localhost:5432`

Para detener los contenedores, usa `docker compose down` desde la raíz.

## Comprobaciones

Desde `backend/`, con la base de datos levantada:

```bash
pip install -e ".[dev]"
ruff check .
ruff format --check .
pytest --cov=app
```

Las nuevas funcionalidades deben entrar con sus tests y, si cambian la base de datos,
con su migración de Alembic.
