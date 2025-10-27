import "dotenv/config";
import fetch from "node-fetch";
import { createClient } from "redis";
import { Pool } from "pg";  // ⬅️ use named import (not default)
import { normalizeKalshi } from "../packages/core/schema";
import { computeSummary } from "../packages/core/utils";

const redis = createClient({ url: process.env.REDIS_URL });

// ⬅️ define the shape we use, then cast once
type QueryablePool = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

const pool = new Pool({
  connectionString: process.env.PG_URL!,
}) as unknown as QueryablePool;

const BASE = process.env.KALSHI_URL!;
const MAX_PAGES = Number(process.env.KALSHI_MAX_PAGES || 3);
const TTL = Number(process.env.INGEST_TTL_SECONDS || 60);

(async () => {
  await redis.connect();

  const pages: any[] = [];
  let url = BASE;
  let cursor: string | null = null;

  for (let i = 0; i < MAX_PAGES; i++) {
    // AbortController instead of RequestInit.timeout
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);

    const j: any = await r.json();
    pages.push(j);
    cursor = j?.cursor ?? j?.next ?? j?.next_cursor ?? null;
    if (!cursor) break;

    const sep = BASE.includes("?") ? "&" : "?";
    url = `${BASE}${sep}cursor=${encodeURIComponent(cursor)}`;
  }

  const items = normalizeKalshi(
    pages.flatMap((p: any) => Array.isArray(p?.markets) ? p.markets : [])
  );

  for (const m of items) {
    await pool.query(
      `insert into markets (
         id, platform, question, category, yes_price, no_price, volume_24h, open_interest, last_trade_ts, raw
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         question=$3, category=$4, yes_price=$5, no_price=$6, volume_24h=$7,
         open_interest=$8, last_trade_ts=$9, raw=$10, updated_at=now()`,
      [
        m.id, m.platform, m.question, m.category,
        m.yesPrice, m.noPrice, m.volume24h, m.openInterest, m.lastTradeTs, m.raw
      ]
    );
  }

  await redis.set("hot:kalshi:markets", JSON.stringify(items), { EX: TTL });
  await redis.set("hot:kalshi:summary", JSON.stringify(computeSummary(items)), { EX: TTL });

  await redis.quit();
  await pool.end();
  console.log(`[kalshi] upserted ${items.length} markets, cached summary`);
})();
