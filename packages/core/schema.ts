// packages/core/schema.ts
import { MarketNorm } from "./types";

const num = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

function cleanCategory(m: any): string {
  if (typeof m?.category === "string" && m.category.trim()) return m.category.trim();
  if (Array.isArray(m?.tags) && m.tags[0]) return String(m.tags[0]).trim();
  if (Array.isArray(m?.events) && m.events[0]?.category) return String(m.events[0].category).trim();
  return "uncategorized";
}

// try to keep stable join keys for trades/OI
function sourceMarketId(raw: any): number | null {
  const cand =
    raw?.id ??
    raw?.marketId ??
    (typeof raw?.slug === "string" ? raw.slug.match(/(\d+)(?!.*\d)/)?.[1] : undefined);
  const n = Number(cand);
  return Number.isFinite(n) ? n : null;
}

export const normalizePolymarket = (payload: any): MarketNorm[] => {
  const list =
    Array.isArray(payload?.markets?.nodes) ? payload.markets.nodes :
    Array.isArray(payload?.markets)        ? payload.markets :
    Array.isArray(payload)                 ? payload :
    [];

  return list.map((m: any) => {
    const prob = m.probability ?? m.yes_price;

    return {
      id: `poly_${m.id ?? m.slug ?? m.ticker ?? m.question}`,
      platform: "polymarket",
      question: m.question ?? m.title ?? "unknown",
      // cleaned category
      category: cleanCategory(m),
      yesPrice: num(m.yes_price ?? prob),
      noPrice:  num(m.no_price ?? (typeof prob === "number" ? 1 - prob : null)),
      // keep whatever Gamma gives; we'll overwrite with trades truth in the worker
      volume24h:     num(m.volume24hr ?? m.volume_24h ?? m.volume24h ?? m.day_volume ?? m.dayVolume),
      openInterest:  num(m.open_interest ?? m.openInterest ?? m.oi),
      lastTradeTs:   m.last_trade_time ?? m.lastTradeAt ?? m.updatedAt ?? null,
      // keep raw so we can pull numeric ids later
      raw: { ...m, _sourceMarketId: sourceMarketId(m) },
    };
  });
};
