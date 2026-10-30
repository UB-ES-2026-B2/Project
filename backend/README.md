# Backend

API mínima del portal inmobiliario, construida con FastAPI y PostgreSQL/PostGIS.

## Contrato actual

- `GET /api/health` devuelve `{"status": "ok"}` cuando la base de datos responde.
- Devuelve `503` si la base de datos no está disponible.
- `GET /api/v1/properties` devuelve el catálogo paginado de la página de inicio.
- `POST /api/auth/register` registra un usuario y devuelve su JWT de acceso.
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

## Registro de usuarios (US 4.1.1)

En el `.env` de la raíz, configura `SECRET_KEY` con una clave aleatoria local.
`JWT_ALGORITHM` admite `HS256` (por defecto), `HS384` o `HS512` y
`ACCESS_TOKEN_EXPIRE_MINUTES` debe ser un entero positivo (30 por defecto).
Nunca subas este fichero. Si no hay clave, el registro devuelve `503` y no crea usuarios.
Para ejecutar la API fuera de Docker, exporta estas variables junto con `DATABASE_URL`
o usa un `.env` local dentro de `backend/`.

Al arrancar `docker compose up --build`, Alembic aplica `002_create_users`.
Abre [Swagger](http://localhost:8000/api/docs#/auth/register_api_auth_register_post),
selecciona **Try it out** y ejecuta este cuerpo:

```json
{
  "email": "persona@example.com",
  "password": "contrasenya-segura",
  "full_name": "Persona de prueba"
}
```

Respuesta `201` (token e identificador ilustrativos):

```json
{
  "access_token": "<jwt firmado>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "persona@example.com",
    "full_name": "Persona de prueba",
    "is_active": true,
    "created_at": "2026-10-30T12:00:00Z"
  }
}
```

El email se normaliza a minúsculas. Repetirlo, incluso cambiando mayúsculas,
devuelve `409`. Los datos incompletos o inválidos devuelven `422`.
`full_name` se puede omitir. La contraseña admite un mínimo de 8 caracteres y un
máximo de 72 bytes UTF-8, sin caracteres NUL; se rechaza el exceso para evitar
el [truncamiento de bcrypt](https://passlib.readthedocs.io/en/stable/lib/passlib.hash.bcrypt.html).
La respuesta y los errores de validación no incluyen contraseñas ni hashes.

Las pruebas de registro usan PostgreSQL con transacciones que se revierten al
terminar cada prueba; no borran los usuarios locales. Con la base de datos levantada:

```bash
alembic upgrade head
alembic heads
pytest --cov=app
```
