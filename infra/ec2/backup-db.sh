#!/usr/bin/env bash
# Copia de la base de datos de un entorno al bucket de copias.
#
#   backup-db.sh <prod|staging>
#
# La lanza cada noche el timer es-b2-backup@<entorno>.timer (lo instala build-and-deploy.sh).
# Hace un pg_dump en formato custom (ya va comprimido) dentro del contenedor de Postgres y lo
# sube a s3://es-b2-backups-891377256343/<entorno>/AAAA/MM/DD/app-<fecha>.dump.
# El bucket borra las copias a los 30 días (regla de ciclo de vida en Terraform).
#
# Restaurar: ver infra/README.md, sección "Copias de la base de datos".
set -euo pipefail

ENV="${1:?uso: backup-db.sh <prod|staging>}"
case "$ENV" in prod | staging) ;; *) echo "Entorno desconocido: $ENV" >&2; exit 2 ;; esac

BUCKET="${BACKUP_BUCKET:-es-b2-backups-891377256343}"
PROJECT="es-b2-$ENV"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
KEY="$ENV/$(date -u +%Y/%m/%d)/app-$STAMP.dump"

# El contenedor de Postgres de ese proyecto de Compose (sin depender del nombre exacto).
DB="$(docker ps -q \
  --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=db")"
if [ -z "$DB" ]; then
  echo "No hay contenedor de Postgres en marcha para $PROJECT" >&2
  exit 1
fi

TMP="$(mktemp /var/tmp/es-b2-backup.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

echo "==> $ENV: pg_dump"
docker exec "$DB" pg_dump -U app -d app --format=custom --no-owner >"$TMP"

# Un volcado vacío o truncado no sirve: pg_restore --list falla si el fichero está roto.
docker exec -i "$DB" pg_restore --list <"$TMP" >/dev/null

SIZE="$(stat -c %s "$TMP")"
echo "==> $ENV: subiendo $SIZE bytes a s3://$BUCKET/$KEY"
aws s3 cp "$TMP" "s3://$BUCKET/$KEY" \
  --region eu-west-1 --sse AES256 --only-show-errors

echo "==> $ENV: copia OK ($KEY)"
