"use client";

import { useState } from "react";
import { useCanManage, useLeagueStore } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { Button } from "@/components/ui/button";
import { EpisodeLinesModal } from "./episode-summary-modal";
import StateLogic from "@/lib/game/state-logic.js";
import { LeaderboardRow } from "./leaderboard-row";
import { PickEmLeaderboardRow } from "./pickem-leaderboard-row";
import { ActiveRosterLeaderboardRow, ScoreboardLegend } from "./active-roster-leaderboard-row";
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
  // The commissioner writes every team's "why it mattered" line for the latest episode. Live leagues
  // only: there's no server to save to in demo mode.
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const [writing, setWriting] = useState(false);
  const latest = leagueType.hasActiveRoster && !hasWeeklyPicks ? latestScoredEpisode(state) : null;
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
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Scoreboard</h2>
      {latest && canManage && leagueId && (
        <div className="mb-3 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setWriting(true)}>
            ✍️ Write episode {latest.number} lines
          </Button>
        </div>
      )}
      {writing && latest && leagueId && (
        <EpisodeLinesModal
          leagueId={leagueId}
          epId={latest.id}
          epNumber={latest.number}
          teams={scores.map((r) => ({ id: r.playerId, name: r.name, color: r.color }))}
          onClose={() => setWriting(false)}
        />
      )}
      {leagueType.hasActiveRoster && !leagueType.hasWeeklyPicks && <ScoreboardLegend />}
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
