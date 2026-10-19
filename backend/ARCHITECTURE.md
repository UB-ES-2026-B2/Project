# Catálogo inicial

La primera historia de backend es la US 1.1.1: cargar el catálogo que muestra la
página de inicio. El frontend ya consume este endpoint y transforma únicamente los
nombres de campo que usa su componente visual.

## Flujo

```text
Frontend -> GET /api/v1/properties -> FastAPI -> SQLAlchemy -> PostgreSQL
```

## Endpoint

`GET /api/v1/properties?page=1&limit=12` devuelve una página del catálogo, ordenada
por fecha de creación descendente. `page` empieza en 1 y `limit` admite de 1 a 50.

La respuesta incluye `items`, `page`, `limit` y `total`. Cada inmueble incluye los
campos de la tarjeta visual y calcula `price_per_m2` y `has_price_drop` en Pydantic.

## Base de datos

La tabla `properties` se crea con la migración `001_create_properties`. Al arrancar Docker,
el entrypoint ejecuta `alembic upgrade head` automáticamente.

Este vertical no incluye todavía usuarios, favoritos, filtros, detalle ni subida de imágenes.

## Comprobación

Desde `backend/`:

```bash
alembic upgrade head
alembic heads
pytest --cov=app
```

`alembic heads` debe devolver una sola revisión.
