# Backend

API mínima del portal inmobiliario, construida con FastAPI y PostgreSQL/PostGIS.

## Contrato actual

- `GET /api/health` devuelve `{"status": "ok"}` cuando la base de datos responde.
- Devuelve `503` si la base de datos no está disponible.
- `GET /api/v1/properties` devuelve el catálogo paginado de la página de inicio.
- `POST /api/auth/register` registra un usuario y devuelve su JWT de acceso.
- `POST /api/auth/login` inicia sesión con email y contraseña y devuelve un JWT nuevo.
- `GET /api/auth/me` devuelve el usuario del token `Authorization: Bearer <jwt>`.
- `POST` / `DELETE /api/v1/favorites/{property_id}` guarda o quita un favorito y `GET /api/v1/favorites` lista los del usuario (requieren token).
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

## Iniciar sesión y consultar el usuario actual

`POST /api/auth/login` acepta JSON `{"email": "...", "password": "..."}` (lo que usa el
frontend) o el formulario OAuth2 `username` + `password`. Por eso el botón
**Authorize** de [Swagger](http://localhost:8000/api/docs) funciona poniendo el email
como *username*. La respuesta `200` tiene la misma forma que la del registro.

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "persona@example.com", "password": "contrasenya-segura"}'

curl -s http://localhost:8000/api/auth/me -H "Authorization: Bearer <access_token>"
```

- Email inexistente, contraseña incorrecta o usuario desactivado: `401` con el mismo
  mensaje (`Correo electrónico o contraseña incorrectos`) y cabecera
  `WWW-Authenticate: Bearer`; no se revela qué emails existen.
- `GET /api/auth/me` sin token, con un token mal firmado o caducado, o de un usuario
  borrado o desactivado: `401`.
- El token caduca a los `ACCESS_TOKEN_EXPIRE_MINUTES` minutos. Para proteger otra ruta,
  añade el parámetro `user: CurrentUser` (de `app.api.routes.auth`).
- Sin `SECRET_KEY` configurada, login y `/me` devuelven `503`.

## Favoritos

Requieren `Authorization: Bearer <access_token>` (sin token o con uno no válido: `401`).

| Método y ruta | Respuesta |
|---|---|
| `POST /api/v1/favorites/{property_id}` | `201`. Si ya estaba guardado también `201` (no se duplica) |
| `DELETE /api/v1/favorites/{property_id}` | `204`. Si no estaba guardado también `204` |
| `GET /api/v1/favorites` | `200` `{"property_ids": [3, 1]}`, del más reciente al más antiguo |

Si el inmueble no existe: `404`. Al borrar un usuario o un inmueble se borran sus favoritos
(`ON DELETE CASCADE`, migración `003_create_favorites`).

Las pruebas de autenticación usan PostgreSQL con transacciones que se revierten al
terminar cada prueba; no borran los usuarios locales. Con la base de datos levantada:

```bash
alembic upgrade head
alembic heads
pytest --cov=app
```
