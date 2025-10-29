// components/ui/card.tsx
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "relative min-w-0 rounded-xl border border-[--color-border]/60 bg-[--color-card] p-4 " +
        "shadow-[0_6px_18px_rgb(0_0_0/0.35)] @container " +
        className
      }
    >
      {children}
    </div>
  );
}
