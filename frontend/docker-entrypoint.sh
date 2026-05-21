#!/bin/sh
set -e

echo "[frontend] running prisma migrate deploy"
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma || \
  ./node_modules/.bin/prisma db push --schema=./prisma/schema.prisma --accept-data-loss

echo "[frontend] starting next"
exec node server.js
