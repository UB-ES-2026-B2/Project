# AGENTS.md

Instrucciones para los agentes de IA (Claude Code, Copilot, Cursor, Codex, Gemini…) que trabajen en este repositorio. Las personas tienen su guía en [CONTRIBUTING.md](CONTRIBUTING.md); este fichero dice lo mismo, pero pensado para un agente.

## Proyecto

Portal inmobiliario: búsqueda de inmuebles con mapa, favoritos, contacto con anunciantes y publicación de anuncios. Proyecto de Ingeniería del Software (Universitat de Barcelona), Grupo B2. Se trabaja con Scrum; el backlog y las historias de usuario están en Trello: https://trello.com/b/vqxFBKPS/es-b2

| Parte | Tecnología | Equipo responsable |
|---|---|---|
| `backend/` | Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL + PostGIS | Backend |
| `frontend/` | React 18, Vite 8, JavaScript (`.jsx`) y TypeScript (`.tsx`), Vitest + Testing Library (jsdom), ESLint | Frontend |
| `infra/`, `.github/`, `docker-compose.yml`, `Dockerfile`s, `docs/` | Terraform, GitHub Actions, AWS (S3, CloudFront, EC2) | DevOps |

## Estado actual (Sprint 1)

- Todo tiene que funcionar **en local**: la API y la base de datos con `docker compose up --build`, y el frontend con `npm run dev`. Una tarea está terminada cuando funciona así y pasa los comandos de la CI.
- **AWS no se usa en este sprint.** No despliegues, no añadas pasos que dependan de AWS y no des por hecho que hay staging o producción para probar.

## Estructura

```
backend/
  app/main.py            # app FastAPI; todas las rutas bajo /api (ahora es el esqueleto de DevOps con /api/health)
  tests/                 # pytest
  pyproject.toml         # dependencias y configuración de ruff, pytest y cobertura
  Dockerfile             # DevOps
  docker-entrypoint.sh   # DevOps: `alembic upgrade head` (si existe alembic.ini) y arranque
                         # alembic.ini y alembic/versions/ todavía no existen: llegan con `alembic init`
frontend/
  index.html             # punto de entrada de Vite
  src/                   # main.jsx, App.jsx (+ App.test.jsx), styles.css
  components/            # componentes por funcionalidad, fuera de src/ (p. ej. catalog/: PropertyCard.tsx, useProperties.js)
  package.json           # scripts: dev, build, lint, typecheck, test
  package-lock.json      # obligatorio: la CI usa `npm ci`
  vite.config.js         # proxy /api -> localhost:8000 y configuración de vitest (jsdom, cobertura)
  test-setup.js          # setup de vitest: jest-dom y limpieza entre tests
  eslint.config.js       # reglas de ESLint para .js/.jsx y .tsx
  tsconfig.json          # configuración de TypeScript para `npm run typecheck`
infra/terraform/         # infraestructura de AWS como código (DevOps)
.github/workflows/       # CI, seguridad, Terraform y despliegue (DevOps)
docs/                    # arquitectura, decisiones, acuerdos, Definition of Done
docker-compose.yml       # entorno local: PostgreSQL + PostGIS y la API (DevOps)
.env.example             # variables de entorno de ejemplo, sin valores reales
CONTRIBUTING.md          # guía de trabajo para las personas del equipo
```

## Comandos

Ejecuta siempre los mismos comandos que la CI antes de dar una tarea por terminada.

**Entorno local** (desde la raíz): `docker compose up --build` levanta PostgreSQL + PostGIS y la API en http://localhost:8000 (documentación en `/api/docs`).

**Backend** (desde `backend/`, con la base de datos levantada: `docker compose up -d db`):

```bash
pip install -e ".[dev]"
ruff check .
ruff format --check .        # `ruff format .` para corregir
pytest --cov=app             # necesita DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
alembic heads                # cuando exista alembic.ini: debe devolver una sola línea
```

**Frontend** (desde `frontend/`):

```bash
npm ci
npm run lint
npm run typecheck            # tsc --noEmit sobre src/ y components/
npm test                     # vitest run --coverage
npm run build                # genera frontend/dist
npm run dev                  # http://localhost:5173
```

## Reglas que la CI y el despliegue dan por hechas

**Backend**
- Todas las rutas empiezan por `/api`.
- `GET /api/health` debe existir y devolver `{"status": "ok"}` con código 200 si la base de datos responde. El healthcheck del contenedor y el rollback automático del despliegue dependen de ello. No lo borres ni cambies su respuesta.
- La configuración llega solo por variables de entorno (`APP_ENV`, `DATABASE_URL`, `SECRET_KEY`, `MEDIA_BUCKET`, `MEDIA_BASE_URL`, `AWS_REGION`, `CORS_ORIGINS`, `FEATURE_*`). Ver `.env.example`. Nunca escribas credenciales en el código.
- Las dependencias van en `pyproject.toml` (`dependencies`; las de test, en el extra `dev`). El Dockerfile las lee de ahí.
- Cambios en la base de datos: siempre con una migración de Alembic. Antes de terminar, comprueba que `alembic heads` devuelve un solo head; si hay dos, une las migraciones.
- Las fotos no se guardan en disco: el backend genera URLs prefirmadas de S3 y el navegador sube directamente.
- Los logs van a la salida estándar.
- Cobertura mínima: 60 % (`fail_under` en `pyproject.toml`).

**Frontend**
- Las llamadas a la API usan rutas relativas (`fetch('/api/...')`), nunca `http://localhost:8000` ni otra URL absoluta.
- Cada componente nuevo lleva su test con Vitest y Testing Library, junto al componente (`Componente.test.jsx`).
- Sube siempre `package-lock.json`; la CI usa `npm ci`.
- No subas `dist/` ni `node_modules/`.

## Ramas, commits y PRs

- `main` es producción y `develop` es integración/pruebas. **Nunca hagas commit ni push directamente a `main` ni a `develop`.**
- Crea una rama desde `develop` por tarea: `feature/US-<x.y>-<descripcion>`, `fix/<descripcion>` o `devops/<descripcion>`.
- Mensajes de commit: `tipo(ámbito): descripción`, con tipo `feat`, `fix`, `test`, `refactor`, `docs`, `ci`, `build` o `chore`. Ejemplo: `feat(search): filtro por precio`.
- Todo entra en `develop` mediante una PR que rellena la plantilla (`.github/pull_request_template.md`), enlaza su tarjeta de Trello y cumple la Definition of Done (`docs/definition-of-done.md`).
- La PR se mergea solo con todos los checks en verde y la aprobación de una persona que no sea el autor.
- Nunca uses `git push --force`.

## Límites

- Trabaja solo en la carpeta del equipo para el que haces la tarea. No modifiques `infra/`, `.github/`, `docker-compose.yml`, los `Dockerfile` ni `docs/` salvo que la tarea sea de DevOps; si hace falta un cambio ahí, dilo en vez de hacerlo.
- No cambies el contrato con la pipeline (rutas `/api`, `/api/health`, variables de entorno, scripts de `package.json`, comandos de test) sin que DevOps lo apruebe. Está documentado en `docs/acuerdos.md`.
- No crees ni modifiques recursos de AWS. La infraestructura solo cambia mediante Terraform y PR.
- No subas secretos: `.env`, claves, tokens ni contraseñas. El `.gitignore` ya los excluye; no lo fuerces con `git add -f`.
- No desactives ni te saltes tests, lint ni checks de seguridad para que la CI pase. Arregla la causa.

## Uso de IA en este proyecto

Siguiendo las buenas prácticas de la asignatura (trazabilidad y revisión humana):

- Todo commit con código generado por IA lleva la línea `Co-Authored-By:` del agente.
- Toda PR con código generado por IA lleva la etiqueta `ai-generated`.
- Ninguna PR se mergea sin la revisión de una persona. El agente no aprueba ni mergea PRs por su cuenta.
- La persona que sube el código tiene que entenderlo y poder explicarlo.

## Claude Code

Claude Code lee `CLAUDE.md`, no este fichero. `CLAUDE.md` es personal y está en el `.gitignore`. Para que Claude Code siga estas reglas, crea tu propio `CLAUDE.md` en la raíz con esta línea al principio:

```
@AGENTS.md
```

Debajo puedes añadir tus instrucciones personales.
