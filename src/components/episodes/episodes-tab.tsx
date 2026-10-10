"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { episodePlayerPoints } from "@/lib/game/active-roster-rows";
import { cn } from "cn";
import { useHiddenResults } from "@/components/results-in-banner";
import { useShowTerms } from "@/lib/use-show-terms";
import { banksLine, predictionsRight } from "@/lib/game/classic-view";
import { CatchUpPanel } from "./catch-up-panel";
import { airsInLabel, episodeDate, episodeExits, episodeStatus, hiddenBefore, useNowMinute } from "./episode-status";

// The Episodes list (docs/PLAN-ux-redesign.md, 2e; the canvas's "Classic · Episodes"): one row per
// episode, newest first, each saying when it aired and one thing about where it stands -- results to
// reveal, who went home and what it meant for you, or when it airs. Tapping a row opens that
// episode's own page (/episodes/N), where the detail and the commissioner's editing live.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);
  const terms = useShowTerms();
  // In a catch-up league the next episode is the catch-up panel's plate, not a row of its own.
  const R = StateLogic.RevealLogic;
  const nextUp = R.isCatchingUp(state) && !R.isComplete(state) ? R.nextEpisode(state) : null;
  const sorted = [...state.episodes].filter((ep) => ep.number !== nextUp).sort((a, b) => b.number - a.number);
  // From the viewer's trimmed state, so it never counts an exit they haven't revealed.
  const stillIn = state.castaways.filter((c) => c.status !== "eliminated").length;

  return (
    <>
      <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Episodes</h2>
      {/* In a catch-up league this is where the next episode gets revealed. Renders nothing for a
          league that isn't catching up. */}
      <CatchUpPanel state={state} />
      {sorted.length === 0 ? (
        <p className="text-base text-muted-foreground">No episodes yet. They appear here as the season airs.</p>
      ) : (
        <ol className="border-b border-border">
          {sorted.map((ep) => (
            <EpisodeRow key={ep.id} ep={ep} state={state} />
          ))}
        </ol>
      )}
      {/* How many are left, and the way to the Cast page (the board that left Overview). */}
      {state.castaways.length > 0 && (
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

  let headline: React.ReactNode;
  let detail: React.ReactNode = null;
  if (status.kind === "hidden") {
    headline = blockedBy !== null ? (
      "Results ready"
    ) : (
      <>
        <span className="rounded-[2px] bg-chyron px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-chyron-foreground">New</span>
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
  } else {
    headline = canManage && !ep.airsAt ? "Needs results" : "Waiting for results";
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
          className="min-h-11 shrink-0 rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
          onClick={() => reveal(ep.number)}
          data-tour="episode-reveal"
        >
          Reveal
        </button>
      )}
    </li>
  );
}

// Who went home: names for one or two, a count beyond that.
function ScoredHeadline({ ep, state }: { ep: Episode; state: LeagueState }) {
  const exits = episodeExits(state, ep);
  if (exits.length === 0) return <>No one left</>;
  if (exits.length > 2) return <>{exits.length} left the game</>;
  return <>{exits.map((x) => x.c.name).join(" and ")} out</>;
}

// What it meant for you: your starters' points (Active Roster), whether your pick survived
// (Eliminator Pool), or who banked points for whoever went and whether your prediction paid (Classic).
function ScoredDetail({ ep, state }: { ep: Episode; state: LeagueState }) {
  const me = useMyPlayerId();
  const type = StateLogic.getLeagueType(state);
  if (type.hasActiveRoster) {
    const rows = episodePlayerPoints(state, ep.id);
    const mine = rows.find((r) => r.player.id === me);
    const top = rows[0];
    const parts = [
      mine && (mine.points === 0 ? "Your starters scored 0" : `You ${fmtPoints(mine.points)}`),
      top && top.player.id !== me && top.points > 0 && `${top.player.name} ${fmtPoints(top.points)}`,
    ].filter(Boolean);
    return parts.length ? <>{parts.join(" · ")}</> : null;
  }
  if (type.hasWeeklyPicks) {
    const pick = (ep.picks || []).find((p) => p.playerId === me);
    if (!pick) return me ? <>You didn&rsquo;t pick</> : null;
    const name = StateLogic.getCastaway(state, pick.castawayId)?.name ?? "Your pick";
    const out = ep.events.some((e) => e.castawayId === pick.castawayId);
    const streak = me ? StateLogic.pickEmHistory(state, me).rows.find((r) => r.episode === ep.number)?.streak : undefined;
    return <>{out ? `Your pick, ${name}, went home` : `Your pick, ${name}, survived${streak ? ` · streak ${streak}` : ""}`}</>;
  }
  const exits = episodeExits(state, ep);
  const banks = exits.map((x) => banksLine(state, x.c, me));
  const { right, points } = predictionsRight(state, ep, me);
  const parts = [
    ...banks.filter(Boolean),
    right.length > 0 && `${right.length === 1 ? "your prediction was" : `${right.length} predictions`} right, +${points}`,
  ].filter(Boolean);
  if (parts.length === 0) return exits.length === 1 ? <>{`Nobody had ${exits[0].c.name.split(" ")[0]}`}</> : null;
  return <>{parts.join(" · ").replace(/^./, (ch) => ch.toUpperCase())}</>;
}

function fmtPoints(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
