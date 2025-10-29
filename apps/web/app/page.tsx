// app/page.tsx
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Kpi } from "@/components/ui/kpi";
import { CategoryPie } from "@/components/dashboard/category-pie";
import { TopMarkets } from "@/components/dashboard/top-markets";
import { TopMovers } from "@/components/dashboard/top-movers";
import { NewMarketSpotlight } from "@/components/dashboard/new-market-spotlight";
import { TrendingTopics } from "@/components/dashboard/trending-topics";

export default async function Page() {
  const topMarkets = [
    {
      id: "1",
      title: "Will BTC > $60k at 2024 close?",
      priceCents: 72,
      url: "https://polymarket.com/event/1",
    },
    {
      id: "2",
      title: "Will ETH reach ATH in 2024?",
      priceCents: 23,
      url: "https://polymarket.com/event/2",
    },
    {
      id: "3",
      title: "Will Trump win the 2024 election?",
      priceCents: 45,
      url: "https://polymarket.com/event/3",
    },
    {
      id: "4",
      title: "Will Solana exceed $300 in 2025?",
      priceCents: 31,
      url: "https://polymarket.com/event/4",
    },
    {
      id: "5",
      title: "Will Solana exceed $300 in 2025?",
      priceCents: 31,
      url: "https://polymarket.com/event/4",
    },
  ];

  const movers = [
    {
      id: "m1",
      title: "Will Bitcoin ETF approval hold?",
      deltaPct: 45.2,
      url: "https://polymarket.com/event/m1",
    },
    {
      id: "m2",
      title: "Will Democrats win Michigan?",
      deltaPct: -12.8,
      url: "https://polymarket.com/event/m2",
    },
    {
      id: "m3",
      title: "Will the Fed cut rates in June?",
      deltaPct: 29.4,
      url: "https://polymarket.com/event/m3",
    },
    {
      id: "m4",
      title: "Will SpaceX launch Starship again?",
      deltaPct: 18.3,
      url: "https://polymarket.com/event/m4",
    },
    {
      id: "m5",
      title: "Will SpaceX launch Starship again?",
      deltaPct: 18.3,
      url: "https://polymarket.com/event/m4",
    },
  ];
  const pie = [
    { label: "Politics", value: 42, color: "#ff7a45", volumeUsd: 1_250_000 },
    { label: "Crypto", value: 28, color: "#00d8ff", volumeUsd: 980_000 },
    { label: "Sports", value: 14, color: "#2fd673", volumeUsd: 320_000 },
    { label: "Tech", value: 9, color: "#c084f5", volumeUsd: 210_000 },
    { label: "Other", value: 7, color: "#f59e0b", volumeUsd: 150_000 },
  ];
  const totalMarkets = 1234;

  const spotlight = {
    id: "s1",
    title: "Will Solana hit $300 by 12/31?",
    yesCents: 46,
    noCents: 54,
    firstDayVolumeUsd: 45210,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  };
  const topics = ["AI", "Trump", "Bitcoin", "Fed", "Elon Musk"];

  return (
    <main className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* PAGE GRID: top full-width row, bottom split 2/3 + 1/3 */}
      <div className="grid gap-6 lg:grid-cols-3 auto-rows-min">
        {/* =========================================================
        1️⃣ MARKET OVERVIEW — FULL TOP ROW
      ========================================================== */}
        <Section title="Key Performance Indicators" className="col-span-3">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 min-w-[200px] whitespace-nowrap">
              <Kpi label="24h Vol" value="$1,211,441" />
            </Card>
            <Card className="p-4 min-w-[200px] whitespace-nowrap">
              <Kpi label="Open Interest" value="$7,804,112" />
            </Card>
            <Card className="p-4 min-w-[200px] whitespace-nowrap">
              <Kpi label="Total Volume" value="$102,344,129" />
            </Card>
            <Card className="p-4 min-w-[200px] whitespace-nowrap">
              <Kpi label="New Markets (24h)" value="12" />
            </Card>
          </div>
        </Section>

        {/* =========================================================
        2️⃣ LEFT: MARKET ACTIVITY (2/3 WIDTH)
      ========================================================== */}
        <Section title="Market Activity (24h)" className="col-span-2">
          <div className="grid gap-6">
            {/* TOP ROW: Two lists side-by-side */}
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* Top Markets */}
              <Card className="h-full">
                <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] mb-2">
                  Top Markets (24h)
                </div>
                <TopMarkets markets={topMarkets.slice(0, 5)} />
              </Card>

              {/* Top Movers */}
              <Card className="h-full">
                <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] mb-2">
                  Top Movers (24h)
                </div>
                <TopMovers movers={movers.slice(0, 5)} />
              </Card>
            </div>

            {/* BOTTOM ROW: Hottest New Market spans 2/3 of section width */}
            <div className="flex justify-center">
              <Card className="w-[66.666%] pt-3 pb-0">
                <NewMarketSpotlight
                  m={{
                    id: spotlight.id,
                    title: spotlight.title,
                    volume: `$${spotlight.firstDayVolumeUsd.toLocaleString()}`,
                    launched: new Date(spotlight.createdAt).toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      }
                    ),
                    outcomes: [
                      {
                        label: "YES",
                        priceCents: spotlight.yesCents,
                        color: "#00E5FF",
                      },
                      {
                        label: "NO",
                        priceCents: spotlight.noCents,
                        color: "#FF3B58",
                      },
                    ],
                  }}
                />
              </Card>
            </div>
          </div>
        </Section>

        {/* =========================================================
        3️⃣ RIGHT: CATEGORIES & TOPICS (1/3 WIDTH)
      ========================================================== */}
        <Section title="Categories & Topics" className="col-span-1">
          <div className="grid gap-6">
            {/* Categories (pie + legend) FIRST */}
            <Card className="flex flex-col justify-center items-center p-6">
              <div className="max-w-[260px] w-full">
                <CategoryPie data={pie} title="Categories" total={1234} />
              </div>
            </Card>

            {/* Trending Topics SECOND */}
            <Card className="p-3">
              <TrendingTopics topics={topics} />
            </Card>
          </div>
        </Section>
      </div>
    </main>
  );
}
