create table if not exists markets (
  id text primary key,
  platform text not null,
  question text not null,
  category text,
  yes_price numeric,
  no_price numeric,
  volume_24h numeric,
  open_interest numeric,
  last_trade_ts timestamptz,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_markets_platform on markets(platform);
create index if not exists idx_markets_category on markets(category);

create table if not exists market_snapshots (
  id text not null,
  platform text not null,
  taken_at timestamptz not null default now(),
  yes_price numeric,
  no_price numeric,
  volume_24h numeric,
  open_interest numeric,
  primary key (id, platform, taken_at)
);
