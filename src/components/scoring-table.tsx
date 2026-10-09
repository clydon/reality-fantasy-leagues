import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { scoringGroups } from "@/lib/game/scoring-groups";
import { cn } from "cn";

// What each event is worth in this league, grouped by the show's own categories
// (format.eventCategories: Challenges, Tribal Council, Endgame...) in that order, highest points first
// within each; zero-point events are left out as noise, and a category with nothing left is skipped.
export function scoringTableGroups(state: LeagueState) {
  return scoringGroups(state)
    .map((g) => ({
      ...g,
      rows: g.events
        .map((e) => ({ id: e.id, label: e.label, points: StateLogic.ActiveRosterLogic.pointsFor(state, e.id) }))
        .filter((r) => r.points !== 0)
        .sort((a, b) => b.points - a.points),
    }))
    .filter((g) => g.rows.length > 0);
}

// Shared by the lineup card's "How starters score" and the Scoreboard's "League Scoring" card.
export function ScoringTable({ groups }: { groups: ReturnType<typeof scoringTableGroups> }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.id}>
          <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</div>
          {g.rows.map((r) => (
            <div key={r.id} className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-xs">
              <span className="min-w-0 text-muted-foreground">{r.label}</span>
              <span className={cn("shrink-0 font-mono font-semibold", r.points > 0 ? "text-good" : "text-destructive")}>
                {r.points > 0 ? `+${r.points}` : r.points}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
