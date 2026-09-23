"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";

// Direct port of renderOverview() (public/app.js): Side Bets section, the dash-grid of three
// cards, and the post-draft Board grid, in the same order as the original. The Notifications
// banner is the one deliberate omission -- it's not a pure function of state like everything
// else here (it's built from cross-poll deltas: "a bet appeared since last poll", "it just became
// your turn"), so porting it is really its own polling-infrastructure task, not a componentization
// task. See docs/HANDOFF.md in the live repo.
export function OverviewDashboard() {
  const state = useLeagueStore((s) => s.state);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Overview</h2>
      <SideBetsSection state={state} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <LatestEpisodeCard state={state} />
        <SeasonStatusCard state={state} />
        <StandingsCard state={state} />
      </div>
      {draftComplete && (
        <div className="mt-6">
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Board</h3>
          <BoardGrid state={state} />
        </div>
      )}
    </div>
  );
}
