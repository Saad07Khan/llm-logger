#!/bin/sh
set -e

cd "$(dirname "$0")/.."

echo "[migrate] generating prisma client (frontend)"
( cd frontend && npx prisma generate )

echo "[migrate] applying migrations (frontend schema)"
( cd frontend && npx prisma migrate deploy )

echo "[migrate] generating prisma client (ingestion)"
( cd ingestion && npx prisma generate )

echo "[migrate] done"
