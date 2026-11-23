#!/usr/bin/env bash
# Construye en la EC2 la imagen del backend de un commit y la despliega con deploy.sh.
#
#   build-and-deploy.sh <prod|staging> <sha completo>
#
# Lo ejecuta GitHub Actions por SSM (job `backend` de .github/workflows/_deploy.yml).
# Descarga el código de ese commit (el repo es público), instala docker-compose.prod.yml
# y deploy.sh de ese mismo commit en /opt/app/<entorno> y construye la imagen aquí mismo.
# Así la EC2 no necesita credenciales de ningún registro de imágenes (docs/decisiones.md, D11).
set -euo pipefail

ENV="${1:?uso: build-and-deploy.sh <prod|staging> <sha>}"
SHA="${2:?uso: build-and-deploy.sh <prod|staging> <sha>}"
REPO="UB-ES-2026-B2/Project"
# Mismo nombre que usa deploy.sh, para que .last-good y el rollback sigan funcionando.
IMAGE_REPO="ghcr.io/ub-es-2026-b2/project-backend"

case "$ENV" in prod | staging) ;; *) echo "Entorno desconocido: $ENV" >&2; exit 2 ;; esac
if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "El sha tiene que ser el commit completo (40 caracteres hexadecimales): $SHA" >&2
  exit 2
fi

WORK="$(mktemp -d /opt/app/build.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Descargando $REPO@$SHA"
curl -fsSL --retry 3 "https://codeload.github.com/$REPO/tar.gz/$SHA" |
  tar -xz --strip-components=1 -C "$WORK"

mkdir -p "/opt/app/$ENV"
install -m 0644 "$WORK/docker-compose.prod.yml" "/opt/app/$ENV/docker-compose.prod.yml"
install -m 0755 "$WORK/infra/ec2/deploy.sh" "/opt/app/$ENV/deploy.sh"
install -m 0755 "$WORK/infra/ec2/backup-db.sh" "/opt/app/$ENV/backup-db.sh"

echo "==> Construyendo $IMAGE_REPO:$SHA"
docker build --pull -t "$IMAGE_REPO:$SHA" "$WORK/backend"

SKIP_PULL=1 IMAGE_REPO="$IMAGE_REPO" "/opt/app/$ENV/deploy.sh" "$ENV" "$SHA"

# Copia diaria de la base de datos (es-b2-backup@<entorno>.timer). Va después del
# despliegue para que un fallo aquí no tumbe una versión que ya está sana.
echo "==> Activando la copia diaria de $ENV"
install -m 0644 "$WORK/infra/ec2/systemd/es-b2-backup@.service" /etc/systemd/system/
install -m 0644 "$WORK/infra/ec2/systemd/es-b2-backup@.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now "es-b2-backup@$ENV.timer"
systemctl list-timers "es-b2-backup@$ENV.timer" --no-pager || true
