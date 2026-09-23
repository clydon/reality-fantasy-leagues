"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LeaderboardRow } from "./leaderboard-row";

// Direct port of renderScoreboard() (public/app.js). Pure read -- no mutations, no canManage()
// branching, so no use-mutate.ts hook needed here at all.
export function ScoreboardTab() {
  const state = useLeagueStore((s) => s.state);
  const scores = StateLogic.computeScores(state);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Scoreboard</h2>
      {scores.map((r, i) => (
        <LeaderboardRow key={r.playerId} r={r} rank={i + 1} state={state} />
      ))}
      <p className="mt-4 text-sm text-muted-foreground">
        Total castaways this season: {state.castaways.length}. Sole Survivor should be logged as the final
        elimination-order event (method &ldquo;Sole Survivor&rdquo;) so their placement points count.
      </p>
    </>
  );
}
