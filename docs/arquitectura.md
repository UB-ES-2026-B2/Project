# Arquitectura y despliegue

> Las piezas marcadas como *(pendiente)* todavía no existen en AWS. Ver la lista de pendientes en [`infra/README.md`](../infra/README.md#pendiente).

## Vista general

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| CF

    subgraph AWS["AWS · eu-west-1"]
        CF["CloudFront<br/>(uno por entorno)"]
        S3F[("S3 frontend<br/>SPA de Vite")]
        S3M[("S3 media<br/>fotos")]
        S3B[("S3 copias<br/>30 días")]
        subgraph EC2["EC2 t4g.micro · arm64"]
            direction TB
            P["Compose prod<br/>api + postgres"]
            S["Compose staging<br/>api + postgres (pendiente)"]
        end
        SSM["SSM<br/>Run Command + Parameter Store"]
        CW["CloudWatch<br/>logs + alarmas"]
    end

    CF -->|"/* (por defecto)"| S3F
    CF -->|"/media/*"| S3M
    CF -->|"/api/* sin caché"| EC2
    U -.->|PUT con URL prefirmada| S3M
    EC2 -.->|pg_dump diario| S3B
    EC2 -.-> CW

    subgraph GH[GitHub]
        A["Actions<br/>CI · Security · Deploy"]
    end
    A -->|"OIDC · s3 sync"| S3F
    A -->|invalidación| CF
    A -->|"OIDC · send-command"| SSM
    SSM -->|build-and-deploy.sh| EC2
    EC2 -->|descarga el commit| GH
```

## Peticiones

| Ruta | Destino | Caché |
|---|---|---|
| `/*` | Bucket del frontend. La función `es-b2-spa-rewrite` reescribe las rutas sin extensión a `/index.html`. | Sí |
| `/media/*` | Bucket de fotos | Sí |
| `/api/*` | EC2, al proyecto Compose del entorno (prod: puerto 8000) | No |

El navegador solo ve un dominio por entorno. Por eso el frontend llama a `/api/...` con rutas relativas y no hace falta CORS fuera de local.

Las fotos no pasan por el backend. La API genera una URL prefirmada y el navegador hace `PUT` directamente a S3.

## Del commit a producción

1. **PR contra `develop`**: se ejecutan `CI` (lint, tests, cobertura y build de la imagen arm64) y `Security` (CodeQL, Trivy y Checkov). Hace falta que estén en verde y la revisión de otra persona.
2. **Merge a `develop`**: `Deploy staging` despliega sola en staging. Ahí se prueba la historia (Definition of Done).
3. **PR de `develop` a `main`** antes de cada demo, con los mismos checks.
4. **Merge a `main`**: `Deploy prod` espera la aprobación de DevOps (environment `production`) y despliega.

Los dos despliegues usan el mismo workflow reutilizable ([`_deploy.yml`](../.github/workflows/_deploy.yml)) con distintos parámetros. Así staging es un clon fiel de producción.

### Backend

Job `backend` de [`_deploy.yml`](../.github/workflows/_deploy.yml). Va antes que el frontend: si falla, el frontend no se publica.

1. `aws ssm send-command` (rol OIDC `es-b2-github-deploy`) ejecuta en la EC2 [`infra/ec2/build-and-deploy.sh`](../infra/ec2/build-and-deploy.sh) `<entorno> <sha>`. No hay SSH ni puerto 22.
2. La EC2 descarga ese commit del repo, copia `docker-compose.prod.yml` y `deploy.sh` a `/opt/app/<entorno>/` y construye la imagen (sin registro; ver `docs/decisiones.md`, D11).
3. [`deploy.sh`](../infra/ec2/deploy.sh) lee los secretos de SSM, arranca la versión nueva (el contenedor aplica las migraciones de Alembic al arrancar) y llama a `/api/health` durante ~2 minutos. Si falla, vuelve a la versión de `/opt/app/<entorno>/.last-good` y el workflow sale en rojo.
4. El workflow comprueba también `/api/health` a través de CloudFront.

Ahora mismo solo está activo para producción (`deploy-prod.yml`). Staging se salta hasta que existan sus secretos y su CloudFront.

## Credenciales

- **GitHub → AWS:** OIDC con el rol `es-b2-github-deploy`. No hay claves de acceso guardadas en ningún sitio.
- **Aplicación:** los secretos (`SECRET_KEY`, contraseña de Postgres) se guardan en SSM Parameter Store como `SecureString`. La EC2 los lee al desplegar.

## Entornos

| | Local | Staging | Producción |
|---|---|---|---|
| Rama | cualquiera | `develop` | `main` |
| Despliegue | `docker compose up` | automático | automático con aprobación |
| Frontend | Vite (`localhost:5173`) | bucket + CloudFront de staging *(pendiente)* | `es-b2-frontend-891377256343` + `E2JFW10E80A64` |
| Backend + BD | contenedores locales | proyecto Compose `staging` en la EC2 | proyecto Compose `prod` en la EC2 |
