// workers/compute-metrics.ts
import "dotenv/config";
import { createClient } from "redis";
import { computeSummary } from "../packages/core/utils";
import type { MarketNorm, SummaryStats } from "../packages/core/types";

const redis = createClient({ url: process.env.REDIS_URL! });
const TTL = Number(process.env.INGEST_TTL_SECONDS || 60);
const safeNum = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

(async () => {
  await redis.connect();

  const poly: MarketNorm[] = JSON.parse((await redis.get("hot:poly:markets"))  || "[]");
  const kal:  MarketNorm[] = JSON.parse((await redis.get("hot:kalshi:markets"))|| "[]");
  const combined = [...poly, ...kal];

  const naive: SummaryStats = computeSummary(combined);
  const polySum = JSON.parse((await redis.get("hot:poly:summary"))   || "{}") as Partial<SummaryStats>;
  const kalSum  = JSON.parse((await redis.get("hot:kalshi:summary")) || "{}") as Partial<SummaryStats>;

  const polyActive = poly.length;
  const kalActive  = kal.length;

  const polyVol = safeNum(polySum?.byPlatform?.polymarket?.vol24h);
  const polyOI  = safeNum(polySum?.byPlatform?.polymarket?.oi);
  const kalVol  = safeNum(kalSum?.byPlatform?.kalshi?.vol24h) || safeNum(naive.byPlatform.kalshi.vol24h);
  const kalOI   = safeNum(kalSum?.byPlatform?.kalshi?.oi)     || safeNum(naive.byPlatform.kalshi.oi);

  const corrected: SummaryStats = {
    ...naive,
    activeMarkets: polyActive + kalActive,
    byPlatform: {
      polymarket: {
        active: polyActive,
        vol24h: polyVol || safeNum(naive.byPlatform.polymarket.vol24h),
        oi:     polyOI  || safeNum(naive.byPlatform.polymarket.oi),
      },
      kalshi: {
        active: kalActive,
        vol24h: kalVol,
        oi:     kalOI,
      },
    },
    totalVolume24h: (polyVol || safeNum(naive.byPlatform.polymarket.vol24h)) + kalVol,
    totalOpenInterest: (polyOI || safeNum(naive.byPlatform.polymarket.oi)) + kalOI,
    // byCategory stays as computed from per-market rows
  };

  await redis.set("hot:combined:markets", JSON.stringify(combined), { EX: TTL });
  await redis.set("hot:combined:summary", JSON.stringify(corrected), { EX: TTL });

  await redis.quit();
  console.log(`[metrics] combined=${combined.length} markets -> hot:combined:* (platform-summary override)`);
})().catch(async (e) => {
  console.error("[metrics] failed:", e);
  try { await redis.quit(); } catch {}
  process.exit(1);
});
