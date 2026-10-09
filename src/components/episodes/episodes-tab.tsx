"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { episodePlayerPoints } from "@/lib/game/active-roster-rows";
import { cn } from "cn";
import { CatchUpPanel } from "./catch-up-panel";
import { airsInLabel, episodeDate, episodeExits, episodeStatus, hiddenBefore, ownersLine, useNowMinute } from "./episode-status";

// The Episodes list (docs/PLAN-ux-redesign.md, 2e; the canvas's "Classic · Episodes"): one row per
// episode, newest first, each saying when it aired and one thing about where it stands -- results to
// reveal, who went home and what it meant for you, or when it airs. Tapping a row opens that
// episode's own page (/episodes/N), where the detail and the commissioner's editing live.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);
  const sorted = [...state.episodes].sort((a, b) => b.number - a.number);

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
    </>
  );
}

function EpisodeRow({ ep, state }: { ep: Episode; state: LeagueState }) {
  const now = useNowMinute();
  const canManage = useCanManage();
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
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
          className="min-h-11 shrink-0 rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron"
          onClick={() => markResultsSeen(ep.number)}
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
// (Eliminator Pool), or whose team lost someone (Classic).
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
    return <>{out ? `Your pick, ${name}, went home` : `Your pick, ${name}, survived`}</>;
  }
  const first = episodeExits(state, ep)[0];
  const owners = first ? ownersLine(state, first.c) : null;
  return owners ? <>{`${first.c.name.split(" ")[0]} was ${owners}`}</> : null;
}

function fmtPoints(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
