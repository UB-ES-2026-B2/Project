#!/bin/sh
# Aplica las migraciones pendientes y arranca el comando del contenedor (CMD).
set -e

if [ -f alembic.ini ]; then
  echo "[entrypoint] alembic upgrade head"
  alembic upgrade head
else
  echo "[entrypoint] no hay alembic.ini: se omiten las migraciones"
fi

exec "$@"
