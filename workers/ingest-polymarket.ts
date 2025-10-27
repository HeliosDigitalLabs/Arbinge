// workers/ingest-polymarket.ts
import "dotenv/config";
import fetch, { Response } from "node-fetch";
import { createClient } from "redis";
import { Pool } from "pg";
import { normalizePolymarket } from "../packages/core/schema";
import { computeSummary } from "../packages/core/utils";

const redis = createClient({ url: process.env.REDIS_URL });

type QueryablePool = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

const pool = new Pool({
  connectionString: process.env.PG_URL!,
}) as unknown as QueryablePool;

// ==== ENV ====
const POLY_URL = process.env.POLY_URL!; // Gamma REST markets
const POLY_OI_URL = process.env.POLY_OI_URL || ""; // Data API /oi
const POLY_LIVE_VOL_URL = process.env.POLY_LIVE_VOL_URL || ""; // Data API /live-volume (per-event)
const POLY_EVENTS_URL =
  process.env.POLY_EVENTS_URL ||
  "https://gamma-api.polymarket.com/events?active=true&closed=false&order=id&ascending=false&limit=60";
const POLY_EVENTS_MAX = Number(process.env.POLY_EVENTS_MAX || 60);
const POLY_EVENTS_DELAY_MS = Number(process.env.POLY_EVENTS_DELAY_MS || 80);
const TTL = Number(process.env.INGEST_TTL_SECONDS || 7200);
const DEBUG = process.env.POLY_DEBUG === "1";

// ==== helpers ====
async function toJSON<T = any>(r: Response): Promise<T> {
  return (await r.json()) as T;
}
function asNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
function sumRows(rows: any[], keys: string[]): number {
  let s = 0;
  for (const row of rows) {
    for (const k of keys) {
      if (row && row[k] != null) {
        s += asNum(row[k]);
        break;
      }
    }
  }
  return s;
}

(async () => {
  await redis.connect();

  // 1) Markets (Gamma /markets)
  const ac1 = new AbortController();
  const t1 = setTimeout(() => ac1.abort(), 30_000);
  const r1 = await fetch(POLY_URL, { signal: ac1.signal }).catch((e) => {
    clearTimeout(t1);
    throw e;
  });
  clearTimeout(t1);
  if (!r1 || !r1.ok) {
    const text = r1 ? await r1.text().catch(() => "") : "";
    throw new Error(`Polymarket markets HTTP ${r1?.status} ${r1?.statusText} :: ${text}`);
  }
  const marketsPayload: any = await toJSON(r1);
  const items = normalizePolymarket(marketsPayload); // maps volume24hr/volume_24h/day_volume -> volume24h
  if (DEBUG) {
    console.log("[poly] raw keys (first market):", Object.keys((items[0]?.raw || {})).slice(0, 12));
  }

  // 2) Open Interest (Data API /oi) — platform total
  let platformOi = 0;
  if (POLY_OI_URL) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 30_000);
      const r = await fetch(POLY_OI_URL, { signal: ac.signal });
      clearTimeout(t);
      if (r.ok) {
        const payload: any = await toJSON(r);
        if (Array.isArray(payload)) {
          platformOi = sumRows(payload, ["value", "oi", "open_interest", "openInterest", "total"]);
        } else if (payload && typeof payload === "object") {
          if (Array.isArray(payload.data)) {
            platformOi = sumRows(payload.data, ["value", "oi", "open_interest", "openInterest", "total"]);
          } else if (typeof payload.total === "number") {
            platformOi = asNum(payload.total);
          } else if (payload.byMarket && typeof payload.byMarket === "object") {
            platformOi = Object.values(payload.byMarket).reduce((s: number, v: any) => s + asNum(v), 0);
          }
        }
        if (DEBUG) console.log("[poly] OI total:", Math.round(platformOi));
      } else {
        const text = await r.text().catch(() => "");
        console.warn("[poly] OI fetch HTTP", r.status, r.statusText, "::", text);
      }
    } catch (e) {
      console.warn("[poly] OI fetch failed:", (e as Error).message);
    }
  } else {
    console.warn("[poly] OI URL not set; leaving OI=0");
  }

  // 3) 24h Volume — per-event via /live-volume?id=<eventId>
  let platformVol = 0;
  if (POLY_LIVE_VOL_URL) {
    try {
      // 3.1 fetch recent open events
      const acE = new AbortController();
      const tE = setTimeout(() => acE.abort(), 30_000);
      const rE = await fetch(POLY_EVENTS_URL, { signal: acE.signal });
      clearTimeout(tE);
      if (!rE.ok) {
        const text = await rE.text().catch(() => "");
        console.warn("[poly] events fetch HTTP", rE.status, rE.statusText, "::", text);
      } else {
        const eventsPayload: any = await rE.json();
        const list: any[] = Array.isArray(eventsPayload?.events)
          ? eventsPayload.events
          : Array.isArray(eventsPayload)
          ? eventsPayload
          : [];

        // accept number or numeric string ids
        const eventIds: number[] = list
          .map((e: any) => (typeof e?.id === "string" ? Number(e.id) : e?.id))
          .filter((id: any) => Number.isFinite(id))
          .slice(0, POLY_EVENTS_MAX);

        if (DEBUG) console.log("[poly] event ids (first 5):", eventIds.slice(0, 5));

        // 3.2 for each event, hit /live-volume with id= (fallback to eventId= if needed)
        for (let i = 0; i < eventIds.length; i++) {
          const id = eventIds[i];
          const urlId = `${POLY_LIVE_VOL_URL}?id=${id}`;
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 30_000);
          let r = await fetch(urlId, { signal: ac.signal }).catch(() => null as any);
          clearTimeout(t);

          if (!r || !r.ok) {
            const urlEventId = `${POLY_LIVE_VOL_URL}?eventId=${id}`;
            const ac2 = new AbortController();
            const t2 = setTimeout(() => ac2.abort(), 30_000);
            r = await fetch(urlEventId, { signal: ac2.signal }).catch(() => null as any);
            clearTimeout(t2);

            if (!r || !r.ok) {
              const text = r ? await r.text().catch(() => "") : "";
              console.warn(
                "[poly] live-volume event HTTP",
                r?.status,
                r?.statusText,
                "::",
                text,
                ":: tried",
                urlId,
                "then",
                urlEventId
              );
              await sleep(POLY_EVENTS_DELAY_MS);
              continue;
            }
          }

          const payload: any = await r.json();
          if (DEBUG && i === 0) {
            const sample =
              Array.isArray(payload)
                ? payload.slice(0, 2)
                : payload?.data && Array.isArray(payload.data)
                ? payload.data.slice(0, 2)
                : Object.fromEntries(Object.entries(payload || {}).slice(0, 2));
            console.log("[poly] live-volume payload sample:", JSON.stringify(sample));
          }

          if (Array.isArray(payload)) {
            platformVol += payload.reduce(
              (s, row) => s + asNum(row?.total ?? row?.value ?? row?.volume ?? row?.vol24h ?? row?.volume24h),
              0
            );
          } else if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
            platformVol += payload.data.reduce(
              (s: number, row: any) =>
                s + asNum(row?.total ?? row?.value ?? row?.volume ?? row?.vol24h ?? row?.volume24h),
              0
            );
          } else if (typeof payload.total === "number") {
            platformVol += payload.total;
          }

          if (DEBUG) {
            console.log(`[poly] event ${id} live-volume running total:`, Math.round(platformVol));
          }
          await sleep(POLY_EVENTS_DELAY_MS);
        }
      }
    } catch (e) {
      console.warn("[poly] live-volume (per-event) failed:", (e as Error).message);
    }
  } else {
    console.warn("[poly] live-volume URL not set; leaving volume from items only");
  }

  // 4) Upsert markets into PG
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
        m.id,
        m.platform,
        m.question,
        m.category,
        m.yesPrice,
        m.noPrice,
        m.volume24h,
        m.openInterest,
        m.lastTradeTs,
        m.raw,
      ]
    );
  }

  // 5) Build Poly summary and override platform totals
  const polySummary = computeSummary(items);
  const volFromItems = polySummary.byPlatform.polymarket.vol24h;
  polySummary.byPlatform.polymarket = {
    active: items.length,
    vol24h: platformVol || volFromItems,
    oi: platformOi,
  };
  polySummary.totalVolume24h = platformVol || volFromItems;
  polySummary.totalOpenInterest = platformOi;

  // 6) Write caches
  await redis.set("hot:poly:markets", JSON.stringify(items), { EX: TTL });
  await redis.set("hot:poly:summary", JSON.stringify(polySummary), { EX: TTL });

  await redis.quit();
  await pool.end();

  console.log(
    `[poly] upserted ${items.length} markets (REST), vol24h=${Math.round(
      platformVol || volFromItems
    )}, OI=${Math.round(platformOi)}, TTL=${TTL}s`
  );
})().catch(async (e) => {
  console.error("[poly] ingest failed:", e);
  try {
    await redis.quit();
  } catch {}
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
