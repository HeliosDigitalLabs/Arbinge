# 🧠 Arbinge Backend — MVP Analytics System (Polymarket Ingest)

This backend powers **Phase 1: “What’s happening right now”** of the Arbinge analytics dashboard.  
It ingests live **on-chain Polymarket data** (via Goldsky subgraphs + Gamma API), stores normalized snapshots in Postgres, and serves cached summaries via an Express API.

---

## 📊 System Overview

| Layer | Purpose | Frequency |
|-------|----------|-----------|
| **workers/ingest-polymarket.ts** | Pulls Gamma markets + Goldsky trades/OI → Postgres + Redis | Hourly (`0 * * * *`) |
| **workers/compute-metrics.ts** | Combines caches into `hot:combined:*` | Hourly (+5 min) |
| **apps/api/src/index.ts** | Express API for `/v1/summary` & `/v1/markets` | Always on |
| **Postgres** | Persistent storage for markets + snapshots | — |
| **Redis** | Fast cache layer for API responses | — |
| **PM2** | Process manager & cron scheduler | — |

---

## 🧱 Architecture Diagram

┌──────────────┐ ┌───────────────┐
│ Polymarket │ │ Goldsky GQL │
│ Gamma API │ │ Subgraphs │
└──────┬───────┘ └──────┬────────┘
│ │
▼ ▼
🧩 ingest-polymarket.ts
├─ normalize markets
├─ aggregate 24 h trades
├─ compute open interest
├─ upsert Postgres
└─ cache JSON → Redis
│
▼
🧮 compute-metrics.ts
└─ merge → hot:combined:*
│
▼
🌐 Express API (index.ts)
└─ /v1/summary | /v1/markets

yaml
Copy code

---

## 🚀 Quickstart Commands

```bash
# 1️⃣ Install dependencies
pnpm install

# 2️⃣ Bring up Postgres & Redis
sudo docker compose up -d

# 3️⃣ Initialize DB schema
sudo docker exec -i arbinge_pg psql -U postgres -d arbinge < infra/sql/001_schema.sql

# 4️⃣ Run ingest once (for testing)
npx tsx workers/ingest-polymarket.ts

# 5️⃣ Compute combined metrics
npx tsx workers/compute-metrics.ts

# 6️⃣ Start scheduled services (via PM2)
pm2 start pm2.config.cjs
pm2 list

Endpoint	Description
/v1/summary/poly	Polymarket summary (24 h vol + OI + category breakdown)
/v1/markets/poly	Full market list with current stats
/v1/summary	Combined summary (across platforms)
/healthz	Health check endpoint

📂 Data Flow

Gamma → normalizePolymarket() → cleans metadata.

Goldsky → fetchTrades24hGql() → gets 24 h trades.

Goldsky → fetchOiByConditionIds() → gets open interest.

Postgres

markets = live snapshot

market_snapshots = hourly series

platform_stats = summary per run

Redis → caches summary + markets for API.

🛠 Useful Commands
Task	Command
Tail logs	pm2 logs ingest-poly
Restart all	pm2 restart all
Save process list	pm2 save
Auto-start on boot	pm2 startup
View tables	sudo docker exec -it arbinge_pg psql -U postgres -d arbinge -c "\dt"
Query latest stats	SELECT * FROM platform_stats ORDER BY ts DESC LIMIT 5;

✅ Health Checklist

 Postgres (arbinge_pg) running

 Redis (arbinge_redis) running

 markets ≈ 1 000 rows

 platform_stats updates hourly

 Redis keys: hot:poly:*

 /v1/summary/poly returns data

📅 Next Steps

Add workers/rollup-daily.ts for nightly aggregates

Build /v1/history/* endpoints (7 d / 30 d charts)

Optional: add on-chain verification script (ethers.js)