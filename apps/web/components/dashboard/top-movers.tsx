import type { Mover } from "@/lib/types";

export function TopMovers({ movers }: { movers: Mover[] }) {
  return (
    <ul className="space-y-2" aria-label="Top Movers">
      {movers.map((m) => {
        const up = m.deltaPct >= 0;
        return (
          <li key={m.id}>
            <a
              href={m.url}
              target="_blank" // 👈 open in new tab
              rel="noopener noreferrer"
              className="
                group block rounded-lg border border-[--color-border]/60 bg-[--color-card]/60 px-3 py-2
                transition hover:bg-white/5 hover:border-[--color-accent]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]
              "
            >
              <div className="flex items-center justify-between gap-3">
                <span className="pr-3 text-[0.8rem] wrap-break-word">
                  {m.title}
                </span>
                <span
                  className={`shrink-0 font-mono tabular-nums text-[0.8rem] ${
                    up ? "text-[--color-good]" : "text-[--color-bad]"
                  }`}
                >
                  {up ? "+" : ""}
                  {m.deltaPct.toFixed(1)}%
                </span>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
