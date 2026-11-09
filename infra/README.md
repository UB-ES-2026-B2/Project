# Infraestructura (AWS)

Cuenta `891377256343`, región `eu-west-1`. Todos los recursos llevan la etiqueta `project=es-b2`. Está todo definido en [`terraform/`](terraform/), y los recursos que se crearon a mano se incorporan con bloques `import` ([`imports.tf`](terraform/imports.tf)).

## Inventario

| Recurso | ID / nombre | En Terraform |
|---|---|---|
| CloudFront prod | `E2JFW10E80A64` → https://d31v8l8u9lnbbr.cloudfront.net | `module.site["prod"].aws_cloudfront_distribution.this` |
| Bucket frontend prod | `es-b2-frontend-891377256343` | `module.site["prod"].aws_s3_bucket.frontend` |
| Bucket fotos | `es-b2-media-891377256343` (CORS: PUT/GET desde CloudFront y `localhost:5173`) | `aws_s3_bucket.media` |
| Bucket copias | `es-b2-backups-891377256343` (caducan a los 30 días) | `aws_s3_bucket.backups` |
| OAC | `E3JFTN9XCQM9SW` (`es-b2-s3-oac`) | `aws_cloudfront_origin_access_control.s3` |
| CloudFront Function | `es-b2-spa-rewrite` | `aws_cloudfront_function.spa_rewrite` |
| Proveedor OIDC de GitHub | `token.actions.githubusercontent.com` | `aws_iam_openid_connect_provider.github` |
| Rol de despliegue | `es-b2-github-deploy` (+ políticas en línea `deploy-frontend` y `deploy-backend`: `ssm:SendCommand` solo sobre la EC2) | `aws_iam_role.github_deploy` (falta `deploy-backend`) |
| Presupuesto | `es-b2-mensual`, 20 USD/mes, avisos al 50/80/100 % y previsión del 100 % | `aws_budgets_budget.monthly` |
| EC2 backend | `i-04f75768fd53ac2e8` (t4g.micro, Amazon Linux 2023 arm64), rol `es-b2-ec2` | No (a mano) |
| IP elástica | `34.248.127.190` | No (a mano) |
| Security group | `sg-0870449e9837d99d4` (puertos 8000-8001 solo desde la lista de prefijos de CloudFront `pl-4fa04526`; sin SSH) | No (a mano) |
| Secretos | SSM `/es-b2/prod/POSTGRES_PASSWORD` y `/es-b2/prod/SECRET_KEY` (`SecureString`) | No (a mano) |
| Logs | CloudWatch `/es-b2/prod` (14 días) | No (a mano) |
| Alarma | `es-b2-app-auto-recover` (recupera la EC2 si falla el host) | No (a mano) |
| Bucket del estado de Terraform | `es-b2-tfstate-891377256343` (privado, AES256, versionado) | No: es el arranque |
| Rol de `terraform plan` | `es-b2-github-terraform-plan` | No: es el arranque |
| Rol de `terraform apply` | `es-b2-github-terraform-apply` | No: es el arranque |

## Cambios manuales

Mientras la migración a Terraform no esté aplicada, cualquier cambio hecho a mano en AWS se apunta aquí (fecha, quién y qué).

| Fecha | Quién | Cambio |
|---|---|---|
| 2026-10-06 | DevOps | Creación inicial de buckets, CloudFront, OAC, función, OIDC, rol de GitHub y presupuesto |
| 2026-10-06 | Claude (con root) | Bucket del estado `es-b2-tfstate-891377256343`: privado, AES256, versionado y etiqueta `project=es-b2` |
| 2026-10-07 | DevOps (CloudShell) | Confianza de los tres roles (`es-b2-github-deploy`, `es-b2-github-terraform-plan`, `es-b2-github-terraform-apply`) cambiada al formato de sub con IDs inmutables: `repo:UB-ES-2026-B2@335691788/Project@1407787603:<contexto>` |
| 2026-10-26 | DevOps + Claude | EC2, IP elástica, security group, rol `es-b2-ec2`, secretos en SSM, logs, alarma de recuperación, ruta `/api/*` del CloudFront y política `deploy-backend`. Backend de `main` arrancado a mano (proyecto Compose `es-b2-prod`) |
| 2026-11-01 | Claude | Alertas del presupuesto por correo y cabecera de caché de `/media/*` (US 1.1.3) |

## Arranque (una sola vez)

Terraform no puede crear el bucket donde guarda su propio estado ni los roles con los que se ejecuta. Esto se crea a mano:

> **Formato del `sub` de OIDC.** GitHub envía `repo:<org>@<id org>/<repo>@<id repo>:<contexto>`, aquí `repo:UB-ES-2026-B2@335691788/Project@1407787603:<contexto>`. Las condiciones de confianza deben usar ese formato; con `repo:UB-ES-2026-B2/Project:...` la asunción del rol falla. Ver `docs/decisiones.md`, D10.

1. **Bucket del estado** `es-b2-tfstate-891377256343`: privado, cifrado y con versionado, para poder recuperar un estado roto. ✅ Creado.
2. **Rol `es-b2-github-terraform-plan`**:
   - Confía en `repo:UB-ES-2026-B2@335691788/Project@1407787603:pull_request`.
   - Tiene `ReadOnlyAccess`, más escritura de los ficheros `.tflock` en el bucket del estado.
   - Tiene una denegación explícita de lectura de los objetos de los buckets de fotos y copias, para que el código de una PR no pueda leer los volcados de la base de datos.
   - También tiene denegados los secretos (`secretsmanager:GetSecretValue`, `kms:Decrypt`).
3. **Rol `es-b2-github-terraform-apply`**: solo confía en `repo:UB-ES-2026-B2@335691788/Project@1407787603:environment:terraform`. En GitHub, ese environment exige la aprobación de DevOps y solo admite `main`.

✅ Los dos roles existen (comprobado el 2026-10-07).

Para crear los dos roles: abre **AWS CloudShell** (icono `>_` arriba a la derecha de la consola, en `eu-west-1`), sube los tres JSON de [`bootstrap/`](bootstrap/) con *Actions → Upload file* y ejecuta:

```bash
aws iam create-role --role-name es-b2-github-terraform-plan \
  --assume-role-policy-document file://trust-terraform-plan.json \
  --description "terraform plan desde PRs de GitHub Actions (UB-ES-2026-B2/Project)" \
  --tags Key=project,Value=es-b2
aws iam attach-role-policy --role-name es-b2-github-terraform-plan \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
aws iam put-role-policy --role-name es-b2-github-terraform-plan \
  --policy-name tfstate-lock-and-deny-data \
  --policy-document file://policy-terraform-plan.json

aws iam create-role --role-name es-b2-github-terraform-apply \
  --assume-role-policy-document file://trust-terraform-apply.json \
  --description "terraform apply desde GitHub Actions, environment terraform (UB-ES-2026-B2/Project)" \
  --tags Key=project,Value=es-b2
aws iam attach-role-policy --role-name es-b2-github-terraform-apply \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

## Trabajar con Terraform

En local, con credenciales de AWS configuradas:

```bash
cd infra/terraform
terraform init
terraform plan        # lo mismo que publica la CI en cada PR
```

El `apply` no se hace en local. Se hace desde GitHub Actions: *Terraform* → *Run workflow* en `main` con `apply` marcado, y requiere aprobación.

Después de `terraform init`, sube `.terraform.lock.hcl` al repo: fija las versiones de los providers.

### Añadir staging

Añade la entrada `staging` a `var.environments` en [`variables.tf`](terraform/variables.tf). El plan creará su bucket y su CloudFront, y añadirá la distribución nueva a la política del bucket de fotos, a su CORS y al rol de despliegue. Después, rellena los valores en [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml).

## Pendiente

- Usuarios IAM con MFA para DevOps y para Claude, y dejar de usar root (ver `docs/decisiones.md`, D9).
- Staging (bucket + CloudFront).
- Pasar a Terraform lo creado a mano el 26/10 (`ec2.tf`, `monitoring.tf` y la política `deploy-backend`).
- Alarma de `/api/health`.
- Copia diaria de Postgres al bucket de copias.
- Backend de staging: secretos `/es-b2/staging/*` y rellenar `ec2_instance` en `deploy-staging.yml`.

## Backend en la EC2

- Cada merge a `main` despliega el backend solo (workflow *Deploy prod*, con la aprobación del environment `production`). Ver [`docs/arquitectura.md`](../docs/arquitectura.md#backend).
- En la EC2: `/opt/app/prod/` tiene `docker-compose.prod.yml`, `deploy.sh` y `.last-good` (última versión que pasó el health check).
- Ver qué está corriendo, sin SSH: *Systems Manager → Run Command → AWS-RunShellScript* con `docker ps` y `cat /opt/app/prod/.last-good`.
- Volver a desplegar una versión concreta: *Actions → Deploy prod → Run workflow* (desde `main`), o por Run Command `SKIP_PULL=1 /opt/app/prod/deploy.sh prod <sha>` si esa imagen sigue en la EC2.
- Limitar la confianza del rol de despliegue a `environment:production` y `environment:staging`, en lugar de `environment:*`.
