// apps/web/lib/api.ts
type Category = {
  label: string;
  value: number;
  color: string;
  volumeUsd: number;
};

type Market = {
  id: string;
  title: string;
  volume24h?: number;
  changePct?: number;
  lastTradeTs?: number;
  priceCents?: number;
  category?: string;
};

type Outcome = {
  label: string;
  priceCents: number;
  color: string;
};

type Spotlight = {
  id: string;
  title: string;
  outcomes: Outcome[];
  volume: string;
  launched: string;
};

type Summary = {
  totalVolume24h: number;
  totalOpenInterest: number;
  activeMarkets: number;
  byCategory: Category[];
};

type DashboardData = {
  summary: Summary;
  topMarkets: Market[];
  topMovers: Market[];
  spotlight: Spotlight;
  topics: string[];
};

// toggle between mock & live
const USE_LIVE_API = false;
const BASE_URL = "http://localhost:4001";

export async function getDashboardData(): Promise<DashboardData> {
  if (!USE_LIVE_API) {
    // --- MOCK DATA ---
    return {
      summary: {
        totalVolume24h: 1_211_441,
        totalOpenInterest: 7_804_112,
        activeMarkets: 456,
        byCategory: [
          {
            label: "Politics",
            value: 42,
            color: "#ff7a45",
            volumeUsd: 1_250_000,
          },
          { label: "Crypto", value: 28, color: "#00d8ff", volumeUsd: 980_000 },
          { label: "Sports", value: 14, color: "#2fd673", volumeUsd: 320_000 },
          { label: "Tech", value: 9, color: "#c084f5", volumeUsd: 210_000 },
          { label: "Other", value: 7, color: "#f59e0b", volumeUsd: 150_000 },
        ],
      },
      topMarkets: [
        { id: "1", title: "Will BTC > $60k at 2024 close?", priceCents: 72 },
        { id: "2", title: "Will ETH reach ATH in 2024?", priceCents: 23 },
        { id: "3", title: "Will Trump win the 2024 election?", priceCents: 45 },
        { id: "4", title: "Will Solana exceed $300 in 2025?", priceCents: 31 },
        { id: "5", title: "Will CPI fall below 2%?", priceCents: 19 },
      ],
      topMovers: [
        { id: "m1", title: "Will Bitcoin ETF approval hold?", changePct: 45.2 },
        { id: "m2", title: "Will Democrats win Michigan?", changePct: -12.8 },
        { id: "m3", title: "Will the Fed cut rates in June?", changePct: 29.4 },
        {
          id: "m4",
          title: "Will SpaceX launch Starship again?",
          changePct: 18.3,
        },
      ],
      spotlight: {
        id: "s1",
        title: "Will Solana hit $300 by 12/31?",
        outcomes: [
          { label: "YES", priceCents: 46, color: "#00E5FF" },
          { label: "NO", priceCents: 54, color: "#FF3B58" },
        ],
        volume: "$45,210",
        launched: "Oct 28",
      },
      topics: ["AI", "Trump", "Bitcoin", "Fed", "Elon Musk"],
    };
  }

  // --- LIVE DATA MODE ---
  const [summaryRes, marketsRes] = await Promise.all([
    fetch(`${BASE_URL}/v1/summary/poly`),
    fetch(`${BASE_URL}/v1/markets/poly`),
  ]);

  const summary: Summary = await summaryRes.json();
  const markets: Market[] = await marketsRes.json();

  const topMarkets = [...markets]
    .sort((a: Market, b: Market) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, 5);

  const topMovers = [...markets]
    .sort(
      (a: Market, b: Market) =>
        Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0)
    )
    .slice(0, 5);

  const spotlightMarket = [...markets].sort(
    (a: Market, b: Market) => (b.lastTradeTs || 0) - (a.lastTradeTs || 0)
  )[0];

  const topics = Object.keys(
    markets.reduce((acc: Record<string, number>, m: Market) => {
      const cat = m.category || "Other";
      acc[cat] = (acc[cat] || 0) + (m.volume24h || 0);
      return acc;
    }, {})
  );

  return {
    summary,
    topMarkets,
    topMovers,
    spotlight: {
      id: spotlightMarket.id,
      title: spotlightMarket.title,
      outcomes: [
        { label: "YES", priceCents: 46, color: "#00E5FF" },
        { label: "NO", priceCents: 54, color: "#FF3B58" },
      ],
      volume: "$45,210",
      launched: "Oct 28",
    },
    topics,
  };
}
