"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { TeamEpisodeBreakdown, fmt } from "@/components/scoreboard/team-episode-breakdown";
import { useTeamSummary } from "@/components/scoreboard/use-team-summary";
import { cn } from "cn";
import { DashCard, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Latest Episode" card (public/app.js). Same
// ensureUpcomingEpisode gotcha noted there: filter to episodes with events before taking the
// highest number, since there's always a trailing empty "upcoming" episode. Shows who left as their
// player cards rather than a list of names.
//
// Active Roster: the first thing anyone wants once results are revealed -- who left, what every team
// scored, and (a tap away) how. The episode is the latest that SCORED, not just the latest with an
// exit; state is already spoiler-trimmed, so it's only ever one this viewer has revealed.
export function LatestEpisodeCard({ state }: { state: LeagueState }) {
  const activeRoster = StateLogic.getLeagueType(state).hasActiveRoster && !StateLogic.getLeagueType(state).hasWeeklyPicks;
  const latestEp = activeRoster
    ? latestScoredEpisode(state)
    : [...state.episodes].filter((ep) => ep.events.length > 0).sort((a, b) => b.number - a.number)[0];
  const out = latestEp
    ? latestEp.events.map((ev) => StateLogic.getCastaway(state, ev.castawayId)).filter((c): c is NonNullable<typeof c> => !!c)
    : [];

  return (
    <DashCard title={latestEp ? `Latest Episode (Ep ${latestEp.number})` : "Latest Episode"} wide={activeRoster}>
      {latestEp ? (
        <>
          {latestEp.title && <p className="text-sm font-semibold">{latestEp.title}</p>}
          {out.length > 0 && (
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
              {out.map((c) => {
                const owners = c.ownerIds
                  .map((id) => StateLogic.getPlayer(state, id))
                  .filter((p): p is NonNullable<typeof p> => !!p);
                return <CastawayStatCard key={c.id} state={state} castaway={c} owners={owners} showPoints={false} expanded={false} />;
              })}
            </div>
          )}
          {activeRoster && <LeagueWeek state={state} epId={latestEp.id} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No episodes logged yet.</p>
      )}
    </DashCard>
  );
}

// Every team's points for the episode, highest first, each opening to how they earned them. The
// viewer's own team is marked; the commissioner's "why it mattered" lines show inside, when written.
function LeagueWeek({ state, epId }: { state: LeagueState; epId: string }) {
  const myPlayerId = useMyPlayerId();
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const { data } = useTeamSummary(leagueId, epId);
  const teams = state.players
    .filter((p) => p.active !== false)
    .map((p) => ({ p, total: teamEpisodeBreakdown(state, epId, p.id).total }))
    .sort((a, b) => b.total - a.total || a.p.name.localeCompare(b.p.name));

  return (
    <div className="mt-3">
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">League this week</div>
      {teams.map(({ p, total }) => (
        <details key={p.id} className={cn("border-b border-border/60 last:border-b-0", p.id === myPlayerId && "bg-primary/5")}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-1 py-1.5 [&::-webkit-details-marker]:hidden">
            {/* Rank by this episode's points, ties sharing a place. */}
            <span className="w-5 text-center font-mono text-xs font-bold text-muted-foreground">
              {teams.findIndex((t) => t.total === total) + 1}
            </span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {p.name}
              {p.id === myPlayerId && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
            </span>
            <span className={cn("font-mono text-sm font-bold", total < 0 && "text-destructive")}>{fmt(total)}</span>
            <span className="text-xs text-muted-foreground transition-transform [details[open]_&]:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="pb-2 pl-8 pr-1">
            <TeamEpisodeBreakdown state={state} epId={epId} playerId={p.id} note={data?.notes[p.id]} />
          </div>
        </details>
      ))}
      <DashLink href="/scoreboard">Every episode on the Scoreboard →</DashLink>
    </div>
  );
}
