#!/usr/bin/env bash
# Despliega una versión del backend en la EC2, con health check y rollback automático.
#
#   deploy.sh <prod|staging> <sha>
#
# Lo lanza build-and-deploy.sh (y este, GitHub Actions con `aws ssm send-command`, sin SSH).
# Si /api/health no responde, vuelve a la última versión buena (/opt/app/<entorno>/.last-good)
# y termina con error para que el workflow salga en rojo.
#
# Variables opcionales:
#   IMAGE_REPO  imagen sin etiqueta (por defecto ghcr.io/ub-es-2026-b2/project-backend)
#   SKIP_PULL=1 no hace docker pull (imagen construida en la propia EC2)
set -euo pipefail

ENV="${1:?uso: deploy.sh <prod|staging> <sha>}"
TAG="${2:?uso: deploy.sh <prod|staging> <sha>}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/ub-es-2026-b2/project-backend}"

case "$ENV" in
  prod) API_PORT=8000 ;;
  staging) API_PORT=8001 ;;
  *) echo "Entorno desconocido: $ENV" >&2; exit 2 ;;
esac

DIR="/opt/app/$ENV"
COMPOSE="$DIR/docker-compose.prod.yml"
PROJECT="es-b2-$ENV"
mkdir -p "$DIR"
cd "$DIR"

param() {
  aws ssm get-parameter --region eu-west-1 --with-decryption \
    --name "/es-b2/$ENV/$1" --query Parameter.Value --output text
}

export APP_ENV="$ENV" API_PORT
POSTGRES_PASSWORD="$(param POSTGRES_PASSWORD)"
SECRET_KEY="$(param SECRET_KEY)"
export POSTGRES_PASSWORD SECRET_KEY

up() {
  export API_IMAGE="$IMAGE_REPO:$1"
  docker compose -p "$PROJECT" -f "$COMPOSE" up -d --remove-orphans
}

healthy() {
  # Hasta ~2 minutos: el contenedor ejecuta las migraciones antes de arrancar.
  for _ in $(seq 1 40); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$API_PORT/api/health" | grep -q '"ok"'; then
      return 0
    fi
    sleep 3
  done
  return 1
}

echo "==> $ENV: desplegando $IMAGE_REPO:$TAG"
if [ "${SKIP_PULL:-0}" != "1" ]; then
  docker pull "$IMAGE_REPO:$TAG"
fi
up "$TAG"

if healthy; then
  echo "$TAG" > .last-good
  echo "==> $ENV: OK, /api/health responde. Versión buena: $TAG"
  docker image prune -af --filter "until=168h" >/dev/null || true
  exit 0
fi

echo "::error::$ENV: /api/health no responde con $TAG" >&2
docker compose -p "$PROJECT" -f "$COMPOSE" logs --tail 50 api || true

if [ -s .last-good ] && [ "$(cat .last-good)" != "$TAG" ]; then
  PREV="$(cat .last-good)"
  echo "==> $ENV: rollback a $PREV"
  up "$PREV"
  if healthy; then
    echo "==> $ENV: rollback OK ($PREV)"
  else
    echo "::error::$ENV: el rollback a $PREV tampoco responde" >&2
  fi
else
  echo "==> $ENV: no hay versión buena anterior a la que volver"
fi
exit 1
