import { OutcomeBarChart } from "../ui/outcome-bar-chart";

type Outcome = {
  label: string;
  priceCents: number;
  color: string;
};

type Market = {
  id: string;
  title: string;
  volume?: string;
  launched?: string;
  outcomes: Outcome[];
};

export function NewMarketSpotlight({ m }: { m: Market }) {
  return (
    <div
      className="
    grid grid-cols-[auto_1fr]
    items-center
    gap-4
    py-0
  "
    >
      {/* LEFT — TEXT */}
      <div className="flex flex-col justify-center space-y-1 pl-2">
        <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted]">
          Hottest New Market
        </div>

        <h3 className="text-[1rem] font-medium leading-snug text-[--color-text] max-w-[95%]">
          {m.title}
        </h3>

        <div className="text-[.8rem] text-[--color-muted]">
          Vol {m.volume ?? "—"} · Launched {m.launched ?? "—"}
        </div>
      </div>

      {/* RIGHT — CHART */}
      <div className="flex items-center justify-center self-stretch">
        <div
          className="
        w-full
        max-w-[420px]
        aspect-5/3
        flex
        items-center
        justify-center
      "
        >
          <OutcomeBarChart outcomes={m.outcomes} />
        </div>
      </div>
    </div>
  );
}
