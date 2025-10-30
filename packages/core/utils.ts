import type { MarketNorm, SummaryStats } from "./types";

export const sum = (xs: ReadonlyArray<number | null | undefined>): number => {
  let s = 0;
  for (const x of xs) if (typeof x === "number" && Number.isFinite(x)) s += x;
  return s;
};

export const computeSummary = (rows: MarketNorm[]): SummaryStats => {
  const active = rows.length;
  const totalVolume24h    = sum(rows.map(r => r.volume24h));
  const totalOpenInterest = sum(rows.map(r => r.openInterest));

  const subset = rows.filter(r => r.platform === "polymarket");
  const byPlatform = {
    polymarket: {
      active: subset.length,
      vol24h: sum(subset.map(r => r.volume24h)),
      oi:     sum(subset.map(r => r.openInterest)),
    },
  };

  const catMap = new Map<string, { vol24h: number; count: number }>();
  for (const r of rows) {
    const k = (r.category && String(r.category).trim()) || "uncategorized";
    const prev = catMap.get(k) ?? { vol24h: 0, count: 0 };
    prev.vol24h += r.volume24h ?? 0;
    prev.count  += 1;
    catMap.set(k, prev);
  }

  return {
    activeMarkets: active,
    totalVolume24h,
    totalOpenInterest,
    byPlatform,
    byCategory: [...catMap]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.vol24h - a.vol24h),
  };
};
