# Acuerdos entre backend, frontend y DevOps

La CI y el despliegue dan por hecho todo lo que hay en esta página. Si un equipo no lo cumple, la pipeline falla.

**Cualquier cambio en esta lista se habla antes con DevOps** y se actualiza aquí en la misma PR.

## Backend

- Todas las rutas cuelgan de `/api`. En staging y producción, CloudFront envía `/api/*` al backend y todo lo demás al frontend.
- Existe `GET /api/health`. Devuelve `{"status": "ok"}` con código 200 **y comprueba la conexión a la base de datos**: si la base de datos no responde, devuelve un código de error (503). Lo usan el healthcheck del contenedor y el rollback automático del despliegue.
- La configuración llega **solo por variables de entorno** (ver la tabla). Nada de credenciales en el código.
- Las migraciones se hacen con Alembic. El contenedor ejecuta `alembic upgrade head` al arrancar, así que cada cambio en la base de datos debe llevar su migración.
- Comandos que ejecuta la CI desde `backend/`:
  - `pip install -e ".[dev]"`: las dependencias van en `pyproject.toml`, y las de desarrollo (ruff, pytest, pytest-cov...) en el extra `dev`.
  - `ruff check .`
  - `ruff format --check .`
  - `pytest --cov=app`: el mínimo de cobertura está en `pyproject.toml` (`[tool.coverage.report] fail_under`).
- Las fotos no se guardan en disco. El backend genera URLs prefirmadas de S3 y el navegador sube las fotos directamente al bucket. Se sirven bajo `MEDIA_BASE_URL` (`/media/...`).
- Las funcionalidades a medias se ocultan con **feature flags** (`FEATURE_<NOMBRE>`, leídas en `app/core/flags.py`), no se dejan en ramas largas.
- Los logs van a la **salida estándar** (stdout), no a ficheros. En la EC2 se envían a CloudWatch.
- La imagen Docker debe construir para `linux/arm64`. Si añadís una dependencia con código nativo, comprobad que tiene wheels para arm64.

## Frontend

- Se usa Vite, y el build sale en `frontend/dist`.
- La API se llama siempre con rutas relativas (`/api/...`), nunca con una URL absoluta. En local, Vite hace de proxy de `/api` a `http://localhost:8000`, y en staging y producción lo hace CloudFront.
- `package-lock.json` se sube siempre al repo, porque la CI usa `npm ci`.
- Comandos que ejecuta la CI desde `frontend/`:
  - `npm ci`
  - `npm run lint`
  - `npm test`: vitest **sin modo watch y con cobertura**, por ejemplo `"test": "vitest run --coverage"`. Si configuráis el reporter `json-summary`, la CI publica el resumen en la PR.
  - `npm run build`
- Las rutas de la SPA no deben tener extensión (`/inmueble/42`, no `/inmueble/42.html`). CloudFront reescribe las rutas sin extensión a `/index.html`.

## Variables de entorno del backend

| Variable | Ejemplo en local | Uso |
|---|---|---|
| `APP_ENV` | `local` | `local`, `staging` o `prod` |
| `DATABASE_URL` | `postgresql+psycopg://app:app@db:5432/app` | Conexión a Postgres |
| `MEDIA_BUCKET` | `es-b2-media-891377256343` | Bucket de fotos |
| `MEDIA_BASE_URL` | `/media` | Prefijo público de las fotos |
| `AWS_REGION` | `eu-west-1` | Región de AWS |
| `SECRET_KEY` | `cambiar-en-local` | Firma de tokens de sesión |
| `CORS_ORIGINS` | `http://localhost:5173` | Solo para desarrollo local |
| `FEATURE_<NOMBRE>` | `false` | Feature flags |

- **En local** salen de `.env` (copia de [`.env.example`](../.env.example)) o de los valores por defecto de `docker-compose.yml`.
- **En staging y producción** las pone DevOps en la EC2. Los secretos (`SECRET_KEY`, la contraseña de Postgres) vienen de SSM Parameter Store.

## Ramas y PRs

- Las ramas de trabajo se crean desde `develop` (`feature/US-x.y-descripcion`, `fix/...`, `devops/...`) y duran 1 o 2 días como mucho.
- Todas las PRs van contra `develop`. De `develop` a `main` solo se pasa antes de cada demo.
- Cada PR enlaza su tarjeta de Trello.
- Para hacer merge se necesitan todos los checks en verde, la revisión de alguien que no sea el autor y la rama actualizada.
- Commits: `tipo(ámbito): descripción`, por ejemplo `feat(search): filtro por precio`.
- Lo que se cuenta como terminado está en la [Definition of Done](definition-of-done.md).
