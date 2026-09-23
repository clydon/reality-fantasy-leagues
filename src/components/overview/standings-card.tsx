import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { DashCard, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Standings" card -- the wide one, using the same
// StateLogic.computeScores(state) the live app and server both call (ScoringLogic.compute
// under the hood). Nothing here re-implements scoring; it's the same shared logic.
export function StandingsCard({ state }: { state: LeagueState }) {
  const scores = StateLogic.computeScores(state);

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
            <span className="ml-auto font-mono font-bold">{r.total}</span>
          </div>
        ))
      )}
      <DashLink>View full scoreboard →</DashLink>
    </DashCard>
  );
}
