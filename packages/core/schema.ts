import { MarketNorm } from "./types";

const num = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

export const normalizePolymarket = (payload: any): MarketNorm[] => {
  // Accept either { markets: { nodes: [...] }} from GraphQL or plain arrays
  // GraphQL shape: { data: { markets: { nodes: [...] } } } will be flattened by the caller
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
      category: m.category ?? (Array.isArray(m.tags) && m.tags[0]) ?? "uncategorized",
      yesPrice: num(m.yes_price ?? prob),
      noPrice: num(m.no_price ?? (typeof prob === "number" ? 1 - prob : null)),
      // ✅ Include GraphQL fields (dayVolume + openInterest) + legacy fallbacks
      volume24h: num(m.volume24hr ?? m.volume_24h ?? m.volume24h ?? m.day_volume ?? m.dayVolume),
      openInterest: num(m.open_interest ?? m.openInterest ?? m.oi ?? m.openInterest),
      lastTradeTs: m.last_trade_time ?? m.lastTradeAt ?? m.updatedAt ?? null,
      raw: m,
    };
  });
};

export const normalizeKalshi = (payload: any): MarketNorm[] => {
  const list =
    Array.isArray(payload?.markets) ? payload.markets :
    Array.isArray(payload)         ? payload :
    [];

  return list.map((m: any) => {
    const prob = m.implied_prob ?? m.last_price_yes;

    return {
      id: `kal_${m.ticker ?? m.id ?? m.question}`,
      platform: "kalshi",
      question: m.title ?? m.question ?? "unknown",
      category: m.category ?? m.classification ?? "uncategorized",
      yesPrice: num(m.yes_price ?? m.last_price_yes ?? prob),
      noPrice: num(m.no_price ?? m.last_price_no ?? (typeof prob === "number" ? 1 - prob : null)),
      volume24h: num(m.volume_24h ?? m.day_volume),
      openInterest: num(m.open_interest ?? m.open_interest_usd ?? m.oi),
      lastTradeTs: m.last_trade_time ?? m.last_trade_at ?? m.close_time ?? null,
      raw: m,
    };
  });
};
