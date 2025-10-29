import * as React from "react";

export function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        // distinctly darker background with strong border contrast
        "rounded-2xl border border-[#0a1619] bg-[#090f10]/95",
        "backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)]",
        "p-5 sm:p-6 transition-colors duration-200",
        className,
      ].join(" ")}
    >
      <h2
        className="
          mb-4 text-lg sm:text-xl font-semibold tracking-wide text-[--color-text]
          border-b border-[#132225] pb-2
        "
      >
        {title}
      </h2>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
