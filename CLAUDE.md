# CLAUDE.md – Repositorio UB-ES-2026-B2/Project

Portal inmobiliario (búsqueda de inmuebles con mapa, favoritos, contacto con anunciantes y publicación de anuncios). Proyecto de Ingeniería del Software, Grupo B2, Universitat de Barcelona. Scrum con sprints y demo final el **22 de diciembre de 2026**.

Todo lo que hay aquí sigue las diapositivas de la asignatura (CI/CD, Code Review, Advanced DevOps, Scrum, Planning, Kanban) y el artículo de Fowler sobre patrones de ramas (https://martinfowler.com/articles/branching-patterns.html). Si una decisión contradice esas directrices, hay que justificarla en `docs/decisiones.md`.

## Quién soy yo (Claude) en este repo

Trabajo para el **equipo de DevOps** (2 personas). Los equipos de backend y frontend son otros.

- **Mío:** `.github/`, `infra/`, `docker-compose*.yml`, `Dockerfile`s, `.gitignore`, `.gitattributes`, `.editorconfig`, `CLAUDE.md`, `README.md`, `docs/`.
- **No es mío:** el código de la aplicación en `backend/app/` y `frontend/src/`. No lo escribo ni lo modifico salvo que me lo pidan explícitamente. Si algo de su código rompe la CI, lo explico en la PR o al usuario; no lo arreglo por mi cuenta.
- Puedo crear **esqueletos mínimos** (un `main.py` con `/api/health`, un proyecto Vite vacío) solo para que la pipeline tenga algo que probar. Los marco con `# PLACEHOLDER DevOps` para que el otro equipo los sustituya.

## Estructura del repositorio (mono-repo)

Mono-repo porque, según la diapositiva de CI/CD, favorece la consistencia, y con un solo repo hay una sola pipeline.

```
Project/
├── CLAUDE.md                     # este fichero
├── README.md                     # cómo arrancar en local + badges de CI y despliegue
├── .gitignore
├── .gitattributes                # fuerza LF en scripts .sh (se ejecutan en Linux)
├── .editorconfig
├── .env.example                  # variables de entorno de ejemplo (sin valores reales)
├── docker-compose.yml            # desarrollo local: db + api
├── docker-compose.prod.yml       # EC2: un proyecto por entorno (staging y prod)
│
├── backend/                      # equipo backend · Python 3.12 + FastAPI
│   ├── Dockerfile                # DevOps · multi-stage, imagen linux/arm64
│   ├── docker-entrypoint.sh      # DevOps · alembic upgrade head + arranque
│   ├── .dockerignore
│   ├── pyproject.toml            # dependencias + config de ruff, pytest y cobertura
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/             # migraciones de la base de datos
│   ├── app/
│   │   ├── main.py               # crea la app FastAPI; todas las rutas bajo /api
│   │   ├── core/config.py        # configuración SOLO por variables de entorno (pydantic-settings)
│   │   ├── core/flags.py         # feature flags leídas de variables de entorno
│   │   ├── db/                   # sesión y modelo base de SQLAlchemy
│   │   ├── models/               # tablas
│   │   ├── schemas/              # modelos Pydantic de entrada/salida
│   │   ├── api/routes/           # un fichero por épica: listings, search, favorites, contacts, auth, map
│   │   └── services/             # lógica de negocio
│   └── tests/                    # pytest: unitarios y de API (prioridad API sobre interfaz)
│
├── frontend/                     # equipo frontend · React + Vite
│   ├── package.json
│   ├── package-lock.json         # obligatorio: la CI usa `npm ci`
│   ├── vite.config.(ts|js)       # proxy de /api a http://localhost:8000 en desarrollo
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.(tsx|jsx)
│       ├── App.(tsx|jsx)
│       ├── api/                  # llamadas a la API, siempre con rutas relativas /api/...
│       ├── pages/
│       ├── components/
│       └── hooks/
│
├── infra/                        # DevOps
│   ├── README.md                 # inventario de recursos AWS (ver sección AWS)
│   ├── bootstrap/                # JSON de los roles de Terraform (se crean a mano, una vez)
│   ├── terraform/                # infraestructura como código (ver sección IaC)
│   │   ├── main.tf               # provider + backend S3 (use_lockfile)
│   │   ├── variables.tf          # var.environments: un frontend por entorno
│   │   ├── outputs.tf
│   │   ├── s3.tf  cloudfront.tf  iam.tf  budget.tf  (ec2.tf  monitoring.tf pendientes)
│   │   ├── imports.tf            # recursos creados a mano antes de Terraform
│   │   ├── .checkov.yaml         # excepciones de Checkov justificadas
│   │   ├── functions/            # código de las CloudFront Functions
│   │   └── modules/site/         # bucket + CloudFront de un entorno
│   ├── ec2/
│   │   ├── user-data.sh          # arranque de la EC2: Docker, swap, SSM, agente de CloudWatch
│   │   └── deploy.sh             # despliegue con health check y rollback automático
│   └── scripts/
│       └── backup-db.sh          # pg_dump diario a S3
│
├── docs/                         # DevOps
│   ├── acuerdos.md               # acuerdo con backend y frontend (copia de la sección de abajo)
│   ├── arquitectura.md           # diagrama y explicación del despliegue
│   ├── decisiones.md             # decisiones que se apartan de las diapositivas y por qué
│   └── definition-of-done.md
│
└── .github/                      # DevOps
    ├── workflows/
    │   ├── ci.yml                # lint + tests + cobertura + build (PR y push)
    │   ├── security.yml          # CodeQL, Trivy, Checkov
    │   ├── deploy-staging.yml    # push a develop → staging
    │   ├── deploy-prod.yml       # push a main → producción
    │   └── terraform.yml         # plan en PR, apply manual
    ├── pull_request_template.md  # checklist de la Definition of Done
    ├── CODEOWNERS
    └── dependabot.yml
```

El `index.html` que hay ahora en la raíz es solo una prueba de AWS. Se borra cuando exista `frontend/`.

## Acuerdo con backend y frontend (lo que la pipeline da por hecho)

Si un equipo no cumple esto, la CI o el despliegue fallan. Cualquier cambio en esta lista se habla con DevOps primero.

**Backend**
- Todas las rutas cuelgan de `/api`. Existe `GET /api/health` que devuelve `{"status": "ok"}` con código 200 y comprueba la conexión a la base de datos.
- La configuración llega solo por variables de entorno (ver tabla). Nada de credenciales en el código.
- Migraciones con Alembic. El contenedor ejecuta `alembic upgrade head` al arrancar.
- Comandos, ejecutados desde `backend/`: `ruff check .`, `ruff format --check .`, `pytest --cov=app`.
- Las fotos no se guardan en disco: el backend genera URLs prefirmadas de S3 y el navegador sube directamente.
- Las funcionalidades a medias se ocultan con feature flags (`FEATURE_*`), no se dejan en ramas largas.
- Los logs van a la salida estándar (stdout), no a ficheros.

**Frontend**
- Vite, con el build en `frontend/dist`.
- La API se llama siempre con rutas relativas (`/api/...`). Nunca con una URL absoluta.
- Comandos, ejecutados desde `frontend/`: `npm ci`, `npm run lint`, `npm test` (vitest, sin modo watch, con cobertura), `npm run build`.

**Variables de entorno del backend**

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

## Desarrollo en local

- `docker compose up` levanta Postgres con PostGIS (imagen `postgis/postgis:16-3.4`) y la API en `http://localhost:8000`.
- En otra terminal: `cd frontend && npm run dev`. Abre en `http://localhost:5173`, y Vite redirige `/api` a la API.
- Crear un fichero `.env` a partir de `.env.example`. El `.env` nunca se sube al repo.
- Antes de abrir una PR, ejecutar en local los mismos comandos de lint y tests que la CI ("run tests locally" de la diapositiva de CI/CD).

## Ramas y flujo de trabajo

Feature branching con integración frecuente, siguiendo a Fowler y la diapositiva de CI/CD ("everyone integrates to the baseline every day").

- `main`: producción. Solo recibe merges desde `develop` mediante PR, antes de cada demo.
- `develop`: integración y staging. Recibe PRs de las ramas de trabajo y se despliega sola en staging.
- Ramas de trabajo: `feature/US-1.3-busqueda-ubicacion`, `fix/...`, `devops/...`. Siempre se crean desde `develop`.
- Las ramas de trabajo duran 1 o 2 días como mucho. Si una historia es más grande, se parte en PRs pequeñas y lo que no esté terminado se oculta con un feature flag.
- `main` y `develop` están protegidas: PR obligatoria, todos los checks en verde, al menos una revisión de alguien que no sea el autor, y la rama actualizada antes del merge.
- Mensajes de commit: `tipo(ámbito): descripción`, por ejemplo `ci(backend): añadir job de pytest` o `feat(search): filtro por precio`.
- Cada PR enlaza su tarjeta de Trello (US x.y) en la descripción.
- Cada corrección de un bug llega con un test que lo reproduce.

**Reglas para Claude:**
- Nunca hago push a `main` ni a `develop`. Trabajo en una rama `devops/...` y abro una PR contra `develop`.
- Los commits de prueba para la CI también van en una rama `devops/...`, nunca en las ramas protegidas.

## Uso de IA (diapositiva "IA generativa — Bones pràctiques")

- Todo commit generado con IA lleva la línea `Co-Authored-By: Claude ...` (trazabilidad).
- Toda PR con código generado por IA lleva la etiqueta `ai-generated`.
- Ninguna PR se mergea sin revisión humana (human-in-the-loop), aunque la haya escrito Claude.

## Definition of Done

Basada en la de las diapositivas de Scrum. Está en `docs/definition-of-done.md` y como checklist en `.github/pull_request_template.md`. Una historia está terminada cuando:

- [ ] Cumple los criterios de aceptación de su tarjeta de Trello.
- [ ] El código sigue los estándares (ruff y eslint pasan sin errores).
- [ ] Tiene tests automatizados y la cobertura no baja del mínimo.
- [ ] Una persona que no es el autor la ha revisado y aprobado.
- [ ] Todos los checks de CI y de seguridad están en verde.
- [ ] Está desplegada en staging y probada allí.
- [ ] La documentación afectada está actualizada.

## CI/CD

Prácticas de la diapositiva "CI/CD Best Practices" que esto cubre: build automatizado, build que se prueba solo, cada merge se compila, build rápido, pruebas en un clon de producción, entregables fáciles de obtener y resultados visibles para todos.

**`ci.yml`** — en cada PR contra `develop` o `main` y en cada push a `develop` y `main`:
- Job `backend`: Python 3.12 con caché de pip, ruff, pytest con un servicio de Postgres+PostGIS y cobertura con pytest-cov. Se salta si no existe `backend/pyproject.toml`.
- Job `frontend`: Node 20 con caché de npm, `npm ci`, lint, tests con cobertura y build. Se salta si no existe `frontend/package.json`.
- Filtros de rutas para que un cambio solo en `frontend/` no lance el job de backend, y al revés.
- Cobertura mínima: empieza en 60 % y se sube en cada sprint. El informe se publica como comentario o resumen en la PR.
- Los badges de CI y despliegue van en el `README.md`.

**`security.yml`** — Sec-DevOps "shift-left", en cada PR y una vez por semana:
- CodeQL para Python y JavaScript (análisis de seguridad del código; gratis en repos públicos).
- Trivy sobre la imagen Docker del backend y sobre las dependencias.
- Checkov sobre `infra/terraform/`.
- Además, en los ajustes del repo: secret scanning con push protection y alertas de Dependabot activadas.
- Un hallazgo de severidad alta o crítica bloquea el merge.

**`deploy-staging.yml`** — al hacer push a `develop`. **`deploy-prod.yml`** — al hacer push a `main`. Los dos hacen lo mismo contra su entorno:
- Frontend: build, `aws s3 sync frontend/dist s3://<bucket del entorno> --delete` e invalidación de su CloudFront.
- Backend: construir la imagen para arm64 en un runner `ubuntu-24.04-arm` y subirla a `ghcr.io/ub-es-2026-b2/project-backend`, etiquetada con el SHA del commit (y `staging` o `prod`).
- Desplegar en la EC2 con `aws ssm send-command`, que ejecuta `infra/ec2/deploy.sh <entorno> <sha>`. Sin SSH.
- `deploy.sh` arranca la nueva versión, llama a `/api/health` varias veces y, si falla, vuelve sola a la última versión buena (guardada en `/opt/app/<entorno>/.last-good`). El workflow falla para que se vea.
- Producción usa un environment de GitHub (`production`) que exige aprobación manual de un miembro de DevOps.

Credenciales: siempre OIDC, nunca claves de acceso en los secrets.

```yaml
permissions:
  id-token: write
  contents: read
  packages: write
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::891377256343:role/es-b2-github-deploy
      aws-region: eu-west-1
```

Entrega progresiva: las funcionalidades se activan con feature flags por entorno; primero en staging y después en producción. Con una sola EC2 no hacemos canary ni blue-green; está justificado en `docs/decisiones.md`.

## Entornos

| | Local | Staging | Producción |
|---|---|---|---|
| Rama | cualquiera | `develop` | `main` |
| Despliegue | manual (`docker compose up`) | automático | automático con aprobación |
| Frontend | Vite en `localhost:5173` | bucket y CloudFront de staging | `es-b2-frontend-891377256343` + `E2JFW10E80A64` |
| Backend | contenedor local | proyecto Compose `staging` en la EC2 | proyecto Compose `prod` en la EC2 |
| Base de datos | contenedor local | su propio Postgres en la EC2 | su propio Postgres en la EC2 |

Staging y producción comparten la misma EC2 para gastar lo mínimo, pero cada uno con su base de datos, su puerto y su CloudFront.

## Infraestructura como código

- Toda la infraestructura de AWS se define en `infra/terraform/` ("configuració d'entorns com a codi" de la diapositiva de DevOps).
- Un solo estado para todos los entornos (staging y prod comparten EC2, fotos, rol y presupuesto); lo propio de cada entorno es una instancia de `modules/site`. Justificado en `docs/decisiones.md` (D8).
- Estado de Terraform en un bucket de S3 (`es-b2-tfstate-891377256343`) con bloqueo nativo de S3 (`use_lockfile = true`), sin DynamoDB.
- Roles de OIDC: `es-b2-github-terraform-plan` (solo lectura, en PRs) y `es-b2-github-terraform-apply` (environment `terraform`, con aprobación).
- Los recursos que ya existen (tabla de abajo) se incorporan con bloques `import`, no se vuelven a crear.
- `terraform.yml`: fmt, validate, Checkov y plan en cada PR que toque `infra/terraform/`; el apply solo se lanza a mano y con aprobación.
- Mientras la migración no esté hecha, cualquier cambio manual en AWS se apunta en `infra/README.md`.

## Monitorización

- Alarma de CloudWatch sobre la comprobación de estado de la EC2, con recuperación automática.
- Logs de los contenedores a CloudWatch Logs con el driver `awslogs`, con 14 días de retención.
- Una alarma si `/api/health` de producción falla (comprobación sintética barata o métrica propia).
- Las alertas de presupuesto y de monitorización van al email del equipo de DevOps.

## Seguridad (Sec-DevOps)

- Mínimo privilegio: cada rol de IAM tiene solo los permisos que necesita (GitHub, EC2).
- Temporalmente, el acceso a AWS es con la cuenta root (con MFA), solo hasta crear usuarios IAM con MFA para DevOps y para Claude (ver `docs/decisiones.md`, D9).
- Los secretos de la aplicación (`SECRET_KEY`, contraseña de Postgres) viven en SSM Parameter Store como `SecureString`, nunca en el repo ni en los workflows.
- La EC2 solo acepta tráfico de CloudFront (lista de prefijos gestionada por AWS) y no tiene el puerto 22 abierto.
- Todo el tráfico público va por HTTPS a través de CloudFront.

## AWS (ya creado)

Cuenta `891377256343`, región `eu-west-1`. Todos los recursos llevan la etiqueta `project=es-b2`.

| Recurso | Valor |
|---|---|
| URL pública (prod) | https://d31v8l8u9lnbbr.cloudfront.net |
| CloudFront prod | `E2JFW10E80A64`. Por defecto sirve el frontend; `/media/*` sirve las fotos |
| Bucket frontend prod | `es-b2-frontend-891377256343` |
| Bucket fotos | `es-b2-media-891377256343` (CORS permite PUT desde la URL pública y `localhost:5173`) |
| Bucket copias | `es-b2-backups-891377256343` (borra a los 30 días) |
| Bucket estado Terraform | `es-b2-tfstate-891377256343` (versionado; fuera de Terraform) |
| Rol para GitHub | `arn:aws:iam::891377256343:role/es-b2-github-deploy` (subir frontend e invalidar caché). Confía en `refs/heads/main`, `refs/heads/develop` y `environment:*` |
| CloudFront Function | `es-b2-spa-rewrite`: rutas sin extensión → `/index.html` |
| Presupuesto | `es-b2-mensual`, 20 USD/mes (sin alertas por email todavía) |

**Pendiente:**
- Usuarios IAM con MFA para DevOps y para Claude, y dejar de usar root.
- Bucket, CloudFront y proyecto Compose de staging.
- EC2 t4g.micro (arm64) con IP elástica, Docker, SSM y agente de CloudWatch.
- Ruta `/api/*` en los dos CloudFront hacia la EC2, sin caché.
- Permisos `ssm:SendCommand` y de los buckets de staging en el rol de GitHub.
- Copia diaria de Postgres, alarma de recuperación, logs en CloudWatch y alertas del presupuesto.
- Roles `es-b2-github-terraform-plan` y `-apply` (JSON y comandos en `infra/bootstrap/` e `infra/README.md`) y primer apply de los imports (el código ya está en `infra/terraform/`).

**Reglas para Claude:**
- No creo, modifico ni borro recursos de AWS sin confirmación del usuario.
- Objetivo: gastar lo mínimo. Nada de NAT Gateway, balanceadores (ALB), EKS ni RDS.
- Cuando cambie algo en AWS, actualizo esta tabla y `infra/README.md`.

## Gestión del trabajo (Trello)

- Tablero ES - B2: https://trello.com/b/vqxFBKPS/es-b2
- Columnas tipo Kanban: Backlog, Sprint Backlog, En desarrollo, En revisión / test, Hecho, con límite de WIP en las de en curso (por ejemplo 2 por persona).
- Las tareas de DevOps también son tarjetas, con la etiqueta DevOps.

## Decisiones justificadas (resumen de `docs/decisiones.md`)

- **Monolito modular en lugar de microservicios.** Con 5-7 personas y tres meses, los microservicios añaden complejidad sin beneficio. Frontend y backend sí se despliegan por separado.
- **Una sola EC2 en lugar de Kubernetes o un orquestador.** Coste mínimo; la recuperación automática la da la alarma de CloudWatch.
- **Sin canary ni blue-green.** Con una sola máquina no tiene sentido; usamos staging, feature flags y rollback automático con health check.
- **GitFlow simplificado (`develop` + `main`) con ramas cortas.** Mantiene un entorno de staging sin perder la integración frecuente.

## Qué hacer primero (Sprint 0 de DevOps)

1. Crear la rama `develop` desde `main` y proteger las dos. Activar secret scanning, push protection y Dependabot en los ajustes del repo.
2. Añadir `.gitignore` (Python, Node, `.env`, `dist/`, `.terraform/`), `.editorconfig`, `.env.example`, `CODEOWNERS`, la plantilla de PR con la Definition of Done y `dependabot.yml`.
3. Crear `ci.yml` con los dos jobs condicionales, caché y cobertura.
4. Crear `security.yml` (CodeQL, Trivy, Checkov).
5. Crear `docker-compose.yml` de local y el `Dockerfile` del backend. Si backend aún no tiene código, añadir un esqueleto mínimo marcado `# PLACEHOLDER DevOps` con `/api/health`.
6. Crear `infra/terraform/` importando los recursos existentes, y `terraform.yml`.
7. Crear `deploy-staging.yml` y `deploy-prod.yml` con la parte del frontend; la del backend cuando exista la EC2.
8. Escribir `README.md` (con badges), `docs/acuerdos.md`, `docs/arquitectura.md`, `docs/decisiones.md` y `docs/definition-of-done.md`.
