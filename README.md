# ES-B2 · Portal inmobiliario

[![CI](https://github.com/UB-ES-2026-B2/dev/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/UB-ES-2026-B2/dev/actions/workflows/ci.yml)
[![Security](https://github.com/UB-ES-2026-B2/dev/actions/workflows/security.yml/badge.svg?branch=develop)](https://github.com/UB-ES-2026-B2/dev/actions/workflows/security.yml)
[![Deploy staging](https://github.com/UB-ES-2026-B2/dev/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/UB-ES-2026-B2/dev/actions/workflows/deploy-staging.yml)
[![Deploy prod](https://github.com/UB-ES-2026-B2/dev/actions/workflows/deploy-prod.yml/badge.svg)](https://github.com/UB-ES-2026-B2/dev/actions/workflows/deploy-prod.yml)

Proyecto de Ingeniería del Software (UB), Grupo B2. Búsqueda de inmuebles con mapa, favoritos, contacto con anunciantes y publicación de anuncios.

- **Producción:** https://d31v8l8u9lnbbr.cloudfront.net
- **Staging:** *(pendiente)*
- **Tablero:** [Trello ES - B2](https://trello.com/b/vqxFBKPS/es-b2)
- **Stack:** FastAPI (Python 3.12) + PostgreSQL/PostGIS · React + Vite · AWS (S3, CloudFront y EC2)

| Documento | Para qué |
|---|---|
| [docs/acuerdos.md](docs/acuerdos.md) | Lo que la CI y el despliegue dan por hecho de backend y frontend |
| [docs/definition-of-done.md](docs/definition-of-done.md) | Cuándo una historia está terminada |
| [docs/arquitectura.md](docs/arquitectura.md) | Cómo se despliega y por dónde pasan las peticiones |
| [docs/decisiones.md](docs/decisiones.md) | Decisiones que se apartan de las diapositivas y por qué |

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye `docker compose`)
- Node.js 20 y npm (para el frontend)
- Python 3.12 (para ejecutar ruff y pytest antes de abrir una PR)

## Arrancar en local

```bash
git clone https://github.com/UB-ES-2026-B2/dev.git
cd dev
cp .env.example .env          # opcional: sin .env se usan los mismos valores por defecto
docker compose up --build
```

Esto levanta:

| Servicio | URL | Notas |
|---|---|---|
| API | http://localhost:8000/api/health | Debe devolver `{"status": "ok"}` (comprueba también la base de datos) |
| Documentación de la API | http://localhost:8000/api/docs | Swagger generado por FastAPI |
| Postgres + PostGIS | `localhost:5432` | Usuario, contraseña y base de datos: `app` |

El código de `backend/` está montado en el contenedor, así que la API se recarga al guardar. Al arrancar, el contenedor ejecuta `alembic upgrade head`.

Las feature flags se activan en el `.env`, por ejemplo `FEATURE_MAPA=true`, y se aplican con `docker compose up` otra vez.

En otra terminal, el frontend:

```bash
cd frontend
npm ci
npm run dev                   # http://localhost:5173 (Vite redirige /api a la API)
```

Para parar todo: `docker compose down`. Para borrar también la base de datos: `docker compose down -v`.

## Antes de abrir una PR: los mismos comandos que la CI

**Backend** (desde `backend/`, con la base de datos levantada: `docker compose up -d db`):

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
export DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app   # PowerShell: $env:DATABASE_URL="..."
ruff check .
ruff format --check .         # `ruff format .` para corregirlo
pytest --cov=app
```

**Frontend** (desde `frontend/`):

```bash
npm ci
npm run lint
npm test
npm run build
```

## Ramas y PRs

- `main`: producción. `develop`: integración y staging.
- Las ramas de trabajo salen de `develop` y duran 1 o 2 días: `feature/US-1.3-busqueda-ubicacion`, `fix/...`, `devops/...`.
- Cada PR va contra `develop`, enlaza su tarjeta de Trello y cumple la [Definition of Done](docs/definition-of-done.md).
- Commits: `tipo(ámbito): descripción`, por ejemplo `feat(search): filtro por precio`.
- Si una PR tiene código generado con IA, lleva la etiqueta `ai-generated` y la línea `Co-Authored-By` en los commits. Siempre la revisa una persona.

## CI/CD

| Workflow | Cuándo | Qué hace |
|---|---|---|
| [CI](.github/workflows/ci.yml) | PR y push a `develop`/`main` | Backend: ruff, pytest con Postgres+PostGIS y cobertura (mínimo 60 %), y build de la imagen arm64. Frontend: lint, tests con cobertura y build. En las PRs, cada parte solo se ejecuta si cambian sus ficheros. |
| [Security](.github/workflows/security.yml) | PR, push y cada lunes | CodeQL, Trivy (dependencias e imagen) y Checkov (Terraform). Un hallazgo alto o crítico bloquea el merge. |
| [Deploy staging](.github/workflows/deploy-staging.yml) | Push a `develop` | Frontend a S3 + CloudFront de staging. Backend, cuando exista la EC2. |
| [Deploy prod](.github/workflows/deploy-prod.yml) | Push a `main` | Lo mismo contra producción, con la aprobación de DevOps. |

## Estructura

```
backend/    API FastAPI (equipo backend)
frontend/   React + Vite (equipo frontend)
infra/      Terraform y scripts de la EC2 (DevOps)
docs/       Arquitectura, acuerdos, decisiones y Definition of Done
.github/    CI/CD, plantilla de PR, CODEOWNERS, Dependabot
```
