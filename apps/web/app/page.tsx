// app/page.tsx
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Kpi } from "@/components/ui/kpi";
import { CategoryPie } from "@/components/dashboard/category-pie";
import { TopMarkets } from "@/components/dashboard/top-markets";
import { TopMovers } from "@/components/dashboard/top-movers";
import { NewMarketSpotlight } from "@/components/dashboard/new-market-spotlight";
import { TrendingTopics } from "@/components/dashboard/trending-topics";
import { getDashboardData } from "@/lib/api";

// eventually -> import { getDashboardData } from "@/lib/api"

export default async function Page() {
  const { summary, topMarkets, topMovers, spotlight, topics } =
    await getDashboardData();

  // Convert backend Market[] into frontend-safe SimpleMarket[] and Mover[]
  const marketsForUI = topMarkets.map((m) => ({
    id: m.id,
    title: m.title,
    priceCents: m.priceCents ?? 0,
    url: `https://polymarket.com/event/${m.id}`,
  }));

  const moversForUI = topMovers.map((m) => ({
    id: m.id,
    title: m.title,
    deltaPct: m.changePct ?? 0,
    url: `https://polymarket.com/event/${m.id}`,
  }));

  const kpis = [
    { label: "24h Vol", value: `$${summary.totalVolume24h.toLocaleString()}` },
    {
      label: "Open Interest",
      value: `$${summary.totalOpenInterest.toLocaleString()}`,
    },
    { label: "Active Markets", value: summary.activeMarkets.toString() },
    { label: "New Markets (24h)", value: "12" },
  ];

  const pie = summary.byCategory;

  /* =====================================================
     3️⃣ RENDER DASHBOARD
     ===================================================== */
  return (
    <main className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="grid gap-6 lg:grid-cols-3 auto-rows-min">
        {/* KPI SECTION */}
        <Section title="Key Performance Indicators" className="col-span-3">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card
                key={kpi.label}
                className="p-4 min-w-[200px] whitespace-nowrap"
              >
                <Kpi label={kpi.label} value={kpi.value} />
              </Card>
            ))}
          </div>
        </Section>

        {/* MARKET ACTIVITY */}
        <Section title="Market Activity (24h)" className="col-span-2">
          <div className="grid gap-6">
            {/* Top lists */}
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              <Card className="h-full">
                <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] mb-2">
                  Top Markets (24h)
                </div>
                <TopMarkets markets={marketsForUI} />
              </Card>
              <Card className="h-full">
                <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] mb-2">
                  Top Movers (24h)
                </div>
                <TopMovers movers={moversForUI} />
              </Card>
            </div>

            {/* Spotlight */}
            <div className="flex justify-center">
              <Card className="w-[66.666%] pt-3 pb-0">
                <NewMarketSpotlight m={spotlight} />
              </Card>
            </div>
          </div>
        </Section>

        {/* CATEGORIES / TOPICS */}
        <Section title="Categories & Topics" className="col-span-1">
          <div className="grid gap-6">
            <Card className="flex flex-col justify-center items-center p-6">
              <div className="max-w-[260px] w-full">
                <CategoryPie data={pie} title="Categories" total={1234} />
              </div>
            </Card>
            <Card className="p-3">
              <TrendingTopics topics={topics} />
            </Card>
          </div>
        </Section>
      </div>
    </main>
  );
}
