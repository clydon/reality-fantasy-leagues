"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { banksLine } from "@/lib/game/classic-view";
import { finishedPlace, ordinal } from "@/components/scoreboard/scoreboard-tab";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { TeamEpisodeBreakdown, fmt } from "@/components/scoreboard/team-episode-breakdown";
import { useTeamSummary } from "@/components/scoreboard/use-team-summary";
import { cn } from "cn";
import { EyeOff, Lock } from "lucide-react";
import { episodesLabel, useHiddenResults } from "@/components/results-in-banner";
import { DashCard, DashLink } from "./dash-card";

// The latest episode with results: who left, each as an "Out" caption plate (the episode page's), and
// a link to that episode's page for the rest. Classic says where each finished and who banked the
// points, since that's its whole score.
//
// Active Roster: the first thing anyone wants once results are revealed -- who left, what every team
// scored, and (a tap away) how. The episode is the latest that SCORED, not just the latest with an
// exit; state is already spoiler-trimmed, so it's only ever one this viewer has revealed.
export function LatestEpisodeCard({ state }: { state: LeagueState }) {
  const { hidden } = useHiddenResults();
  const me = useMyPlayerId();
  if (hidden.length > 0) return <HiddenEpisodeCard state={state} first={hidden[0].number} last={hidden[hidden.length - 1].number} />;
  const type = StateLogic.getLeagueType(state);
  const activeRoster = type.hasActiveRoster && !type.hasWeeklyPicks;
  const classic = type.hasRoster && !type.hasActiveRoster;
  const latestEp = activeRoster
    ? latestScoredEpisode(state)
    : [...state.episodes].filter((ep) => ep.events.length > 0).sort((a, b) => b.number - a.number)[0];
  const out = latestEp
    ? latestEp.events
        .map((ev) => ({ ev, c: StateLogic.getCastaway(state, ev.castawayId) }))
        .filter((x): x is { ev: (typeof latestEp.events)[number]; c: NonNullable<typeof x.c> } => !!x.c)
    : [];

  return (
    <DashCard title={latestEp ? `Episode ${latestEp.number}` : "Latest Episode"} wide={activeRoster}>
      {latestEp ? (
        <>
          {latestEp.title && <p className="mb-2 text-sm font-semibold">{latestEp.title}</p>}
          {out.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {out.map(({ ev, c }) => {
                const place = finishedPlace(state, c);
                return (
                  <CaptionPlate
                    key={c.id}
                    size="sm"
                    tone="live"
                    tag="Out"
                    image={castawayPhotoSrc(c.photoUrl) ?? undefined}
                    title={c.name}
                    subtitle={
                      classic
                        ? [place && `Finished ${ordinal(place)}`, banksLine(state, c, me)].filter(Boolean).join(" · ")
                        : ev.method
                    }
                  />
                );
              })}
            </div>
          )}
          {activeRoster ? (
            <LeagueWeek state={state} epId={latestEp.id} />
          ) : (
            <DashLink href={`/episodes/${latestEp.number}`}>Episode {latestEp.number} recap →</DashLink>
          )}
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
        <details key={p.id} className={cn("border-b border-border/60 last:border-b-0", p.id === myPlayerId && "bg-muted")}>
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

// The canvas's Spoiler-Gate: while results wait to be revealed, the latest episode is a locked card.
// The shapes behind the lock are placeholders, never the real photos or names blurred -- a blurred
// face is still a face.
function HiddenEpisodeCard({ state, first, last }: { state: LeagueState; first: number; last: number }) {
  const { reveal } = useHiddenResults();
  const asOf = StateLogic.SpoilerLogic.latestWithResults(state);
  return (
    <DashCard title={episodesLabel(first, last)}>
      <button
        type="button"
        onClick={() => reveal()}
        className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-[4px] bg-card px-4 py-3.5 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
      >
        <span className="flex items-center gap-2.5 opacity-50 blur-[6px]" aria-hidden>
          <span className="size-12 shrink-0 rounded-[2px] bg-muted-foreground/60" />
          <span className="size-12 shrink-0 rounded-[2px] bg-muted-foreground/40" />
          <span className="h-4 w-40 rounded-[2px] bg-muted-foreground/60" />
        </span>
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-bold">
          <Lock className="size-[18px]" strokeWidth={2.2} aria-hidden />
          Hidden until you reveal
        </span>
      </button>
      <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">
        {asOf > 0
          ? `Everything in this league stays at Episode ${asOf} for you until you reveal.`
          : `Everything in this league stays as it was before Episode ${first} for you until you reveal.`}
      </p>
    </DashCard>
  );
}

/** "As of Episode 2": standings from before the results waiting to be revealed. */
export function AsOfPill({ state }: { state: LeagueState }) {
  const asOf = StateLogic.SpoilerLogic.latestWithResults(state);
  return (
    <span className="mb-1 inline-flex min-h-7 items-center gap-1.5 self-start rounded-[3px] bg-card px-2.5 text-[13px] font-semibold text-foreground">
      <EyeOff className="size-3.5" strokeWidth={2.2} aria-hidden />
      {asOf > 0 ? `As of Episode ${asOf}` : "Before any results"}
    </span>
  );
}
