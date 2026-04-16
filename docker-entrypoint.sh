#!/bin/sh
set -e

if [ ! -f "/app/data/devices.json" ] && [ -f "/app/defaults/devices.json" ]; then
  cp /app/defaults/devices.json /app/data/devices.json
  echo "[entrypoint] Copied default devices.json into data volume"
fi

exec "$@"
