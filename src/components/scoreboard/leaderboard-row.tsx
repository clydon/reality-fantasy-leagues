"use client";

import type { LeagueState, ScoreRow } from "@/lib/game/types";
import { playerBetRows } from "@/lib/game/bet-rows";
import { cn } from "cn";
import { CastawayStatCard } from "@/components/castaway-stat-card";

// Port of one iteration of renderScoreboard()'s .map() (public/app.js): the leaderboard row plus
// its two <details> disclosures (Roster detail, Bonus bets). Both use the native <details>
// element directly (not useState) -- unlike the toggle flags converted to local state elsewhere
// in this POC, there's no shared/global state here to eliminate; <details> already IS
// self-contained per-instance state, so it's the more direct translation.
export function LeaderboardRow({ r, rank, state }: { r: ScoreRow; rank: number; state: LeagueState }) {
  const bonusEnabled = state.settings.bonusEnabled;
  const bets = bonusEnabled ? playerBetRows(state, r.playerId) : [];

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <div className={cn("flex items-center gap-3 p-3.5", rank === 1 && "bg-primary/5")}>
        <div className="w-6 text-center font-mono text-lg font-bold text-muted-foreground">{rank}</div>
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
        <div className="flex-1">
          <div className="font-bold">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            Elimination order: {r.locked}
            {bonusEnabled ? ` · Bonus: ${r.bonus}` : ""} · Finale: {r.finale}
          </div>
        </div>
        <div className="font-mono text-xl font-bold">{r.total}</div>
      </div>

      <details className="border-t border-border px-3.5 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Roster detail</summary>
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          {r.roster.length === 0 && r.formerRoster.length === 0 && (
            <div className="text-xs italic text-muted-foreground">No roster</div>
          )}
          {r.roster.map((c) => (
            <CastawayStatCard key={c.id} state={state} castaway={c} showOwner={false} showPoints={false} expanded />
          ))}
          {r.formerRoster.map((c) => (
            // The dim treatment here is "no longer on this roster" (they might not even be
            // eliminated -- a trade drop doesn't have to be); CastawayStatCard's own eliminated-based
            // dimming is a separate, narrower thing. The movement symbol next to their name (⇄/↓/↑,
            // see castaway-stat-card.tsx) already explains why they're not current, so no title here.
            <div key={c.id} className="opacity-60">
              <CastawayStatCard state={state} castaway={c} showOwner={false} showPoints={false} expanded />
            </div>
          ))}
        </div>
        {(r.formerRoster.length > 0 || r.roster.some((c) => c.acquiredVia && c.acquiredVia !== "draft")) && (
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground">⇄ traded away · ↓ eliminated, replenished away · ↑ added via Replenish/Swap</p>
        )}
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
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                    Ep {b.episode}
                    {b.postMerge ? " 🔀" : ""}
                  </span>
                  <span className="flex-1">
                    {b.label} — <span className="text-muted-foreground">&ldquo;{b.guess}&rdquo;</span>
                  </span>
                  {b.correct === true ? (
                    <span className="rounded bg-good/15 px-1.5 py-0.5 font-semibold text-good">Correct</span>
                  ) : b.correct === false ? (
                    <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-semibold text-destructive">Incorrect</span>
                  ) : (
                    <span className="rounded bg-secondary px-1.5 py-0.5">Unresolved</span>
                  )}
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
