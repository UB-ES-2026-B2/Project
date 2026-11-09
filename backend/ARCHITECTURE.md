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
El parámetro opcional `location_id` filtra por una ubicación (ver
[Filtro por ubicación](#filtro-por-ubicación-us-131)); sin él, el listado no cambia.

La respuesta incluye `items`, `page`, `limit` y `total`. Cada inmueble incluye los
campos de la tarjeta visual y calcula `price_per_m2` y `has_price_drop` en Pydantic.

## Base de datos

La tabla `properties` se crea con la migración `001_create_properties`. Al arrancar Docker,
el entrypoint ejecuta `alembic upgrade head` automáticamente.

La migración `004_create_locations` añade la tabla `locations` y las columnas
`neighborhood_id` y `postal_code_id` de `properties`.

Todavía no hay detalle de inmueble ni subida de imágenes.

## Filtro por ubicación (US 1.3.1)

```text
Buscador -> GET /api/v1/locations/suggest?q=gra -> elige una sugerencia
         -> GET /api/v1/properties?location_id=<id>
```

- `locations` es una sola tabla con `name`, `type` (`city`, `neighborhood` o `postal_code`)
  y `parent_id`, que apunta a la ciudad en barrios y códigos postales.
- Cada inmueble tiene dos FK opcionales, `neighborhood_id` y `postal_code_id`
  (`ON DELETE SET NULL`). El campo de texto `location` se mantiene para la tarjeta.
- `suggest` busca con `f_unaccent(lower(name)) LIKE '%q%'`, sin distinguir mayúsculas ni
  acentos. El índice GIN `ix_locations_name_trgm` (`pg_trgm`) usa esa misma expresión.
  `f_unaccent` es un envoltorio `IMMUTABLE` de `unaccent`, porque PostgreSQL no deja indexar
  funciones que no lo sean. Salen primero las que empiezan por `q`, como máximo 10. Con
  menos de 3 caracteres devuelve `[]`.
- `location_id` de una ciudad incluye los inmuebles de sus barrios y códigos postales; el
  de un barrio o un código postal, solo los suyos.
- Los tests de ubicaciones usan PostgreSQL (SQLite no tiene `unaccent` ni `pg_trgm`) e
  incluyen uno que comprueba que la latencia mediana de `suggest` es menor de 60 ms.

## Comprobación

Desde `backend/`:

```bash
alembic upgrade head
alembic heads
pytest --cov=app
```

`alembic heads` debe devolver una sola revisión.
