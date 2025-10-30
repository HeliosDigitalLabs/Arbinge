import "dotenv/config";
import fetch, { Response } from "node-fetch";
import { createClient } from "redis";
import { Pool } from "pg";
import { normalizePolymarket } from "../packages/core/schema";
import { computeSummary } from "../packages/core/utils";
import { gqlFetch } from "../packages/core/gql";

const redis = createClient({ url: process.env.REDIS_URL });

type QueryablePool = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};
const pool = new Pool({ connectionString: process.env.PG_URL! }) as unknown as QueryablePool;

// ==== ENV ====
const POLY_URL = process.env.POLY_URL!;
const ACTIVITY_GQL = process.env.POLY_ACTIVITY_GQL!;
const OI_GQL = process.env.POLY_OI_GQL || "";
const POLY_PUBLIC_VOL_URL = process.env.POLY_PUBLIC_VOL_URL || "";
const USE_PUBLIC_TILE = String(process.env.POLY_PUBLIC_VOL_OVERRIDE || "false").toLowerCase() === "true";
const TTL = Number(process.env.INGEST_TTL_SECONDS || 7200);
const DEBUG = process.env.POLY_DEBUG === "1";
const GQL_PAGE_SIZE = Number(process.env.GQL_PAGE_SIZE || 1000);

// ==== helpers ====
async function toJSON<T = any>(r: Response): Promise<T> { return (await r.json()) as T; }
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- helper: extract conditionId from ERC-1155 assetId ---
function conditionFromAssetId(assetId: string | undefined | null): string | null {
  if (!assetId || typeof assetId !== "string") return null;
  const hex = assetId.startsWith("0x") ? assetId : "0x" + assetId;
  const cond = hex.slice(0, 66);
  return /^0x[0-9a-fA-F]{64}$/.test(cond) ? cond : null;
}

// ==== Activity (Orderbook) subgraph ====
const ACTIVITY_CANDIDATES = [
  {
    root: "orderFilledEvents",
    fields: { cid: "makerAssetId", price: "takerAmountFilled", size: "makerAmountFilled", ts: "timestamp" },
  },
];

type ActivityRow = Record<string, any>;

function buildActivityQuery(root: string, fields: { cid: string; price?: string; size?: string; ts: string }) {
  const cols = [fields.cid, fields.ts, fields.price, fields.size].filter(Boolean);
  return `
    query Last24h($since: Int!, $first: Int!, $skip: Int!) {
      ${root}(
        where: { ${fields.ts}_gte: $since }
        orderBy: ${fields.ts}
        orderDirection: desc
        first: $first
        skip: $skip
      ) {
        ${cols.join("\n        ")}
      }
    }`;
}

async function tryActivityOnce(
  root: string,
  fields: { cid: string; price?: string; size?: string; ts: string },
  since: number,
  first: number,
  skip: number
): Promise<ActivityRow[] | null> {
  const q = buildActivityQuery(root, fields);
  try {
    const d = await gqlFetch<any>(ACTIVITY_GQL, q, { since, first, skip });
    const rows: ActivityRow[] = d?.[root];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function fetchTrades24hGql(): Promise<{
  totalUSD: number;
  byMarketUSD: Map<string, number>;
  byMarketCnt: Map<string, number>;
  byLastTs: Map<string, number>;
  window: { since: number; now: number };
}> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - 24 * 3600;
  const first = GQL_PAGE_SIZE;
  const byUSD = new Map<string, number>();
  const byCnt = new Map<string, number>();
  const byLastTs = new Map<string, number>();
  let total = 0;

  let chosen: (typeof ACTIVITY_CANDIDATES)[number] | null = null;
  for (const cand of ACTIVITY_CANDIDATES) {
    const probe = await tryActivityOnce(cand.root, cand.fields, since, 50, 0);
    if (probe && probe.length) { chosen = cand; break; }
  }
  if (!chosen) throw new Error("Activity subgraph: no compatible root found");

  if (DEBUG)
    console.log(`[poly] Activity root picked: ${chosen.root} (fields: ${Object.values(chosen.fields).filter(Boolean).join(",")})`);

  for (let skip = 0; ; skip += first) {
    const rows = await tryActivityOnce(chosen.root, chosen.fields, since, first, skip);
    if (!rows || !rows.length) break;

    for (const r of rows) {
      const assetId = r[chosen.fields.cid];
      const cid = conditionFromAssetId(assetId);
      if (!cid) continue;
      const ts = Number(r[chosen.fields.ts]);
      if (!Number.isFinite(ts) || ts < since) continue;

      const price = Number(r[chosen.fields.price]);
      const size = Number(r[chosen.fields.size]);
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue;

      const usd = (price / 1e6) * (size / 1e6);
      if (!usd) continue;

      total += usd;
      byUSD.set(cid, (byUSD.get(cid) || 0) + usd);
      byCnt.set(cid, (byCnt.get(cid) || 0) + 1);
      byLastTs.set(cid, Math.max(byLastTs.get(cid) ?? 0, ts));
    }

    if (rows.length < first || skip > 10_000) break;
  }

  return { totalUSD: total, byMarketUSD: byUSD, byMarketCnt: byCnt, byLastTs, window: { since, now } };
}

// ==== OI subgraph ====
const OI_BY_CIDS = `
  query OIbyCids($first: Int!, $skip: Int!) {
    marketOpenInterests(first: $first, skip: $skip) {
      id
      amount
    }
  }
`;


async function fetchOiByConditionIds(cids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!OI_GQL) return out;

  const first = GQL_PAGE_SIZE;

  for (let skip = 0; ; skip += first) {
    const data = await gqlFetch<{ marketOpenInterests: { id: string; amount: string }[] }>(
      OI_GQL,
      OI_BY_CIDS,
      { first, skip }
    );

    const rows = data.marketOpenInterests || [];
    if (!rows.length) break;

    for (const m of rows) {
      const rawId = m.id ?? "";
      // Extract conditionId from "0x<conditionId>-..." pattern
      const cidMatch = rawId.match(/0x[0-9a-fA-F]{64}/);
      const cid = cidMatch ? cidMatch[0] : null;
      const amt = Number(m.amount ?? 0) / 1e6; // normalize from USDC (6 decimals)
      if (cid) out.set(cid, amt);
    }

    if (rows.length < first || skip > 10_000) break;
  }

  return out;
}


// ==== optional public tile ====
async function fetchPublicPlatformVol(url: string): Promise<number | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const p: any = await r.json();  // <-- explicit any fixes TS2339
    if (typeof p?.total24h === "number") return p.total24h;
    if (typeof p?.volume24h === "number") return p.volume24h;
    if (typeof p?.total === "number") return p.total;
    if (typeof p?.data?.total24h === "number") return p.data.total24h;
    if (typeof p?.byPlatform?.polymarket?.vol24h === "number") return p.byPlatform.polymarket.vol24h;
    return null;
  } catch {
    return null;
  }
}

// ==== stub helper ====
function makeStubMarket(cid: string, usd: number) {
  return {
    id: `poly_cid_${cid}`,
    platform: "polymarket" as const,
    question: cid,
    category: "uncategorized",
    yesPrice: null,
    noPrice: null,
    volume24h: usd,
    openInterest: null,
    lastTradeTs: null,
    raw: { conditionId: cid, stub: true },
  };
}

// ==== main ====
(async () => {
  await redis.connect();

  // 1) Gamma markets
  const rr = await fetch(POLY_URL);
  if (!rr.ok) throw new Error(`Gamma markets HTTP ${rr.status}`);
  const payload: any = await toJSON(rr);
  let items = normalizePolymarket(payload);
  if (DEBUG) console.log("[poly] markets normalized:", items.length);

  // 2) OI total (optional)
  let platformOi = 0;
  try {
    const oiURL = process.env.POLY_OI_URL || "";
    if (oiURL) {
      const r = await fetch(oiURL);
      if (r.ok) {
        const p: any = await r.json();
        platformOi = typeof p?.total === "number" ? p.total :
          Array.isArray(p?.data) ? p.data.reduce((s: number, row: any) => s + (Number(row?.value) || 0), 0) : 0;
      }
    }
  } catch (e) { if (DEBUG) console.warn("[poly] OI REST failed:", (e as Error).message); }

  // 3) 24h trades
  const trades = await fetchTrades24hGql();

  // 4) index by conditionId
  const cidToIdx = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const raw = items[i].raw as any;
    const cid = raw?.conditionId ?? raw?.condition_id ?? null;
    if (cid) cidToIdx.set(String(cid), i);
  }

  // 5) add stubs for missing
  const missing: string[] = [];
  for (const cid of trades.byMarketUSD.keys()) if (!cidToIdx.has(cid)) missing.push(cid);
  if (DEBUG) console.log("[poly] missing conditionIds to stub:", missing.length);
  if (missing.length) {
    const seen = new Set(items.map(m => m.id));
    for (const cid of missing) {
      const usd = trades.byMarketUSD.get(cid) || 0;
      if (usd > 0 && !seen.has(`poly_cid_${cid}`)) items.push(makeStubMarket(cid, usd));
    }
    items.forEach((m, i) => {
      const cid = (m.raw as any)?.conditionId ?? (m.raw as any)?.condition_id;
      if (cid) cidToIdx.set(String(cid), i);
    });
  }

  // 6) patch metrics
  for (const m of items) (m as any).volume24h = 0;
  for (const [cid, usd] of trades.byMarketUSD) {
    const idx = cidToIdx.get(cid);
    if (idx == null) continue;
    const item: any = items[idx];
    item.volume24h = usd;
    const ts = trades.byLastTs.get(cid);
    if (ts) item.lastTradeTs = new Date(ts * 1000).toISOString();
  }

  // 7) per-market OI + total
  if (OI_GQL) {
    const cids = Array.from(trades.byMarketUSD.keys());
    const oiMap = await fetchOiByConditionIds(cids);

    let totalOiUsd = 0;
    for (const [cid, oi] of oiMap) {
      totalOiUsd += oi;
      const idx = cidToIdx.get(cid);
      if (idx != null) (items[idx] as any).openInterest = oi;
    }

    // Assign summed OI to the platform-level total
    platformOi = totalOiUsd;

    if (DEBUG)
      console.log(`[poly] total open interest ≈ $${platformOi.toFixed(2)} USD`);
  }


  // filter to markets with trades in last 24h
  items = items.filter(m => {
    const ts = new Date((m as any).lastTradeTs ?? 0).getTime() / 1000;
    return Number.isFinite(ts) && ts >= trades.window.since;
  });

  // 8) write to DB
  for (const m of items) {
    await pool.query(
      `insert into markets (
         id, platform, question, category, yes_price, no_price, volume_24h, open_interest, last_trade_ts, raw
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         question=$3, category=$4, yes_price=$5, no_price=$6,
         volume_24h=$7, open_interest=$8, last_trade_ts=$9, raw=$10, updated_at=now()`,
      [
        m.id, m.platform, m.question, m.category,
        m.yesPrice, m.noPrice, (m as any).volume24h, (m as any).openInterest, (m as any).lastTradeTs, m.raw,
      ]
    );
  }

  if (items.length) {
    const ids = items.map(m => m.id);
    const yp = items.map(m => m.yesPrice);
    const np = items.map(m => m.noPrice);
    const v24 = items.map(m => (typeof (m as any).volume24h === "number" ? (m as any).volume24h : 0));
    const oi = items.map(m => (m as any).openInterest);
    await pool.query(
      `insert into market_snapshots (market_id, yes_price, no_price, volume_24h, open_interest)
       select * from unnest ($1::text[], $2::float8[], $3::float8[], $4::float8[], $5::float8[])`,
      [ids, yp, np, v24, oi]
    );
  }

  // 9) zero-stale rows
  const liveIds = items.map(m => m.id);
  await pool.query(
    `update markets set volume_24h = 0, updated_at = now()
     where platform='polymarket' and not (id = any($1::text[]))`,
    [liveIds]
  );

  // 10) summary
  const summary = computeSummary(items);
  summary.byPlatform.polymarket = { active: items.length, vol24h: trades.totalUSD, oi: platformOi };
  summary.totalVolume24h = trades.totalUSD;
  summary.totalOpenInterest = platformOi;

  await pool.query(
    `insert into platform_stats (platform, vol24h, oi, active)
     values ('polymarket',$1,$2,$3)`,
    [summary.totalVolume24h, summary.totalOpenInterest, items.length]
  );

  await redis.set("hot:poly:markets", JSON.stringify(items), { EX: TTL });
  await redis.set("hot:poly:summary", JSON.stringify(summary), { EX: TTL });

  await redis.quit();
  await pool.end();

  console.log(`[poly] upserted ${items.length} markets, vol24h=${Math.round(trades.totalUSD)}, OI=${Math.round(platformOi)}, TTL=${TTL}s`);
})().catch(async (e) => {
  console.error("[poly] ingest failed:", e);
  try { await redis.quit(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(1);
});
