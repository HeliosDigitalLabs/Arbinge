# 🗄 Data Model — Polymarket Analytics

---

## `markets`
Current snapshot of each market.

| Column | Type | Description |
|---------|-------|--------------|
| id | text PK | `poly_<marketId>` |
| platform | text | "polymarket" |
| question | text | Market title |
| category | text | Cleaned category |
| yes_price / no_price | float | Outcome prices |
| volume_24h | float | Past 24 h USD volume |
| open_interest | float | Current open interest |
| last_trade_ts | timestamptz | Last trade time |
| raw | jsonb | Full original source object |
| created_at / updated_at | timestamptz | Auto-managed timestamps |

---

## `market_snapshots`
Hourly time-series of market metrics.

| Column | Type | Description |
|---------|-------|--------------|
| market_id | FK → markets.id | — |
| ts | timestamptz | Ingest timestamp |
| yes_price / no_price | float | Prices at ingest |
| volume_24h | float | 24 h volume |
| open_interest | float | Open interest |

≈ 1 000 rows/hour → 24 000/day.

---

## `platform_stats`
Platform-level summary per ingest.

| Column | Type | Example |
|---------|-------|-----------|
| platform | text | "polymarket" |
| ts | timestamptz | `2025-10-28 23:35:00` |
| vol24h | float | 20371577.351 |
| oi | float | 43949742.0 |
| active | int | 1116 |

---

## Redis Keys

| Key | Description | TTL |
|------|--------------|----|
| `hot:poly:markets` | JSON array of markets | 7200 s |
| `hot:poly:summary` | Summary object | 7200 s |
| `hot:combined:*` | Merged cache for API | 7200 s |