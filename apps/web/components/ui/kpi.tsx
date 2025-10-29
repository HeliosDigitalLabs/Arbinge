// components/ui/kpi.tsx
export function Kpi({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] whitespace-nowrap">
        {label}
      </div>
      <div
        className="mt-1 font-mono tabular-nums overflow-hidden leading-none
                      text-[clamp(1.4rem,6cqw,2.6rem)] whitespace-nowrap"
      >
        {value}
      </div>
    </div>
  );
}
