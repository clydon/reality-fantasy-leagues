"use client";

import type { LeagueState, ScoreRow } from "@/lib/game/types";
import { playerEventRows } from "@/lib/game/active-roster-rows";
import { playerBetRows } from "@/lib/game/bet-rows";
import { cn } from "cn";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayStatCard } from "@/components/castaway-stat-card";

// Active Roster's leaderboard row. Separate from LeaderboardRow because that one's breakdown is
// "Boot Order" plus a roster list with elimination placements -- which is exactly what this league
// type does NOT score on. Here the interesting breakdown is which events actually paid out, and the
// roster disclosure has to distinguish what was ACTIVE from what sat on the bench, since a benched
// castaway's events score nothing.
export function ActiveRosterLeaderboardRow({ r, rank, state }: { r: ScoreRow; rank: number; state: LeagueState }) {
  const terms = useShowTerms();
  const bonusEnabled = state.settings.bonusEnabled;
  const bets = bonusEnabled ? playerBetRows(state, r.playerId) : [];
  const eventRows = playerEventRows(state, r.playerId);

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <div className={cn("flex items-center gap-3 p-3.5", rank === 1 && "bg-primary/5")}>
        <div className="w-6 text-center font-mono text-lg font-bold text-muted-foreground">{rank}</div>
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
        <div className="flex-1">
          <div className="font-bold">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            Events: {r.locked}
            {bonusEnabled ? ` · Bonus: ${r.bonus}` : ""} · Finale: {r.finale}
          </div>
        </div>
        <div className="font-mono text-xl font-bold">{r.total}</div>
      </div>

      <details className="border-t border-border px-3.5 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Scoring events ({eventRows.length})</summary>
        <div className="mt-2 flex flex-col gap-1">
          {eventRows.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">No events scored yet</div>
          ) : (
            eventRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">
                  Ep {row.episode}
                  {row.postMerge ? " 🔀" : ""}
                </span>
                <span className="flex-1">
                  {row.castawayName} — <span className="text-muted-foreground">{row.label}</span>
                </span>
                <span className="font-mono text-xs">+{row.points}</span>
              </div>
            ))
          )}
        </div>
      </details>

      <details className="border-t border-border px-3.5 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Roster detail</summary>
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          {r.roster.length === 0 && <div className="text-xs italic text-muted-foreground">No roster</div>}
          {r.roster.map((c) => (
            <CastawayStatCard key={c.id} state={state} castaway={c} showOwner={false} showPlacementBadge={false} expanded />
          ))}
          {r.formerRoster.map((c) => (
            <div key={c.id} className="opacity-60">
              <CastawayStatCard state={state} castaway={c} showOwner={false} showPlacementBadge={false} expanded />
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
          Being on the roster isn&rsquo;t enough — only {terms.castaways} in that episode&rsquo;s active lineup earned
          points.
        </p>
      </details>

      {bonusEnabled && (
        <details className="border-t border-border px-3.5 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Bonus bets ({bets.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {bets.length === 0 ? (
              <div className="text-xs italic text-muted-foreground">No bets predicted</div>
            ) : (
              bets.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">Ep {b.episode}</span>
                  <span className="flex-1">
                    {b.label} — <span className="text-muted-foreground">&ldquo;{b.guess}&rdquo;</span>
                  </span>
                  <span className="font-mono font-bold">+{b.points}</span>
                </div>
              ))
            )}
          </div>
        </details>
      )}
    </div>
  );
}
