// workers/compute-metrics.ts
import "dotenv/config";
import { createClient } from "redis";
import type { MarketNorm, SummaryStats } from "../packages/core/types";

const redis = createClient({ url: process.env.REDIS_URL! });
const TTL = Number(process.env.INGEST_TTL_SECONDS || 60);

(async () => {
  await redis.connect();

  const polyMarkets: MarketNorm[] =
    JSON.parse((await redis.get("hot:poly:markets")) || "[]");
  const polySummary =
    JSON.parse((await redis.get("hot:poly:summary")) || "{}") as SummaryStats;

  // === Derived MVP stats ===
  const sortedByVol = [...polyMarkets].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  const topMarkets = sortedByVol.slice(0, 10);
  const hottest = sortedByVol[0] || null;
  const categoryStats = polySummary.byCategory.slice(0, 10);

  // === Combined object ===
  const combined = {
    activeMarkets: polySummary.activeMarkets,
    totalVolume24h: polySummary.totalVolume24h,
    totalOpenInterest: polySummary.totalOpenInterest,
    byCategory: categoryStats,
    topMarkets,
    hottestMarket: hottest,
    timestamp: new Date().toISOString()
  };

  await redis.set("hot:combined:summary", JSON.stringify(combined), { EX: TTL });
  await redis.quit();

  console.log(`[metrics] wrote hot:combined:summary with ${topMarkets.length} top markets`);
})().catch(async (e) => {
  console.error("[metrics] failed:", e);
  try { await redis.quit(); } catch {}
  process.exit(1);
});
