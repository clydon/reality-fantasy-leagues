"use client";

import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { keepsLine } from "@/lib/game/classic-view";
import { finishedPlace, ordinal } from "@/components/scoreboard/scoreboard-tab";
import { useMyPlayerId } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { signed } from "@/lib/game/lineup-view";
import { useShowTerms } from "@/lib/use-show-terms";
import { EyeOff, Lock } from "lucide-react";
import { episodesLabel, useHiddenResults } from "@/components/results-in-banner";
import { DashAside, DashCard } from "./dash-card";
import { andList, isShared, periodFor, resultWhy, useCastNames, useWaiversBase } from "@/components/waivers/waivers-model";

// The latest episode with results (docs/PLAN-ux-declutter.md): "Episode N" with Recap on the heading
// line, then who left, each as an "Out" caption plate (the episode page's). Classic says where each
// finished and whose points stop there, since that's its whole score. Active Roster adds your own week
// as a second plate -- what you scored and what sat on your bench; every team's points are Standings'
// +N column and the Scoreboard. The episode is the latest that SCORED for Active Roster, not just the
// latest with an exit; state is already spoiler-trimmed, so it's only ever one this viewer has revealed.
// No episode yet renders nothing.
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
  if (!latestEp) return null;
  const out = latestEp.events
    .map((ev) => ({ ev, c: StateLogic.getCastaway(state, ev.castawayId) }))
    .filter((x): x is { ev: (typeof latestEp.events)[number]; c: NonNullable<typeof x.c> } => !!x.c);

  return (
    <DashCard title={`Episode ${latestEp.number}`} aside={<DashAside href={`/episodes/${latestEp.number}`}>Recap</DashAside>}>
      {latestEp.title && <p className="mb-2 text-sm font-semibold">{latestEp.title}</p>}
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
                classic ? [place && `Finished ${ordinal(place)}`, keepsLine(state, c, me)].filter(Boolean).join(" · ") : ev.method
              }
            />
          );
        })}
        {activeRoster && <YourWeekPlate state={state} ep={latestEp} />}
        <YourWaiversPlate state={state} n={latestEp.number} />
      </div>
    </DashCard>
  );
}

// Waivers (the canvas's board 11, "Overview, after"): once the week this episode opened has processed,
// what your claims came to, until the next episode takes the card. Only claims you made: a week you sat
// out says nothing here. Every outcome and why is on the week's results page.
function YourWaiversPlate({ state, n }: { state: LeagueState; n: number }) {
  const me = useMyPlayerId();
  const name = useCastNames(state);
  const base = useWaiversBase();
  const period = periodFor(state, n);
  if (!me || !period?.run) return null;
  const mine = period.run.results.filter((r) => r.playerId === me && (r.outcome === "got" || r.outcome === "missed"));
  if (!mine.length) return null;
  const href = `${base}/results/${n}`;
  const more = <span className="sr-only">See everyone&rsquo;s</span>;
  const got = mine.filter((r) => r.outcome === "got" && r.castawayId);
  if (!got.length) {
    return <CaptionPlate size="sm" tone="quiet" tag="Waivers" title="Your claim missed" subtitle={resultWhy(state, mine[0], me, name)} action={more} href={href} />;
  }
  const first = StateLogic.getCastaway(state, got[0].castawayId!);
  // Shared ownership: nothing could be lost to anyone, so which choice it was says nothing.
  const firsts = got.every((r) => (r.choice ?? 1) === 1);
  const choices = isShared(state)
    ? null
    : firsts
      ? got.length === 1
        ? "1st choice"
        : got.length === 2
          ? "Both 1st choices"
          : "All 1st choices"
      : got.map((r) => `${ordinal(r.choice ?? 1)} choice`).join(", ");
  return (
    <CaptionPlate
      size="sm"
      tone="good"
      tag="Waivers"
      image={(first && castawayPhotoSrc(first.photoUrl)) ?? undefined}
      title={`You got ${andList(got.map((r) => name(r.castawayId)))}`}
      subtitle={choices ? `${choices} · see everyone’s` : "See everyone’s"}
      action={more}
      href={href}
    />
  );
}

// Active Roster: "what did I score," the thing a fantasy-football dashboard always leads with. Only
// your own lineup's events count, the same rule the real score uses (a benched castaway's events never
// were yours); the bench line is the nudge for next time.
function YourWeekPlate({ state, ep }: { state: LeagueState; ep: Episode }) {
  const me = useMyPlayerId();
  const terms = useShowTerms();
  if (!me) return null;
  const lineup = new Set(StateLogic.activeRosterLineupFor(state, ep.id, me));
  const allEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  const myEvents = allEvents.filter((ev) => lineup.has(ev.castawayId));
  const pts = (evs: typeof allEvents) =>
    StateLogic.roundPoints(evs.reduce((sum, ev) => sum + StateLogic.ActiveRosterLogic.eventPoints(state, ev), 0));
  // Your bench that week: castaways you own who weren't in its lineup. Ownership is today's (a swap
  // since then can shift it), which is fine for a "you left this on the bench" nudge.
  const mine = new Set(state.castaways.filter((c) => (c.ownerIds || []).includes(me)).map((c) => c.id));
  const benchPts = pts(allEvents.filter((ev) => mine.has(ev.castawayId) && !lineup.has(ev.castawayId)));
  return (
    <CaptionPlate
      tag="You"
      tone="good"
      size="sm"
      title={`${signed(pts(myEvents))} last week`}
      subtitle={
        benchPts > 0
          ? `${benchPts} more ${benchPts === 1 ? "point" : "points"} sat on your bench`
          : myEvents.length === 0
            ? "Nothing from your lineup scored"
            : `From your ${terms.castaways} in the lineup`
      }
    />
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
