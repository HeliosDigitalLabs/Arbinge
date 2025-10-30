-- 001_schema.sql
-- Minimal, fast, and future-proof for Polymarket-only

create extension if not exists pgcrypto; -- not required, but handy later
create extension if not exists btree_gin;

-- === Current market state (latest snapshot only) ===
create table if not exists markets (
  id              text primary key,                         -- e.g. "poly_12345"
  platform        text not null check (platform in ('polymarket')),
  question        text not null,
  category        text,
  yes_price       double precision,
  no_price        double precision,
  volume_24h      double precision,
  open_interest   double precision,
  last_trade_ts   timestamptz,
  raw             jsonb not null,                           -- full source object
  created_at      timestamptz not null default now(),       -- first-seen for "hottest new"
  updated_at      timestamptz not null default now()        -- maintained by trigger below
);

-- Keep updated_at fresh automatically
create or replace function trg_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists markets_touch_updated_at on markets;
create trigger markets_touch_updated_at
before update on markets
for each row execute function trg_touch_updated_at();

-- Helpful indexes
create index if not exists idx_markets_platform           on markets(platform);
create index if not exists idx_markets_category           on markets(category);
create index if not exists idx_markets_updated_at         on markets(updated_at);
create index if not exists idx_markets_last_trade_ts      on markets(last_trade_ts);
create index if not exists idx_markets_raw_gin            on markets using gin (raw jsonb_path_ops);
create index if not exists idx_markets_poly_cat_vol       on markets(platform, category, volume_24h);

-- === Append-only per-market time series (for charts/deltas) ===
create table if not exists market_snapshots (
  market_id     text not null references markets(id) on delete cascade,
  ts            timestamptz not null default now(),      -- sample time
  yes_price     double precision,
  no_price      double precision,
  volume_24h    double precision,
  open_interest double precision,
  primary key (market_id, ts)
);

create index if not exists ms_ts_idx        on market_snapshots(ts);
create index if not exists ms_market_idx    on market_snapshots(market_id);
create index if not exists ms_market_ts_idx on market_snapshots(market_id, ts);

-- === Optional: platform-level totals over time (nice for tile history) ===
-- You already cache these in Redis; this persists them for charts later.
create table if not exists platform_stats (
  platform   text not null check (platform in ('polymarket')),
  ts         timestamptz not null default now(),
  vol24h     double precision,   -- from live-volume override if available
  oi         double precision,   -- from /oi
  active     integer,            -- count of active markets at sample time
  primary key (platform, ts)
);

create index if not exists platform_stats_ts_idx on platform_stats(ts);
