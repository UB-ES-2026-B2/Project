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
| Rol de despliegue | `es-b2-github-deploy` (+ política en línea `deploy-frontend`) | `aws_iam_role.github_deploy` |
| Presupuesto | `es-b2-mensual`, 20 USD/mes, sin alertas | `aws_budgets_budget.monthly` |
| Bucket del estado de Terraform | `es-b2-tfstate-891377256343` (privado, AES256, versionado) | No: es el arranque |
| Rol de `terraform plan` | `es-b2-github-terraform-plan` *(pendiente de crear)* | No: es el arranque |
| Rol de `terraform apply` | `es-b2-github-terraform-apply` *(pendiente de crear)* | No: es el arranque |

## Cambios manuales

Mientras la migración a Terraform no esté aplicada, cualquier cambio hecho a mano en AWS se apunta aquí (fecha, quién y qué).

| Fecha | Quién | Cambio |
|---|---|---|
| 2026-10-06 | DevOps | Creación inicial de buckets, CloudFront, OAC, función, OIDC, rol de GitHub y presupuesto |
| 2026-10-06 | Claude (con root) | Bucket del estado `es-b2-tfstate-891377256343`: privado, AES256, versionado y etiqueta `project=es-b2` |

## Arranque (una sola vez)

Terraform no puede crear el bucket donde guarda su propio estado ni los roles con los que se ejecuta. Esto se crea a mano:

1. **Bucket del estado** `es-b2-tfstate-891377256343`: privado, cifrado y con versionado, para poder recuperar un estado roto. ✅ Creado.
2. **Rol `es-b2-github-terraform-plan`**:
   - Confía en `repo:UB-ES-2026-B2/dev:pull_request`.
   - Tiene `ReadOnlyAccess`, más escritura de los ficheros `.tflock` en el bucket del estado.
   - Tiene una denegación explícita de lectura de los objetos de los buckets de fotos y copias, para que el código de una PR no pueda leer los volcados de la base de datos.
   - También tiene denegados los secretos (`secretsmanager:GetSecretValue`, `kms:Decrypt`).
3. **Rol `es-b2-github-terraform-apply`**: solo confía en `repo:UB-ES-2026-B2/dev:environment:terraform`. En GitHub, ese environment exige la aprobación de DevOps y solo admite `main`.

Para crear los dos roles: abre **AWS CloudShell** (icono `>_` arriba a la derecha de la consola, en `eu-west-1`), sube los tres JSON de [`bootstrap/`](bootstrap/) con *Actions → Upload file* y ejecuta:

```bash
aws iam create-role --role-name es-b2-github-terraform-plan \
  --assume-role-policy-document file://trust-terraform-plan.json \
  --description "terraform plan desde PRs de GitHub Actions (UB-ES-2026-B2/dev)" \
  --tags Key=project,Value=es-b2
aws iam attach-role-policy --role-name es-b2-github-terraform-plan \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
aws iam put-role-policy --role-name es-b2-github-terraform-plan \
  --policy-name tfstate-lock-and-deny-data \
  --policy-document file://policy-terraform-plan.json

aws iam create-role --role-name es-b2-github-terraform-apply \
  --assume-role-policy-document file://trust-terraform-apply.json \
  --description "terraform apply desde GitHub Actions, environment terraform (UB-ES-2026-B2/dev)" \
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

- Arranque (ver arriba).
- Staging (bucket + CloudFront).
- `ec2.tf`: t4g.micro arm64, IP elástica, Docker, SSM y agente de CloudWatch (`ec2/user-data.sh`, `ec2/deploy.sh`).
- `monitoring.tf`: alarma de recuperación, logs de los contenedores (14 días) y alarma de `/api/health`.
- Ruta `/api/*` sin caché en los CloudFront hacia la EC2.
- Permisos de `ssm:SendCommand` en el rol de despliegue.
- Copia diaria de Postgres (`scripts/backup-db.sh`).
- Alertas del presupuesto: rellenar `budget_alert_emails`.
- Limitar la confianza del rol de despliegue a `environment:production` y `environment:staging`, en lugar de `environment:*`.
