"use client";

import { useLeagueStore } from "@/lib/store";
import { EpisodeCard } from "./episode-card";
import { CatchUpPanel } from "./catch-up-panel";

// Port of renderEpisodes() (public/app.js): + Add New Episode button, then episode cards newest
// first. renderUnsettledBetsPanel() isn't ported -- it's pure duplication of the "needs your
// guess" signal already in Overview's Side Bets section for members, and commissioner-only
// grading is already available inline on each bet here, so it doesn't add anything this POC
// doesn't already validate elsewhere.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);

  const sorted = [...state.episodes].sort((a, b) => b.number - a.number);
  const latestNumber = sorted[0]?.number;

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Episodes</h2>
      {/* Above the episode list: in a catch-up league this is where the next episode gets revealed.
          Renders nothing for a league that isn't catching up. */}
      <CatchUpPanel state={state} />
      {sorted.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No episodes logged yet.</div>
      ) : (
        sorted.map((ep) => (
          <EpisodeCard
            key={ep.id}
            ep={ep}
            state={state}
            defaultOpen={ep.number === latestNumber}
          />
        ))
      )}
    </>
  );
}
