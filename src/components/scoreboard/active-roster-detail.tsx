"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEarnedStats, castawaysEverOwned } from "@/lib/game/active-roster-rows";
import { cn } from "cn";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore } from "@/lib/store";
import { weekInRace } from "@/lib/game/episode-team-summary";
import { scoredEpisodes, teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { TeamEpisodeBreakdown, fmt } from "./team-episode-breakdown";
import { useTeamSummary } from "./use-team-summary";
import { isKnockedOut } from "@/lib/game/selectors";

// Active Roster's half of a player's Scoreboard page (player-score-page.tsx): how the latest episode
// moved them in the race, every scored episode opening to how the team earned it, and the Roster --
// each castaway and what they earned this player while fielded (benched points score nothing). The
// standings list itself is scoreboard-tab.tsx's per-episode table.
// Under the total, small and quiet: how the latest episode moved this team in the race for 1st --
// ▲ gained on the leader (or, for the leader, pulled away from 2nd), ▼ lost ground.
export function WeekTrend({ race, ep }: { race: ReturnType<typeof weekInRace>; ep: number }) {
  if (!race) return null;
  const { gained, leading, tookLead } = race;
  const n = Math.abs(gained);
  const title = tookLead
    ? `Ep ${ep}: took 1st, gaining ${n} on the old leader`
    : leading
      ? gained > 0 ? `Ep ${ep}: lead over 2nd grew by ${n}` : gained < 0 ? `Ep ${ep}: lead over 2nd shrank by ${n}` : `Ep ${ep}: lead over 2nd held`
      : gained > 0 ? `Ep ${ep}: closed ${n} on 1st` : gained < 0 ? `Ep ${ep}: fell ${n} further behind 1st` : `Ep ${ep}: kept pace with 1st`;
  return (
    <div className="flex items-baseline justify-end gap-1 text-[0.65rem] leading-tight" title={title}>
      {tookLead && <span className="text-muted-foreground">new 1st</span>}
      <span className={cn("font-mono opacity-80", gained > 0 ? "text-good" : gained < 0 ? "text-destructive" : "text-muted-foreground")}>
        {gained > 0 ? "▲" : gained < 0 ? "▼" : "–"}
        {n > 0 ? ` ${n}` : ""}
      </span>
    </div>
  );
}

// This team's points episode by episode, newest first, each opening to how the team earned them
// (TeamEpisodeBreakdown). The latest one also carries the "why it mattered" line the commissioner wrote
// for it, if any -- only that needs the server (written from the Scoreboard's ⋯, EpisodeLinesModal).
export function EpisodeRows({ state, playerId }: { state: LeagueState; playerId: string }) {
  const eps = scoredEpisodes(state);
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const { data } = useTeamSummary(leagueId, eps[0]?.id ?? null);
  if (eps.length === 0) return <p className="text-sm text-muted-foreground">No episodes scored yet.</p>;
  return (
    <div className="flex flex-col border-b border-border">
      {eps.map((ep, i) => (
        <EpisodeRow key={ep.id} state={state} ep={ep} playerId={playerId} note={i === 0 ? data?.notes[playerId] : undefined} />
      ))}
    </div>
  );
}

function EpisodeRow({ state, ep, playerId, note }: { state: LeagueState; ep: { id: string; number: number }; playerId: string; note?: string }) {
  const { total } = teamEpisodeBreakdown(state, ep.id, playerId);
  return (
    <details className="group border-t border-border">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" strokeWidth={2.4} aria-hidden />
        <span className="flex-1 text-base font-semibold">Episode {ep.number}</span>
        <span className="type-num text-[22px]">{fmt(total)}</span>
      </summary>
      <div className="pb-3 pl-6">
        <TeamEpisodeBreakdown state={state} epId={ep.id} playerId={playerId} note={note} />
      </div>
    </details>
  );
}

// One line per castaway this player has had, with what that castaway earned FOR THEM -- only
// episodes they were in the lineup, so the column adds up to the Events figure above (a benched
// castaway's points were never this player's). Replaces the old card grid, whose full stat cards
// didn't fit narrow columns and showed whole-season points that didn't reconcile with the total.
// Tap a line for the episode-by-episode events behind its number.
export function RosterBreakdown({ state, playerId }: { state: LeagueState; playerId: string }) {
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
        // What they scored that episode, started or not: the bar shows it either way (a benched week
        // is what starting them would have been worth); `points` only counts it when started.
        const evs = StateLogic.ActiveRosterLogic.episodeEvents(state, ep).filter((e) => e.castawayId === c.id);
        const scored = StateLogic.roundPoints(evs.reduce((t, e) => t + StateLogic.ActiveRosterLogic.pointsFor(state, e.type), 0));
        return {
          n: ep.number,
          fielded,
          out: exit !== undefined && ep.number > exit,
          scored,
          points: fielded ? scored : 0,
          // Each scoring event on its own, with what it was worth (only when started -- it's what counted).
          items: fielded
            ? evs.map((e) => ({
                id: e.id,
                label: defs.find((d) => d.id === e.type)?.label ?? e.type,
                points: StateLogic.ActiveRosterLogic.pointsFor(state, e.type),
              }))
            : [],
        };
      });
      return { c, current: c.ownerIds.includes(playerId), earned: castawayEarnedStats(state, playerId, c.id).total, perEpisode };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || b.earned - a.earned || a.c.name.localeCompare(b.c.name));

  if (lines.length === 0) return <div className="mt-2 text-xs italic text-muted-foreground">No roster</div>;
  // The strip's scale: this player's biggest single-episode swing, either way.
  const maxAbs = Math.max(1, ...lines.flatMap((l) => l.perEpisode.filter((e) => !e.out).map((e) => Math.abs(e.scored))));
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
                (!l.current || isKnockedOut(state, l.c)) && "opacity-60"
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
                {isKnockedOut(state, l.c) && (
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
                  <span className="ml-1 text-muted-foreground" title={l.c.acquiredVia === "trade" ? "Added via Swap" : "Picked up"}>
                    ↑
                  </span>
                )}
              </span>
              {/* Last 8 scored episodes as a tiny chart (EpisodeBar; legend: ScoreboardLegend). */}
              <span className="hidden h-6 shrink-0 gap-[2px] min-[380px]:flex" aria-hidden>
                {l.perEpisode.slice(-8).map((e) => (
                  <EpisodeBar key={e.n} e={e} maxAbs={maxAbs} />
                ))}
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-sm font-bold">{l.earned}</span>
            </button>
            {open === l.c.id && (
              <div className="mb-1.5 ml-10 mr-1 flex flex-col gap-0.5 text-xs">
                {fielded.length === 0 ? (
                  <span className="italic text-muted-foreground">Never in the lineup.</span>
                ) : (
                  // Per episode: a header with its total, then each scoring event on its own line.
                  fielded.map((e) => (
                    <div key={e.n} className="mb-1">
                      <div className="flex items-baseline justify-between gap-2 font-semibold">
                        <span className="font-mono text-[0.65rem] text-muted-foreground">Ep {e.n}</span>
                        <span className="font-mono">{fmt(e.points)}</span>
                      </div>
                      {e.items.length === 0 ? (
                        <div className="pl-3 text-muted-foreground">Started — nothing scored</div>
                      ) : (
                        e.items.map((it) => (
                          <div key={it.id} className="flex items-baseline justify-between gap-2 pl-3">
                            <span className="min-w-0 text-muted-foreground">{it.label}</span>
                            <span className={cn("shrink-0 font-mono", it.points < 0 && "text-destructive")}>{fmt(it.points)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// One episode in a castaway's strip, drawn around a centre line so it doesn't rest on colour alone:
// points gained rise above it (green), points lost hang below it (red), height = how many. Solid when
// started; an outline when benched (what starting them would have been worth). A plain tick on the
// line for a 0, a dot for an episode after they'd left.
function EpisodeBar({ e, maxAbs }: { e: { n: number; out: boolean; fielded: boolean; scored: number }; maxAbs: number }) {
  const title = `Ep ${e.n}: ${e.out ? "out" : `${e.fielded ? "" : "benched, would have scored "}${e.scored > 0 ? "+" : ""}${e.scored}`}`;
  if (e.out) {
    return (
      <span className="flex w-1.5 items-center justify-center" title={title}>
        <span className="h-1 w-1 rounded-full bg-border" />
      </span>
    );
  }
  const pct = `${Math.max(18, (Math.abs(e.scored) / maxAbs) * 100)}%`;
  const bar = (up: boolean) =>
    cn(
      "w-full",
      up ? "rounded-t-[2px]" : "rounded-b-[2px]",
      e.fielded ? (up ? "bg-good" : "bg-destructive") : cn("border", up ? "border-b-0 border-good" : "border-t-0 border-destructive")
    );
  return (
    <span className="flex w-1.5 flex-col" title={title}>
      <span className="flex h-1/2 items-end border-b border-border">{e.scored > 0 && <span className={bar(true)} style={{ height: pct }} />}</span>
      <span className="flex h-1/2 items-start">{e.scored < 0 && <span className={bar(false)} style={{ height: pct }} />}</span>
    </span>
  );
}

// Under the Roster on a player's page: how to read it.
export function ScoreboardLegend() {
  const terms = useShowTerms();
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">How to read the roster</summary>
      <p className="mt-2">
        Each number is what that {terms.castaway} earned <b className="text-foreground">that player</b> — points only count in
        episodes they started. Tap a {terms.castaway} for the episode-by-episode events.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1">
          <span className="flex h-6 gap-[2px]">
            <EpisodeBar e={{ n: 0, out: false, fielded: true, scored: 3 }} maxAbs={3} />
            <EpisodeBar e={{ n: 0, out: false, fielded: true, scored: -2 }} maxAbs={3} />
          </span>
          Started: up = points gained, down = points lost (taller = more)
        </span>
        <span className="flex items-center gap-1">
          <span className="flex h-6">
            <EpisodeBar e={{ n: 0, out: false, fielded: false, scored: 3 }} maxAbs={3} />
          </span>
          Outline: benched — what they would have scored
        </span>
        <span className="flex items-center gap-1">
          <span className="flex h-6">
            <EpisodeBar e={{ n: 0, out: true, fielded: false, scored: 0 }} maxAbs={3} />
          </span>
          Out of the game
        </span>
      </div>
      <p className="mt-1">Bars are the last 8 episodes, oldest first.</p>
      <p className="mt-1">
        Under the total: how the latest episode moved this team in the race for 1st —{" "}
        <span className="text-good">▲</span> points gained on the leader (for the leader: on 2nd),{" "}
        <span className="text-destructive">▼</span> points lost. &ldquo;new 1st&rdquo; marks a team that just took the lead.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <span>
          <span className="text-destructive">✕</span> Eliminated
        </span>
        <span>↑ Added by replenish or swap</span>
        <span>⇄ Swapped away</span>
        <span>Faded: out of the game, or no longer on the roster</span>
      </div>
    </details>
  );
}
