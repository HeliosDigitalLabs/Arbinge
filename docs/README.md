## Arbinge MVP

- Workers fetch Polymarket/Kalshi, normalize, persist to Postgres, and cache hot sets to Redis (TTL 60s).
- API serves `/v1/summary` and `/v1/markets` from Redis (fallback PG).
- Web renders simple cards + tables from the API.

### Commands
- `pnpm -w build` — compile
- `psql $PG_URL -f infra/sql/001_init.sql` — init DB
- `pm2 startOrReload infra/pm2.config.cjs` — run workers + api
