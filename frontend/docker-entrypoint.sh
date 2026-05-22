#!/bin/sh
set -e

PRISMA_BIN="./node_modules/prisma/build/index.js"

if [ -f "./prisma/migrate-statuses.js" ]; then
  echo "[frontend] running status enum migration (best-effort)"
  node ./prisma/migrate-statuses.js || true
fi

if [ ! -f "$PRISMA_BIN" ]; then
  echo "[frontend] prisma CLI missing at $PRISMA_BIN — skipping schema sync"
else
  echo "[frontend] running prisma db push"
  node "$PRISMA_BIN" db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss
fi

echo "[frontend] starting next"
exec node server.js
