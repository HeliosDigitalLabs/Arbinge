"use client";

import { useMemo, useRef, useState } from "react";

export type PieSlice = {
  label: string;
  value: number; // # of markets in the category
  color: string;
  volumeUsd?: number; // optional: total volume for the category
};

type HoverState = {
  label: string;
  value: number;
  volumeUsd?: number;
  x: number;
  y: number;
} | null;

export function CategoryPie({
  data,
  title = "Categories",
  total,
  showCountsOnSlices = false,
}: {
  data: PieSlice[];
  title?: string;
  total?: number;
  showCountsOnSlices?: boolean;
}) {
  const totalValue = data.reduce((s, d) => s + (d.value || 0), 0) || 1;

  const arcs = useMemo(() => {
    let start = -Math.PI / 2; // start at 12 o'clock
    return data.map((d) => {
      const angle = (d.value / totalValue) * Math.PI * 2;
      const arc = { start, end: start + angle, ...d };
      start += angle;
      return arc;
    });
  }, [data, totalValue]);

  const rOuter = 80;
  const rInner = 48;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState>(null);

  const onMove = (e: React.MouseEvent, a: (typeof arcs)[number]) => {
    const rect = wrapperRef.current!.getBoundingClientRect();
    setHover({
      label: a.label,
      value: a.value,
      volumeUsd: a.volumeUsd,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full select-none flex flex-col items-center"
    >
      {/* Header */}
      <div className="mb-2 uppercase tracking-wide text-[.75rem] text-[--color-muted] text-center">
        {title}
        {total != null && (
          <>
            {" "}
            · <span className="text-[--color-text]">{total}</span> markets
          </>
        )}
      </div>

      {/* Donut */}
      <svg
        className="block w-full h-full max-h-[260px]"
        viewBox="0 0 200 200"
        role="img"
        aria-label="Category breakdown"
      >
        <g transform="translate(100,100)">
          {arcs.map((a) => {
            const large = a.end - a.start > Math.PI ? 1 : 0;
            const [sx, sy] = [
              Math.cos(a.start) * rOuter,
              Math.sin(a.start) * rOuter,
            ];
            const [ex, ey] = [
              Math.cos(a.end) * rOuter,
              Math.sin(a.end) * rOuter,
            ];
            const [sx2, sy2] = [
              Math.cos(a.end) * rInner,
              Math.sin(a.end) * rInner,
            ];
            const [ex2, ey2] = [
              Math.cos(a.start) * rInner,
              Math.sin(a.start) * rInner,
            ];

            const mid = (a.start + a.end) / 2;
            const cx = Math.cos(mid) * ((rOuter + rInner) / 2);
            const cy = Math.sin(mid) * ((rOuter + rInner) / 2);

            const d = `
              M ${sx} ${sy}
              A ${rOuter} ${rOuter} 0 ${large} 1 ${ex} ${ey}
              L ${sx2} ${sy2}
              A ${rInner} ${rInner} 0 ${large} 0 ${ex2} ${ey2}
              Z
            `;

            return (
              <g
                key={a.label}
                onMouseMove={(e) => onMove(e, a)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <path d={d} fill={a.color} opacity={0.95} />
                {showCountsOnSlices && a.value > 0 && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-mono text-[10px] fill-white"
                    style={{
                      paintOrder: "stroke",
                      stroke: "rgba(0,0,0,.35)",
                      strokeWidth: 2,
                    }}
                  >
                    {a.value}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ✅ LEGEND */}
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-[--color-text]/90">{d.label}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip — glassy + readable */}
      {hover && (
        <div
          className="
            absolute z-20 inline-block whitespace-nowrap pointer-events-none
            rounded-lg border border-white/20 bg-black/40 backdrop-blur-md
            text-white px-3 py-2 text-sm shadow-xl
            [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]
          "
          style={{
            left: Math.min(
              Math.max(8, hover.x + 12),
              (wrapperRef.current?.clientWidth ?? 240) - 8
            ),
            top: Math.max(8, hover.y - 42),
          }}
        >
          <div className="font-semibold">{hover.label}</div>
          <div className="font-mono tabular-nums">{hover.value} markets</div>
          {typeof hover.volumeUsd === "number" && (
            <div className="font-mono tabular-nums opacity-90">
              Vol{" "}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(hover.volumeUsd)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
