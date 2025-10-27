"use client";

import React from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * DROP-IN USAGE
 * -------------
 * 1) Put this file somewhere like `apps/web/app/dashboard/page.tsx` (or replace your `app/page.tsx`).
 * 2) Ensure NEXT_PUBLIC_API_URL is set to your API base (e.g., http://104.248.224.160:4001).
 * 3) This page fetches once on mount and then revalidates every hour (client-side) to match your ingest cadence.
 */

// ---- Types aligned with your server ----
export type Summary = {
  activeMarkets: number;
  totalVolume24h: number;
  totalOpenInterest: number;
  byPlatform: {
    polymarket: { active: number; vol24h: number; oi: number };
    kalshi: { active: number; vol24h: number; oi: number };
  };
  byCategory: Array<{ category: string; vol24h: number; count: number }>;
};

export type Market = {
  id: string;
  platform: "polymarket" | "kalshi" | string;
  question: string;
  category?: string;
  yesPrice?: number | null;
  volume24h?: number | null;
  openInterest?: number | null;
};

const fetcher = async <T,>(path: string): Promise<T> => {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const r = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

const fmtMoney = (n?: number | null) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString()}` : "-";

const fmtNum = (n: number) => n.toLocaleString();

// A simple hour-level revalidation (60 * 60 * 1000)
const ONE_HOUR = 3600000;

export default function DashboardPage() {
  const { data: summary, error: se, isLoading: sl } = useSWR<Summary>(
    "/v1/summary",
    fetcher,
    { refreshInterval: ONE_HOUR }
  );

  return (
    <main className="mx-auto max-w-7xl p-6 min-h-screen bg-[#0b1220] text-gray-200">
      <h1 className="text-2xl font-semibold mb-6">Arbinge — Prediction Market Macro Dashboard</h1>

      {summary && (
        <TopStats summary={summary} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {summary && (
          <Card title="Platform Breakdown (Active / 24h Vol / OI)">
            <PlatformBars summary={summary} />
          </Card>
        )}

        {summary && (
          <Card title="Top Categories by 24h Volume (Top 8)">
            <CategoriesBar summary={summary} />
          </Card>
        )}
      </div>  

      <footer className="mt-10 text-xs text-gray-500">
        Updates hourly • Data source: Polymarket & Kalshi • Last refresh is client-side; ensure workers run hourly
      </footer>
    </main>
  );
}

// ---- UI Primitives ----
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#111827] rounded-2xl p-4 shadow-lg border border-[#1f2937]">
      <div className="text-sm text-gray-400 mb-3">{title}</div>
      {children}
    </section>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111827] rounded-2xl p-4 shadow-lg border border-[#1f2937]">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl mt-1">{value}</div>
    </div>
  );
}

// ---- Sections ----
function TopStats({ summary }: { summary: Summary }) {
  const kpis = [
    { label: "Active Markets (All)", value: fmtNum(summary.activeMarkets) },
    { label: "24h Volume (All)", value: fmtMoney(summary.totalVolume24h) },
    { label: "Open Interest (All)", value: fmtMoney(summary.totalOpenInterest) },
    { label: "Active — Polymarket", value: fmtNum(summary.byPlatform.polymarket.active) },
    { label: "Active — Kalshi", value: fmtNum(summary.byPlatform.kalshi.active) },
    { label: "24h Vol — Polymarket", value: fmtMoney(summary.byPlatform.polymarket.vol24h) },
    { label: "24h Vol — Kalshi", value: fmtMoney(summary.byPlatform.kalshi.vol24h) },
    { label: "OI — Polymarket", value: fmtMoney(summary.byPlatform.polymarket.oi) },
    { label: "OI — Kalshi", value: fmtMoney(summary.byPlatform.kalshi.oi) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {kpis.map((k) => (
        <KPI key={k.label} label={k.label} value={k.value} />
      ))}
    </div>
  );
}

function PlatformBars({ summary }: { summary: Summary }) {
  const data = [
    {
      name: "Polymarket",
      Active: summary.byPlatform.polymarket.active,
      "24h Vol": Math.round(summary.byPlatform.polymarket.vol24h || 0),
      OI: Math.round(summary.byPlatform.polymarket.oi || 0),
    },
    {
      name: "Kalshi",
      Active: summary.byPlatform.kalshi.active,
      "24h Vol": Math.round(summary.byPlatform.kalshi.vol24h || 0),
      OI: Math.round(summary.byPlatform.kalshi.oi || 0),
    },
  ];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Active" />
          <Bar dataKey="24h Vol" />
          <Bar dataKey="OI" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoriesBar({ summary }: { summary: Summary }) {
  const data = (summary.byCategory || [])
    .slice(0, 8)
    .map((c) => ({ name: c.category || "uncategorized", Volume: Math.round(c.vol24h || 0) }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="Volume" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-2 text-left ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2 align-top ${className}`}>{children}</td>;
}
