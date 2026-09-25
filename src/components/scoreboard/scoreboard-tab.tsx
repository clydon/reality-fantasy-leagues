"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LeaderboardRow } from "./leaderboard-row";
import { PickEmLeaderboardRow } from "./pickem-leaderboard-row";
import { ActiveRosterLeaderboardRow } from "./active-roster-leaderboard-row";
import { useShowTerms } from "@/lib/use-show-terms";

// Direct port of renderScoreboard() (public/app.js). Pure read -- no mutations, no canManage()
// branching, so no use-mutate.ts hook needed here at all. Row component is chosen per league
// type -- LeaderboardRow's "Boot Order"/roster framing is classic-draft-specific and doesn't
// describe pickem's scoring at all (see PickEmLeaderboardRow's own comment).
export function ScoreboardTab() {
  const terms = useShowTerms();
  const state = useLeagueStore((s) => s.state);
  const scores = StateLogic.computeScores(state);
  const leagueType = StateLogic.getLeagueType(state);
  const hasWeeklyPicks = leagueType.hasWeeklyPicks;
  const winner = StateLogic.formatOf(state).winnerExitMethod;
  // One row component per scoring model. Each league type's breakdown describes how ITS points are
  // earned -- boot order, correct picks, or scoring events -- rather than forcing all three through
  // classic-draft's labels.
  const Row = hasWeeklyPicks
    ? PickEmLeaderboardRow
    : leagueType.hasActiveRoster
    ? ActiveRosterLeaderboardRow
    : LeaderboardRow;

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Scoreboard</h2>
      {scores.map((r, i) => (
        <Row key={r.playerId} r={r} rank={i + 1} state={state} />
      ))}
      {!hasWeeklyPicks && !leagueType.hasActiveRoster && (
        <p className="mt-4 text-sm text-muted-foreground">
          Total {terms.castaways} this season: {state.castaways.length}. {winner} should be logged as the final
          elimination-order event (method &ldquo;{winner}&rdquo;) so their placement points count.
        </p>
      )}
    </>
  );
}
