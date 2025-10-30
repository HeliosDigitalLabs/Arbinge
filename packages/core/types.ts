export type MarketNorm = {
  id: string;
  platform: "polymarket";
  question: string;
  category?: string;
  yesPrice: number | null;
  noPrice: number | null;
  volume24h: number | null;
  openInterest: number | null;
  lastTradeTs: string | null; // ISO
  raw: Record<string, any>;
};

export type SummaryStats = {
  activeMarkets: number;
  totalVolume24h: number;
  totalOpenInterest: number;
  byPlatform: {
    polymarket: { active: number; vol24h: number; oi: number };
  };
  byCategory: Array<{ category: string; vol24h: number; count: number }>;
};
