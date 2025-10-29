import type { SimpleMarket } from "@/lib/types";

export function TopMarkets({ markets }: { markets: SimpleMarket[] }) {
  return (
    <ul className="space-y-2" aria-label="Top Markets">
      {markets.map((m) => (
        <li key={m.id}>
          <a
            href={m.url}
            target="_blank" // 👈 open in new tab
            rel="noopener noreferrer" // 👈 security best practice
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
              <span className="shrink-0 font-mono tabular-nums text-[--color-accent] text-[0.8rem]">
                {m.priceCents}
                <span className="opacity-75">¢</span>
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
