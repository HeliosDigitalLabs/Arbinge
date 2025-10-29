"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

export type Outcome = {
  label: string;
  priceCents: number;
  color?: string;
};

export function OutcomeBarChart({ outcomes }: { outcomes: Outcome[] }) {
  if (!outcomes?.length) return null;

  const data = outcomes.map((o) => ({
    name: o.label,
    value: o.priceCents,
    fill: o.color || "var(--color-accent)",
  }));

  return (
    <div className="relative w-full h-60">
      {/* faint background glow */}
      <div className="absolute inset-0 bg-linear-to-b from-white/3 to-transparent rounded-lg pointer-events-none" />

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
          barSize={80 / data.length + 35} // auto-scale bar width
        >
          <CartesianGrid
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--color-text)", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "var(--color-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />

          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={entry.fill}
                style={{
                  filter:
                    "drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 -1px 2px rgba(255,255,255,0.1))",
                }}
              />
            ))}
            {/* inside labels */}
            <LabelList
              dataKey="value"
              position="insideTop"
              offset={12}
              fill="white"
              fontSize={12}
              formatter={(label: any) => `${label}¢`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
