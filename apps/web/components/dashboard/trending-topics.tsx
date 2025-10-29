// components/dashboard/trending-topics.tsx
export function TrendingTopics({ topics }: { topics: string[] }) {
  return (
    <div>
      <div className="uppercase tracking-wide text-[.75rem] text-[--color-muted] mb-2">
        Trending Topics
      </div>

      {/* Wrap chips to new lines as needed; they’ll fit the card width */}
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <a
            key={topic}
            href={`https://polymarket.com/search?_q=${encodeURIComponent(
              topic
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center justify-center
              px-3 py-1 rounded-md whitespace-nowrap
              border border-[--color-border]/60 bg-[--color-card]/60
              text-[0.8rem] text-[--color-text]
              transition hover:border-[--color-accent] hover:text-[--color-accent] hover:bg-white/5
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]
            "
          >
            {topic}
          </a>
        ))}
      </div>
    </div>
  );
}
