import type { MarketNorm, SummaryStats } from "./types";

export const sum = (xs: Array<number | null | undefined>): number =>
  xs.reduce((s: number, x) => s + (typeof x === "number" ? x : 0), 0);

export const computeSummary = (rows: MarketNorm[]): SummaryStats => {
  const active = rows.length;
  const totalVolume24h = sum(rows.map(r => r.volume24h));
  const totalOpenInterest = sum(rows.map(r => r.openInterest));

  const byPlat = (p: "polymarket" | "kalshi") => {
    const subset = rows.filter(r => r.platform === p);
    return {
      active: subset.length,
      vol24h: sum(subset.map(r => r.volume24h)),
      oi:     sum(subset.map(r => r.openInterest)),
    };
  };

  const catMap = new Map<string, { vol24h: number; count: number }>();
  for (const r of rows) {
    const k = r.category ?? "uncategorized";
    const prev = catMap.get(k) ?? { vol24h: 0, count: 0 };
    prev.vol24h += r.volume24h ?? 0;
    prev.count += 1;
    catMap.set(k, prev);
  }

  return {
    activeMarkets: active,
    totalVolume24h,
    totalOpenInterest,
    byPlatform: { polymarket: byPlat("polymarket"), kalshi: byPlat("kalshi") },
    byCategory: [...catMap].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.vol24h - a.vol24h),
  };
};
