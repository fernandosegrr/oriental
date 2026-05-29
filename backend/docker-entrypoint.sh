#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running migrations..."
  node dist/migrations/run.js
  echo "Running seed..."
  node dist/scripts/seed.js
fi

exec node dist/src/index.js
