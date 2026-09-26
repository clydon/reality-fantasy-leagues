"use client";

import { useLeagueStore } from "@/lib/store";

// Only present once a season has actually been chosen from the picker (demoSeasonData set) --
// the plain generic mock season underneath mode:'mock' by default has no cursor to scrub, since
// it isn't drawn from demo-season-builder.ts at all (see store.ts's chooseDemoSeason).
//
// Defaults to the last episode (the whole, finished season) -- see chooseDemoSeason's comment --
// so this is for stepping BACKWARD to see how the season looked earlier, not a "start of season"
// onboarding flow.
export function DemoEpisodeScrubber() {
  const data = useLeagueStore((s) => s.demoSeasonData);
  const cursor = useLeagueStore((s) => s.demoEpisodeCursor);
  const setCursor = useLeagueStore((s) => s.setDemoEpisodeCursor);

  if (!data || cursor === null) return null;

  return (
    <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <button
        className="rounded-md border border-border px-2 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={cursor <= 1}
        onClick={() => setCursor(1)}
        title="Jump to episode 1"
      >
        ⏮
      </button>
      <button
        className="rounded-md border border-border px-2.5 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={cursor <= 1}
        onClick={() => setCursor(cursor - 1)}
      >
        ← Prev
      </button>
      <span className="font-mono text-xs text-muted-foreground">
        Episode <b className="text-foreground">{cursor}</b> of {data.episodeCount}
      </span>
      <button
        className="rounded-md border border-border px-2.5 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={cursor >= data.episodeCount}
        onClick={() => setCursor(cursor + 1)}
      >
        Next →
      </button>
      <button
        className="rounded-md border border-border px-2 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={cursor >= data.episodeCount}
        onClick={() => setCursor(data.episodeCount)}
        title="Jump to the last episode"
      >
        ⏭
      </button>
    </div>
  );
}
