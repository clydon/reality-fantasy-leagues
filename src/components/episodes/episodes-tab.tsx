"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { cn } from "cn";
import { useHiddenResults } from "@/components/results-in-banner";
import { useShowTerms } from "@/lib/use-show-terms";
import { SectionHead } from "@/components/draft/draft-ui";
import { DashAside } from "@/components/overview/dash-card";
import { CatchUpPanel } from "./catch-up-panel";
import { EpisodesWeek, lastEpisode, weekEpisode } from "./week";
import { ScoredDetail, ScoredHeadline } from "./episode-lines";
import { airsInLabel, episodeDate, episodeStatus, hiddenBefore, useNowMinute } from "./episode-status";

// Episodes (docs/PLAN-ux-redesign.md, 2e; the canvas's "Classic · Episodes"), as a broadcast rundown:
// first the week (week.tsx) -- the episode in play with your choices for it, and the commissioner's
// job once it's aired with nothing recorded; the latest results, to reveal or recap -- then every
// episode, newest first, one row each saying when it aired and one thing about where it stands.
// Episodes still to air after this week's fold into one row. A row opens that episode's own page
// (/episodes/N), where the detail and the commissioner's editing live.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);
  const terms = useShowTerms();
  const now = useNowMinute();
  // In a catch-up league the next episode is the catch-up panel's plate, not a row of its own, and
  // the week is the panel's to tell.
  const R = StateLogic.RevealLogic;
  const catchingUp = R.isCatchingUp(state) && !R.isComplete(state);
  const nextUp = catchingUp ? R.nextEpisode(state) : null;
  const week = catchingUp ? null : weekEpisode(state, now);
  const sorted = [...state.episodes].filter((ep) => ep.number !== nextUp).sort((a, b) => b.number - a.number);
  // Episodes after this week's that haven't aired: one folded row, not a column of "Airs in N days".
  const later = sorted.filter((ep) => week && ep.number > week.number && episodeStatus(ep, now).kind === "upcoming");
  const rows = sorted.filter((ep) => !later.includes(ep));
  // From the viewer's trimmed state, so it never counts an exit they haven't revealed.
  const stillIn = state.castaways.filter((c) => c.status !== "eliminated").length;
  const featured = !catchingUp && (week || lastEpisode(state, now));

  return (
    <>
      <h2 className="type-caption mb-8 text-[28px] max-nav:hidden">Episodes</h2>
      {/* In a catch-up league this is where the next episode gets revealed. Renders nothing for a
          league that isn't catching up. */}
      <CatchUpPanel state={state} />
      {!catchingUp && <EpisodesWeek state={state} />}
      {sorted.length === 0 ? (
        <p className="text-base text-muted-foreground">No episodes yet. They appear here as the season airs.</p>
      ) : (
        <section className="flex flex-col">
          {featured && (
            <SectionHead
              aside={
                state.castaways.length > 0 && (
                  <span className="flex items-baseline gap-3 pb-1.5">
                    <span className="text-[13px] text-muted-foreground">
                      <b className="type-num mr-1 text-[19px] text-foreground">{stillIn}</b>
                      of {state.castaways.length} still in
                    </span>
                    <DashAside href="/cast">The cast</DashAside>
                  </span>
                )
              }
            >
              All episodes
            </SectionHead>
          )}
          <ol className="border-b border-border">
            {later.length > 0 && <LaterRow eps={later} />}
            {rows.map((ep) => (
              <EpisodeRow key={ep.id} ep={ep} state={state} />
            ))}
          </ol>
          {/* Without the week above (a catch-up league), the count and the Cast link sit under the list. */}
          {!featured && state.castaways.length > 0 && (
            <Link href="/cast" className="mt-2 flex min-h-12 items-center justify-between gap-3 text-sm outline-none focus-visible:bg-accent">
              <span className="text-muted-foreground">
                <b className="type-num mr-1 text-[22px] text-foreground">{stillIn}</b>
                {stillIn === state.castaways.length
                  ? `${terms.castaways}, all still in the game`
                  : `of ${state.castaways.length} still in the game`}
              </span>
              <span className="shrink-0 font-semibold text-chyron-line">The cast</span>
            </Link>
          )}
        </section>
      )}
    </>
  );
}

// "Episodes 6–12 · still to air", opening to their rows (a commissioner may still need one).
function LaterRow({ eps }: { eps: Episode[] }) {
  const state = useLeagueStore((s) => s.state);
  const [open, setOpen] = useState(false);
  const first = eps[eps.length - 1];
  const last = eps[0];
  const lastDate = episodeDate(last);
  return (
    <>
      <li className="border-t border-border">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-14 w-full items-center gap-3 text-left outline-none focus-visible:bg-accent"
        >
          <span className="type-num w-11 shrink-0 text-center text-[19px] text-muted-foreground">+{eps.length}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
            <span className="text-[15px] font-semibold">
              {eps.length === 1 ? `Episode ${first.number}` : `Episodes ${first.number}–${last.number}`} still to air
            </span>
            {lastDate && <span className="truncate text-[13px] text-muted-foreground">Last one {lastDate}</span>}
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.2} aria-hidden />
        </button>
      </li>
      {open && eps.map((ep) => <EpisodeRow key={ep.id} ep={ep} state={state} />)}
    </>
  );
}

function EpisodeRow({ ep, state }: { ep: Episode; state: LeagueState }) {
  const now = useNowMinute();
  const canManage = useCanManage();
  const { reveal } = useHiddenResults();
  const status = episodeStatus(ep, now);
  const blockedBy = hiddenBefore(state, ep);
  const date = episodeDate(ep, status.kind === "upcoming");
  const inPlay = StateLogic.inPlay(state, ep.number);

  // Only the earliest hidden episode offers Reveal: revealing one reveals everything before it too,
  // so a Reveal on a later row would skip past an episode the viewer hasn't seen.
  const canReveal = status.kind === "hidden" && blockedBy === null;
  // Nothing to open on an episode that hasn't aired -- except for a commissioner, who may need to
  // enter results by hand.
  const opens = status.kind !== "upcoming" || canManage;
  // A commissioner's aired episode with nothing recorded: theirs to fill in (the week's plate leads
  // with the first; this marks any other).
  const needsYou = canManage && inPlay && status.kind === "waiting" && StateLogic.RevealLogic.nextEpisode(state) !== ep.number;

  let headline: React.ReactNode;
  let detail: React.ReactNode = null;
  if (status.kind === "hidden") {
    headline = blockedBy !== null ? (
      "Results ready"
    ) : (
      <>
        <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">New</span>
        Results ready
      </>
    );
    if (blockedBy !== null) detail = `Reveal episode ${blockedBy} first`;
  } else if (status.kind === "scored") {
    headline = blockedBy !== null ? "Results in" : <ScoredHeadline ep={ep} state={state} />;
    detail = blockedBy !== null ? `Reveal episode ${blockedBy} first` : <ScoredDetail ep={ep} state={state} />;
  } else if (status.kind === "upcoming") {
    headline = now !== null ? airsInLabel(status.airsAt, now) : "Not aired yet";
  } else if (StateLogic.RevealLogic.nextEpisode(state) === ep.number) {
    // Catch-up: its results come with the commissioner's reveal (the panel above), not by hand.
    headline = "Up next";
  } else if (needsYou) {
    headline = (
      <>
        Needs results
        <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-hidden />
      </>
    );
    detail = "Yours to fill in";
  } else {
    headline = "Waiting for results";
  }
  if (!inPlay) detail = "Before this league started · not scored";

  const body = (
    <>
      <span className="type-num w-11 shrink-0 text-center text-[34px]">{ep.number}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-3">
        {(date || ep.title) && (
          <span className="truncate text-[13px] text-muted-foreground">{[date, ep.title].filter(Boolean).join(" · ")}</span>
        )}
        <span className="flex items-center gap-2 text-base font-semibold">{headline}</span>
        {detail && <span className="truncate text-[13px] text-muted-foreground">{detail}</span>}
      </span>
    </>
  );

  return (
    <li className={cn("flex min-h-[72px] items-center gap-3 border-t border-border", status.kind === "upcoming" && "opacity-60")}>
      {opens ? (
        <Link
          href={`/episodes/${ep.number}`}
          className="-my-px flex min-w-0 flex-1 items-center gap-3 self-stretch outline-none focus-visible:bg-accent"
        >
          {body}
          {!canReveal && <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {canReveal && (
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-[3px] border border-input bg-card px-4 text-[15px] font-bold text-foreground transition-[filter] hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
          onClick={() => reveal(ep.number)}
          data-tour="episode-reveal"
        >
          Reveal
        </button>
      )}
    </li>
  );
}
