#!/usr/bin/env bash
set -euo pipefail
# build, migrate, reload pm2
pnpm -w build
psql "$PG_URL" -f infra/sql/001_schema.sql || true
pm2 startOrReload infra/pm2.config.cjs
pm2 save
