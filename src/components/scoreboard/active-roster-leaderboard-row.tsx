"use client";

import { useState } from "react";
import type { LeagueState, ScoreRow } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEarnedStats, castawaysEverOwned } from "@/lib/game/active-roster-rows";
import { playerBetRows } from "@/lib/game/bet-rows";
import { cn } from "cn";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";

// Active Roster's leaderboard row. Separate from LeaderboardRow because that one's breakdown is
// "Boot Order" plus a roster list with elimination placements -- which is exactly what this league
// type does NOT score on. Here the breakdown is one compact list: each castaway and what they earned
// this player while fielded (benched points score nothing), then predictions.
export function ActiveRosterLeaderboardRow({ r, rank, state }: { r: ScoreRow; rank: number; state: LeagueState }) {
  const bonusEnabled = state.settings.bonusEnabled;
  const bets = bonusEnabled ? playerBetRows(state, r.playerId) : [];

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <div className={cn("flex items-center gap-3 p-3.5", rank === 1 && "bg-primary/5")}>
        <div className="w-6 text-center font-mono text-lg font-bold text-muted-foreground">{rank}</div>
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            Events: {r.locked}
            {bonusEnabled ? ` · Predictions: ${r.bonus}` : ""} · Finale: {r.finale}
          </div>
        </div>
        <div className="font-mono text-xl font-bold">{r.total}</div>
      </div>

      <details className="border-t border-border px-3.5 py-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Breakdown</summary>
        <RosterBreakdown state={state} playerId={r.playerId} />
        {bets.length > 0 && (
          <div className="mt-2.5 border-t border-border pt-2">
            <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Predictions</div>
            {bets.map((b, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">Ep {b.episode}</span>
                <span className="min-w-0 flex-1 truncate">
                  {b.label} — <span className="text-muted-foreground">&ldquo;{b.guess}&rdquo;</span>
                </span>
                <span className="shrink-0 font-mono font-bold">+{b.points}</span>
              </div>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

// One line per castaway this player has had, with what that castaway earned FOR THEM -- only
// episodes they were in the lineup, so the column adds up to the Events figure above (a benched
// castaway's points were never this player's). Replaces the old card grid, whose full stat cards
// didn't fit narrow columns and showed whole-season points that didn't reconcile with the total.
// Tap a line for the episode-by-episode events behind its number.
function RosterBreakdown({ state, playerId }: { state: LeagueState; playerId: string }) {
  const terms = useShowTerms();
  const [open, setOpen] = useState<string | null>(null);
  const defs = StateLogic.formatOf(state).events;
  // Episodes that have scored for this league, oldest first -- the strip's columns.
  const aired = [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0)
    .sort((a, b) => a.number - b.number);
  const lines = castawaysEverOwned(state, playerId)
    .map((c) => {
      const exit = c.exitEpisodeId ? state.episodes.find((e) => e.id === c.exitEpisodeId)?.number : undefined;
      const perEpisode = aired.map((ep) => {
        const fielded = StateLogic.activeRosterLineupFor(state, ep.id, playerId).includes(c.id);
        const evs = fielded ? StateLogic.ActiveRosterLogic.episodeEvents(state, ep).filter((e) => e.castawayId === c.id) : [];
        return {
          n: ep.number,
          fielded,
          out: exit !== undefined && ep.number > exit,
          points: StateLogic.roundPoints(evs.reduce((t, e) => t + StateLogic.ActiveRosterLogic.pointsFor(state, e.type), 0)),
          labels: evs.map((e) => defs.find((d) => d.id === e.type)?.label ?? e.type),
        };
      });
      return { c, current: c.ownerIds.includes(playerId), earned: castawayEarnedStats(state, playerId, c.id).total, perEpisode };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || b.earned - a.earned || a.c.name.localeCompare(b.c.name));

  if (lines.length === 0) return <div className="mt-2 text-xs italic text-muted-foreground">No roster</div>;
  const firstFormer = lines.findIndex((l) => !l.current);

  return (
    <div className="mt-2">
      {lines.map((l, i) => {
        const fielded = l.perEpisode.filter((e) => e.fielded).reverse();
        return (
          <div key={l.c.id}>
            {i === firstFormer && (
              <div className="mb-0.5 mt-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                No longer on roster
              </div>
            )}
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-secondary",
                (!l.current || l.c.status === "eliminated") && "opacity-60"
              )}
              aria-expanded={open === l.c.id}
              onClick={() => setOpen(open === l.c.id ? null : l.c.id)}
            >
              <CastawayAvatar
                castaway={l.c}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[0.6rem] font-bold"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {l.c.name}
                {l.c.status === "eliminated" && (
                  <span className="ml-1 text-destructive" title="Eliminated">
                    ✕
                  </span>
                )}
                {!l.current && l.c.departedVia === "trade" && (
                  <span className="ml-1 text-muted-foreground" title="Swapped away">
                    ⇄
                  </span>
                )}
                {l.current && (l.c.acquiredVia === "trade" || l.c.acquiredVia === "replenish") && (
                  <span className="ml-1 text-muted-foreground" title={l.c.acquiredVia === "trade" ? "Added via Swap" : "Added via Replenish"}>
                    ↑
                  </span>
                )}
              </span>
              {/* Last 8 scored episodes: filled = in the lineup, hollow = benched, blank = out of the game. */}
              <span className="hidden shrink-0 items-end gap-[2px] min-[380px]:flex" aria-hidden>
                {l.perEpisode.slice(-8).map((e) => (
                  <span
                    key={e.n}
                    className={cn("h-3 w-1.5 rounded-[2px]", e.out ? "" : e.fielded ? "bg-primary" : "border border-border")}
                  />
                ))}
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-sm font-bold">{l.earned}</span>
            </button>
            {open === l.c.id && (
              <div className="mb-1.5 ml-10 mr-1 flex flex-col gap-0.5 text-xs">
                {fielded.length === 0 ? (
                  <span className="italic text-muted-foreground">Never in the lineup.</span>
                ) : (
                  fielded.map((e) => (
                    <div key={e.n} className="flex items-baseline gap-2">
                      <span className="w-9 shrink-0 font-mono text-[0.65rem] font-semibold text-muted-foreground">Ep {e.n}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">{e.labels.length ? e.labels.join(", ") : "—"}</span>
                      <span className="shrink-0 font-mono">{e.points > 0 ? `+${e.points}` : e.points}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
      {/* Legend: the number, the episode strip and the marks, so the list reads on its own. */}
      <div className="mt-2 border-t border-border pt-2 text-[0.7rem] text-muted-foreground">
        <p className="mb-1.5">
          The number is what each {terms.castaway} earned <b>this player</b> — points only count in episodes they started.
          Tap one for the episode-by-episode events.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="h-3 w-1.5 rounded-[2px] bg-primary" /> Started
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-1.5 rounded-[2px] border border-border" /> Benched
          </span>
          <span>Blank: out of the game</span>
          <span>(last 8 episodes, oldest first)</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className="text-destructive">✕</span> Eliminated
          </span>
          <span>↑ Added by replenish or swap</span>
          <span>⇄ Swapped away</span>
          <span>Faded: out of the game or no longer on the roster</span>
        </div>
      </div>
    </div>
  );
}
