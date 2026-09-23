"use client";

import type { LeagueState, ScoreRow } from "@/lib/game/types";
import { playerPickRows } from "@/lib/game/pickem-rows";
import { cn } from "cn";

// Pick'em's own leaderboard row -- LeaderboardRow's "Boot Order"/roster-detail framing describes
// classic-draft's own scoring (elimination placement of a drafted roster), which doesn't apply
// here at all: pickem has no roster, and its score is "how many weekly picks were right", so this
// gets its own presentation of the same ScoreRow shape (r.locked/r.total are pickem's core score,
// see PickEmScoringStrategy's comment on why it reuses that field) rather than forcing pickem's
// numbers through classic-draft's labels.
export function PickEmLeaderboardRow({ r, rank, state }: { r: ScoreRow; rank: number; state: LeagueState }) {
  const rows = playerPickRows(state, r.playerId);
  const correctCount = rows.filter((row) => row.correct === true).length;
  const decidedCount = rows.filter((row) => row.correct !== null).length;

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <div className={cn("flex items-center gap-3 p-3.5", rank === 1 && "bg-primary/5")}>
        <div className="w-6 text-center font-mono text-lg font-bold text-muted-foreground">{rank}</div>
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
        <div className="flex-1">
          <div className="font-bold">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {correctCount}/{decidedCount} picks correct
          </div>
        </div>
        <div className="font-mono text-xl font-bold">{r.total}</div>
      </div>

      <details className="border-t border-border px-3.5 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Pick history</summary>
        <div className="mt-2 flex flex-col gap-1">
          {rows.length === 0 && <div className="text-xs italic text-muted-foreground">No picks yet</div>}
          {rows.map((row) => (
            <div key={row.episode} className="flex items-center gap-2 text-sm">
              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">
                Ep {row.episode}
                {row.postMerge ? " 🔀" : ""}
              </span>
              <span className="flex-1">{row.castawayName}</span>
              {row.correct === true ? (
                <span className="rounded bg-good/15 px-1.5 py-0.5 text-xs font-semibold text-good">Correct</span>
              ) : row.correct === false ? (
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive">Incorrect</span>
              ) : (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">Pending</span>
              )}
              <span className="font-mono text-xs">+{row.points}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
