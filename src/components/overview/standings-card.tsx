import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { DashCard, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Standings" card -- the wide one, using the same
// StateLogic.computeScores(state) the live app and server both call (ScoringLogic.compute
// under the hood). Nothing here re-implements scoring; it's the same shared logic.
export function StandingsCard({ state }: { state: LeagueState }) {
  const scores = StateLogic.computeScores(state);
  // Pick'em ranks by longest streak (total points break ties), so that's the number shown.
  const pickem = StateLogic.getLeagueType(state).hasWeeklyPicks;

  return (
    <DashCard title="Standings" wide>
      {scores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add players in League Settings to get started.</p>
      ) : (
        scores.map((r, i) => (
          <div key={r.playerId} className="flex items-center gap-2.5 py-1.5 text-sm">
            <span className="w-4 font-mono text-muted-foreground">{i + 1}</span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
            <span>{r.name}</span>
            {pickem ? (
              <span className="ml-auto text-right font-mono">
                <b>{r.longestStreak ?? 0}</b> <span className="text-xs text-muted-foreground">streak · {r.total} pts</span>
              </span>
            ) : (
              <span className="ml-auto font-mono font-bold">{r.total}</span>
            )}
          </div>
        ))
      )}
      <DashLink href="/scoreboard">View full scoreboard →</DashLink>
    </DashCard>
  );
}
