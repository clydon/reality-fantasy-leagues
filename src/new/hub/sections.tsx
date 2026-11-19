"use client";

import { draftRoomPage, draftSoonWords, draftWhen } from "../show/draft-words";
import { useState } from "react";
import { ChartColumn, Check, ChevronDown, ChevronRight, Crown, Gamepad2, Hourglass, Link2, Plus, RotateCcw, Tv, Trophy } from "lucide-react";
import { airTime, calmWhen, ticks } from "../clock";
import { START_EARLY_MS } from "@/lib/game/watch-along";
import { UNFRAMED } from "@/lib/art-frame";
import { ownPace } from "@/lib/game/streaming";
import { whereWords } from "@/lib/sharing";
import {
  plansApi,
  useAfterWatching,
  useInviteCode,
  useOnNow,
  useSetPlans,
  watching,
  type Couch,
  type CouchHub,
  type CouchShow,
  type FeedItem,
  type Home,
  type HomeShow,
  type Move,
  type PlayingGame,
  type WatchPlan,
} from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { plainName } from "../couch/where";
import { openStartGame } from "../couch/start-game";
import { midLine, useFinalLine } from "../final-words";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar, useNow } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Btn, SectionHead } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { NoSignal } from "../show/getting-ready";
import { openWatching } from "../watching/sheets";
import { useOpenTogether } from "../show/watch-along";
import { usePracticeShows } from "../tour/practice-shows";
import { showWords } from "@/lib/game/show-words";
import { moveCard } from "../show/moves";
import { TeamMark } from "../sports/parts";
import { useSportsDay } from "./sports-day";

// The hub's sections (the mock's index.html hub, refine.js wireHub, hubplus.js, watching.js, fresh.js), in the order
// screens/home.tsx lays them out. Real (step 8): the status line and Up next (results to reveal first, then what's due,
// then the soonest airing), your shows (each poster's best place, flipping to your games), On the couch (the feed) and
// what the grows-with-you hub promises; who's on now since step 13 part 2, Up next's planned night since part 3.

const showName = (s: HomeShow) => s.show.name.replace(/^The /, "");

// ---------- your moves, in words ----------

const MOVE_TAG: Record<string, string> = {
  lineup: "Lineup",
  pick: "Pick",
  prediction: "Predict",
  calls: "Call it",
  questions: "Sheet",
  pickup: "Waivers",
  draftTurn: "Draft",
  blindDraft: "Draft",
  lateJoin: "Start",
  results: "Results",
  invite: "Invite",
};

/** The show a move is for (a league on one of your shows), if any. */
export function showOfMove(home: Home, m: Move): HomeShow | undefined {
  return home.shows.find((s) => s.games.some((g) => g.leagueId === m.leagueId));
}

/** "your Survivor lineup locks Wed 8:05 PM", from the move and its show. */
export function moveLine(m: Move, show?: HomeShow) {
  const name = show ? showName(show) : m.leagueName;
  const when = m.deadline ? airTime(Date.parse(m.deadline)) : null;
  if (m.kind === "lineup") return `your ${name} lineup ${when ? `locks ${when}` : "is due"}`;
  if (m.kind === "pick") return `your ${name} pick ${when ? `locks ${when}` : "is due"}`;
  if (m.kind === "prediction") return `your ${name} prediction ${when ? `closes ${when}` : "is due"}`;
  if (m.kind === "calls") return `your ${name} calls ${when ? `close ${when}` : "are due"}`;
  if (m.kind === "questions") return `your ${name} sheet ${when ? `locks ${when}` : "is due"}`;
  if (m.kind === "pickup") return `${name} waivers ${when ? `close ${when}` : "are open"}`;
  return m.text.charAt(0).toLowerCase() + m.text.slice(1);
}

/** Moves in the order they're due: soonest deadline first, the ones without one after. */
/** Someone's waiting on these now (a draft to start, a draft turn), so they come before any deadline (action-items.js NOW_KINDS). */
const NOW = new Set(["draftStart", "draftTurn", "blindDraft"]);
export function movesByDue(moves: Move[]) {
  const at = (m: Move) => (NOW.has(m.kind) ? -Infinity : m.deadline ? Date.parse(m.deadline) : Infinity);
  return [...moves].sort((a, b) => (at(a) === at(b) ? 0 : at(a) < at(b) ? -1 : 1));
}

/** The shows whose results are in past where you are, the newest episode first. */
const revealing = (home: Home) => home.shows.filter((s) => s.results?.reveal).sort((a, b) => b.results.reveal!.episode - a.results.reveal!.episode);

/**
 * One line, what needs you first: results in to reveal (a show's, and how many moves are due besides), else the moves
 * due and the first, else the morning update's final scores (good news, teal), else that you're all set. Taps through
 * to that show.
 */
export function StatusLine({ home }: { home: Home }) {
  const moves = movesByDue(home.moves);
  const reveal = revealing(home)[0];
  // When the early results' episode has its final ones (final-words.ts).
  const finalWords = useFinalLine(reveal?.results.reveal?.stage, reveal?.results.reveal?.finalAt);
  const first = moves[0];
  const morning = home.shows.find((s) => s.results?.final);
  const show = reveal ?? (first && showOfMove(home, first)) ?? morning;
  const kind = reveal ? "reveal" : first ? "moves" : morning ? "final" : "set";
  const due = `${moves.length} ${moves.length === 1 ? "move" : "moves"} due`;
  const body = (
    <>
      <i className={`size-2 flex-none rounded-full ${kind === "reveal" || kind === "moves" ? "bg-chyron-line" : "bg-good"}`} aria-hidden />
      <span className="flex-1">
        {kind === "reveal" ? (
          <>
            <b className="text-foreground">{reveal.results.reveal!.stage === "early" ? "Early results are in" : "Final results are in"}</b> · {showName(reveal)} Episode {reveal.results.reveal!.episode}
            {reveal.results.reveal!.stage === "early" && finalWords ? ` · ${midLine(finalWords)}` : ""}
            {moves.length ? ` · ${due}` : ""}
          </>
        ) : kind === "moves" ? (
          <>
            <b className="text-foreground">{due}</b> · {moveLine(first, show)}
          </>
        ) : kind === "final" ? (
          <>
            <b className="text-foreground">Final results are in</b> · {showName(morning!)} Episode {morning!.results.final!.episode}
          </>
        ) : (
          <>
            <b className="text-foreground">You&rsquo;re all set</b> · nothing due this week
          </>
        )}
      </span>
      <ChevronRight className="size-5 flex-none" aria-hidden />
    </>
  );
  const cls = "nd-press mx-4 mb-3 mt-1 flex items-center gap-2.5 rounded-[3px] bg-card px-3 py-2.5 text-left text-sm text-muted-foreground";
  return show ? (
    <NavLink href={paths.show(show.seasonId)} data-status={kind} className={cls}>
      {body}
    </NavLink>
  ) : (
    <div data-status={kind} className={cls}>
      {body}
    </div>
  );
}

// ---------- Up next ----------

/**
 * The show to put up next, needs-you first: results in to reveal, then the show your soonest move is for, then the one
 * on now, then the soonest to air. A streaming drop never takes its countdown (step 14, the mock's heroPick): its home is the
 * rail; only something it needs of you puts it here.
 */
export function nextShow(home: Home): HomeShow | null {
  const reveal = revealing(home)[0];
  if (reveal) return reveal;
  for (const m of movesByDue(home.moves)) {
    const s = showOfMove(home, m);
    if (s) return s;
  }
  const on = home.shows.filter((s) => s.upNext?.airAt && s.release !== "binge");
  on.sort((a, b) => Number(b.upNext!.live) - Number(a.upNext!.live) || Date.parse(a.upNext!.airAt!) - Date.parse(b.upNext!.airAt!));
  return on[0] ?? null;
}

/** Where the plate's move goes in one tap (the design round's step 7): its own page (the draft room, waivers, the blind draft), else
 *  the show with that move's sheet open (show/dock.tsx reads `?moves=`), else the show (its strip). */
export function moveHref(m: Move, seasonId: string): string {
  const card = moveCard(m, seasonId, false);
  if (card.href) return card.href;
  if (card.tab) return `${paths.show(seasonId, "tonight")}?moves=${card.tab}&game=${m.leagueId}`;
  return paths.show(seasonId, "tonight");
}

/**
 * The next thing (the design round's step 7, docs/design-round/step7-hub-spec.md): the show on next on its art, its episode and
 * when said once, and on a caption plate the one thing it needs from you, needs-you first: results to reveal, else your due move
 * (opening its editor in one tap), else the morning update's final scores (teal), else all set (quiet, no yellow). The plate is
 * the strip's object (step 3): its tag the episode, its title the move, its line who's in and a lock only when it isn't the
 * airtime. Moves due on other shows are one line under it. Who's set is a count (the faces are Your people's, under On TV).
 * Watch along only when there's something out to watch. The whole card opens the show (the user, 2026-10-30): the name's link
 * stretches over it, and the plate, a planned night and Watch along sit above it with their own taps.
 */
export function UpNext({ home, show, couch }: { home: Home; show: HomeShow; couch: Couch | null }) {
  const up = show.upNext;
  const reveal = show.results?.reveal ?? null;
  const final = !reveal ? (show.results?.final ?? null) : null;
  const due = movesByDue(home.moves);
  const here = (m: Move) => show.games.some((g) => g.leagueId === m.leagueId);
  const move = due.find(here);
  const moreHere = due.filter((m) => here(m) && m !== move).length;
  const elsewhere = due.filter((m) => !here(m));
  const otherShow = elsewhere.length ? showOfMove(home, elsewhere[0]) : undefined;
  // Who's in: in the game of the move on the plate ("0 of 4 picked"), else in this couch's game here (a lineup's before a pick's).
  const couchHere = show.progress.filter((p) => !couch || couch.games.some((g) => g.leagueId === p.leagueId));
  const pool = couchHere.length ? couchHere : show.progress;
  const progress =
    (move && pool.find((p) => p.leagueId === move.leagueId)) ?? [...pool].sort((a, b) => Number(a.label !== "lineups set") - Number(b.label !== "lineups set"))[0];
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  const finalWords = useFinalLine(reveal?.stage, reveal?.finalAt);
  const name = showName(show);
  const href = paths.show(show.seasonId);
  // A sports game (the user, 2026-11-15: three lines for "Cowboys at Eagles, Nov 17 · Tue 10:07 PM · in 2 days"): the matchup with
  // its two marks on one line, the teams' colours behind it when there's no art, no repeated date or "Game 1".
  const game = useSportsDay(couch?.id ?? null).gameOf(show);
  const words = showWords(show.show.terms);
  // A one-letter short form (a sport's "G") reads as the word in full here.
  const ep = words.ep.length > 1 ? words.ep : words.episode;
  const live = !reveal && !!up?.live;
  const playing = show.games.length > 0;
  // A game here whose draft hasn't started (the home's draft-soon.ts read), for the plate when nothing of yours is due.
  const soonGame = show.games.find((g) => g.draftSoon && !g.draftSoon.waits && g.yourRole) ?? null;
  const kind = reveal ? "reveal" : move ? "move" : final ? "final" : live ? "live" : playing && up ? "set" : "none";
  // A night the couch planned on this show (the soonest you can watch: never past your next episode) takes Watch along's place.
  const next = show.seenThrough == null ? Number.POSITIVE_INFINITY : show.seenThrough + 1;
  const night = couch ? ((home.plans ?? []).find((p) => p.seasonId === show.seasonId && p.couchId === couch.id && p.episode <= next) ?? null) : null;
  // Something out to watch: on now, or an aired episode past your mark.
  const toWatch = live || (show.seenThrough != null && show.seenThrough < show.latestAired);
  const card = move ? moveCard(move, show.seasonId, false, false, words.episode) : null;
  const moveEp = move?.episode ?? up?.number ?? null;
  const lockAt = move?.deadline ? Date.parse(move.deadline) : null;
  // The lock in words only when it isn't the airtime (the head says the airtime: R1, each fact once).
  const lock = move && lockAt != null && lockAt !== t ? `${move.kind === "pickup" ? "Due" : "Locks"} ${calmWhen(lockAt, now)}` : null;
  // Who's in only from the move's own game (a waiver claim has none: another game's "lineups set" would be a wrong fact).
  const count = progress && kind === "move" && progress.leagueId === move?.leagueId ? `Couch: ${progress.done} of ${progress.of} ${progress.label}` : null;
  type Plate = { tag: string; tone: "due" | "good" | "set" | "soon"; title: string; line: string | null; to: string };
  let plate: Plate | null = null;
  if (reveal) {
    const waiting = due.filter(here).length;
    const then = waiting ? `then ${waiting} ${waiting === 1 ? "move" : "moves"}` : null;
    // Two or more behind: say so (Joanna, back after a week).
    const behind = show.seenThrough != null && show.latestAired - show.seenThrough >= 2 ? `You're ${show.latestAired - show.seenThrough} behind` : null;
    const why = reveal.stage === "early" ? (finalWords ? midLine(finalWords) : "Final results later") : (behind ?? "Every game at once");
    plate = {
      tag: `${ep} ${reveal.episode}`,
      tone: "due",
      title: reveal.stage === "early" ? "Reveal the early results" : "Reveal the results",
      line: [why, then].filter(Boolean).join(" · "),
      to: `${paths.show(show.seasonId, "tonight")}?page=reveal&ep=${reveal.episode}`,
    };
  } else if (move && card) {
    const draft = move.kind === "draftStart" || move.kind === "draftTurn" || move.kind === "blindDraft";
    plate = {
      tag: draft ? "Draft" : moveEp != null && !game ? `${ep} ${moveEp}` : (MOVE_TAG[move.kind] ?? "Your move"),
      tone: "due",
      title: card.title,
      line:
        move.kind === "draftStart"
          ? `${move.draftLate ? "It's set for after it airs" : "Nobody can pick until you do"} · ${move.leagueName}`
          : move.kind === "draftTurn"
            ? `Your pick now · ${move.leagueName}`
            : [count, lock].filter(Boolean).join(" · ") || move.leagueName,
      to: moveHref(move, show.seasonId),
    };
  } else if (final) {
    plate = { tag: `${ep} ${final.episode}`, tone: "good", title: "Final results are in", line: "Every point counted", to: href };
  } else if (kind === "set" && soonGame?.draftSoon) {
    // A draft that hasn't started (docs/design-round/draft-start-spec.md): who it waits for, or when it starts, never "All set".
    const w = draftSoonWords(soonGame.draftSoon, soonGame.yourRole === "commissioner", (iso) => draftWhen(iso, now), ep);
    plate = { tag: "Draft", tone: w.due ? "due" : "soon", title: w.title, line: soonGame.name, to: w.backstage ? paths.backstage(show.seasonId) : `${paths.showPage(show.seasonId, draftRoomPage(soonGame.draftSoon.kind))}?game=${soonGame.leagueId}` };
  } else if (kind === "set" && up) {
    plate = { tag: `${ep} ${up.number}`, tone: "set", title: `All set for ${ep} ${up.number}`, line: "Change anything until it airs", to: href };
  }
  const head = game ? null : reveal ? `${ep} ${reveal.episode}` : up ? `${ep} ${up.number}` : null;
  // The season line, unless it only repeats the name (a sport's game: "Cowboys at Eagles, Nov 17").
  const season = game ? "" : show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName && show.seasonName !== show.show.name ? show.seasonName : "";
  // More moves: the show's own (Tonight's strip lists them) and other shows' (the first one's move, or that show).
  const more = moreHere + elsewhere.length;
  const moreTo = moreHere
    ? paths.show(show.seasonId, "tonight")
    : elsewhere.length === 1 && otherShow
      ? moveHref(elsewhere[0], otherShow.seasonId)
      : otherShow
        ? paths.show(otherShow.seasonId)
        : href;
  const moreWords = `${more} more ${more === 1 ? "move" : "moves"}${!moreHere && otherShow ? ` · ${showName(otherShow)}` : ""}`;
  // A long name (past 14 letters) at 34 px, DESIGN.md's title card rule.
  const long = name.length > 14;
  return (
    // Over the show's header art, as its page's show bar (desk parity 7b: the Header's Up next crop), else its cards': Night in
    // both themes (step 15 part 4).
    <section
      data-art-scope
      data-upnext={kind}
      className={`dark relative isolate mx-4 mt-1 flex flex-col overflow-hidden rounded-[4px] text-foreground shadow-[0_18px_40px_rgba(0,0,0,.45)] ${game ? "min-h-[224px]" : plate ? "min-h-[280px]" : "min-h-[220px]"}`}
    >
      <span className="absolute inset-0 -z-[2] overflow-hidden">
        <ShowArt
          seasonId={show.seasonId}
          artUrl={show.show.backdropUrl || show.show.artUrl}
          name={show.show.name}
          position={show.show.backdropUrl ? `${UNFRAMED.header.x}% ${UNFRAMED.header.y}%` : "center"}
          // Still (the user, 2026-11-15: no slow pan).
          className="size-full"
          // No art: the dark ground alone, never a faint copy of the name under the real one.
          bare
        />
      </span>
      {game && !(show.show.backdropUrl || show.show.artUrl) && (
        <span
          aria-hidden
          className="absolute inset-0 -z-[1] opacity-60"
          style={{ background: `linear-gradient(105deg, ${game.sides[0].color ? `#${game.sides[0].color}` : "transparent"} 0%, transparent 50%, ${game.sides[1].color ? `#${game.sides[1].color}` : "transparent"} 100%)` }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.3)_0%,rgba(16,14,21,.15)_28%,rgba(16,14,21,.86)_66%,rgba(16,14,21,.97)_100%)]"
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`type-caption flex items-center gap-1.5 py-[5px] pl-[9px] pr-[18px] text-[13px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)] ${
              live ? "bg-live text-live-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {live && <i className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />}
            {reveal ? "Results are in" : live ? "On now" : "Up next"}
          </span>
          <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{[season, head].filter(Boolean).join(" · ")}</span>
        </div>
        {game ? (
          <h2 className="type-caption mt-auto text-[26px] [text-shadow:0_2px_20px_rgba(0,0,0,.5)]">
            <NavLink href={href} channel data-upnext-open className="flex min-w-0 items-center gap-2 after:absolute after:inset-0">
              <TeamMark abbr={game.sides[0].abbreviation ?? game.sides[0].short.slice(0, 3)} color={game.sides[0].color} size="sm" />
              <span className="truncate">{game.sides[0].short}</span>
              <span className="flex-none text-[17px] text-white/65">at</span>
              <TeamMark abbr={game.sides[1].abbreviation ?? game.sides[1].short.slice(0, 3)} color={game.sides[1].color} size="sm" />
              <span className="truncate">{game.sides[1].short}</span>
              <ChevronRight className="size-6 flex-none" strokeWidth={3} aria-hidden />
            </NavLink>
          </h2>
        ) : (
          <h2 className={`type-caption mt-auto [text-shadow:0_2px_20px_rgba(0,0,0,.5)] ${long ? "text-[34px]" : "text-[44px]"}`}>
            <NavLink href={href} channel data-upnext-open className="inline-flex items-center gap-1 after:absolute after:inset-0">
              {name}
              <ChevronRight className="size-7" strokeWidth={3} aria-hidden />
            </NavLink>
          </h2>
        )}
        {!reveal && t != null && !live && (
          <div className="type-caption -mt-1.5 text-[20px] tracking-[0.02em]" data-upnext-when>
            {calmWhen(t, now)}
          </div>
        )}
        {plate && (
          <NavLink
            href={plate.to}
            channel={plate.to === href}
            data-upnext-plate={kind}
            // The first-time tour's "Your moves" step taps this (tour/tour.tsx visit: a[data-status]).
            data-status={kind === "move" ? "moves" : kind === "reveal" ? "reveal" : undefined}
            className={`nd-press relative z-[1] flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] text-left ${
              plate.tone === "set" || plate.tone === "soon" ? "bg-[rgba(16,14,21,.78)] text-white outline-1 -outline-offset-1 outline-white/20 backdrop-blur-sm" : "bg-plate text-plate-foreground shadow-plate"
            }`}
          >
            <span
              className={`type-caption -mr-[13px] flex items-center gap-1.5 whitespace-nowrap py-0 pl-[11px] pr-[22px] text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${
                plate.tone === "due" ? "bg-chyron text-chyron-foreground" : plate.tone === "good" ? "bg-good text-good-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {plate.tone === "set" && <Check className="size-4" strokeWidth={3} aria-hidden />}
              {plate.tone === "soon" && <Hourglass className="size-4" strokeWidth={2.5} aria-hidden />}
              {plate.tag}
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-1">
              <b data-upnext-title className="text-[16px] font-bold leading-tight">
                {plate.title}
              </b>
              {plate.line && <small className={`text-[14px] leading-tight ${plate.tone === "set" || plate.tone === "soon" ? "text-white/70" : "text-plate-muted"}`}>{plate.line}</small>}
            </span>
            <span className="grid flex-none place-items-center px-2.5">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </NavLink>
        )}
        {night && (
          <div className="relative z-[1]">
            <PlannedNight plan={night} me={home.user.id} />
          </div>
        )}
        {(more > 0 || (!night && toWatch)) && (
          <div className="flex min-h-11 items-center justify-between gap-2.5">
            {more > 0 ? (
              <NavLink
                href={moreTo}
                data-upnext-more={more}
                className="relative z-[1] flex min-h-11 min-w-0 items-center gap-1.5 text-[15px] font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]"
              >
                <i className="size-[7px] flex-none rounded-full bg-chyron-line" aria-hidden />
                <span className="truncate">{moreWords}</span>
                <ChevronRight className="size-4 flex-none" aria-hidden />
              </NavLink>
            ) : (
              <span />
            )}
            {!night && toWatch && (
              <NavLink
                href={paths.watch(show.seasonId)}
                data-upnext-watch
                className="relative z-[1] flex h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-[rgba(16,14,21,.7)] px-3 text-[15px] font-bold text-white outline-1 -outline-offset-1 outline-white/25 backdrop-blur-sm"
              >
                <Tv className="size-4" aria-hidden />
                Watch along
              </NavLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Up next's planned night (step 13 part 3, from Noticed): "Watch along · 3 going", when and how, and Join (you're in, and once it's
 * due, its watch along together) or Open once you're in.
 */
/** The wall clock, read when Join is tapped (never while drawing). */
const wallClock = () => Date.now();

function PlannedNight({ plan, me }: { plan: WatchPlan; me: string }) {
  const setPlans = useSetPlans();
  const openTogether = useOpenTogether();
  const [busy, setBusy] = useState(false);
  const at = Date.parse(plan.startsAt);
  const going = plan.people.filter((x) => x.answer === "in").length;
  const yours = plan.you === "host" || plan.you === "in";
  const join = async () => {
    if (yours) return openTogether(plan);
    setBusy(true);
    try {
      setPlans((await plansApi.answer(plan.id, "in")).plans);
      if (at - (plan.how === "live" ? 0 : START_EARLY_MS) <= wallClock()) openTogether(plan);
      else toast(`You're in · Episode ${plan.episode}, ${airTime(at)}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-upnext-plan={plan.id} data-plan-you={plan.you ?? "none"} className="flex min-h-12 items-center gap-2.5 rounded-[3px] bg-[rgba(16,14,21,.72)] py-1.5 pl-3 pr-1.5 outline-1 -outline-offset-1 outline-good/50 backdrop-blur-sm">
      <Tv className="size-4 flex-none text-good" aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-[13px] font-bold text-white">
          Watch along · {going} going
        </b>
        <small className="block truncate text-xs text-white/75">
          Ep {plan.episode} · {airTime(at)} · {plan.how === "live" ? "the live airing" : "starting together"}
          {plan.you === "invited" ? ` · ${plan.host.userId === me ? "you" : plan.host.name} asked you` : ""}
        </small>
      </span>
      <button
        type="button"
        data-upnext-join={yours ? "open" : "join"}
        disabled={busy}
        onClick={() => void join()}
        className="nd-press h-9 flex-none rounded-[3px] bg-good px-3.5 text-[13px] font-bold text-good-foreground disabled:opacity-50"
      >
        {yours ? "Open" : "Join"}
      </button>
    </div>
  );
}

// ---------- Your shows ----------

/** "T2" → 2. */
const placeOf = (rank: string) => Number(rank.replace(/^T/, ""));

/**
 * A show on your shelf: its art, name, season and night, the games you play on it, a dot if a move is due, and your
 * best place in them as far as you've seen. The corner flips it over to your games and where you stand in each (the
 * mock's poster rear); the rest of it opens the show.
 */
function Poster({ show, due, places }: { show: HomeShow; due: boolean; places: PlayingGame[] }) {
  const [flipped, setFlipped] = useState(false);
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
  // A streaming season (step 14): the day it drops, then the service it's on (the mock's poster).
  const night =
    show.release === "binge"
      ? show.upNext?.airAt
        ? `drops ${day(show.upNext.airAt)}`
        : (show.show.network ?? null)
      : show.upNext?.airAt
        ? day(show.upNext.airAt)
        : null;
  const ranked = places.filter((p) => p.rank);
  const best = ranked.length ? Math.min(...ranked.map((p) => placeOf(p.rank!))) : null;
  const face = "absolute inset-0 overflow-hidden rounded-[4px] shadow-[0_12px_26px_rgba(0,0,0,.45)] [backface-visibility:hidden]";
  return (
    <div data-poster={show.seasonId} className="relative h-[232px] w-[164px] flex-none snap-start [perspective:900px]">
      <div
        data-flipped={flipped || undefined}
        className={`relative size-full transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] [transform-style:preserve-3d] motion-reduce:transition-none ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
      >
        <div className={face} aria-hidden={flipped} inert={flipped}>
          <NavLink href={paths.show(show.seasonId)} channel className="nd-press relative isolate flex size-full flex-col justify-end p-[11px] text-white">
            <ShowArt seasonId={show.seasonId} artUrl={show.show.artUrl} name={show.show.name} className="absolute inset-0 -z-[2] size-full" />
            {/* Getting it ready (show/getting-ready.tsx): a no-signal card until its rules, cast and episodes are in. */}
            {show.filling === "going" && <NoSignal seasonId={show.seasonId} />}
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,0)_35%,rgba(10,8,14,.9)_100%)]" />
            {best && (
              <span data-best className="type-caption absolute left-[9px] top-[9px] bg-plate py-1 pl-[7px] pr-3 text-xs text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                Best {ordinal(best)}
              </span>
            )}
            {/* One the first-time tour's practice added (tour/practice-shows.ts): here for the tour, not saved. */}
            {show.seasonId.startsWith("tour-") && (
              <span data-practice-tag className="type-caption absolute left-[9px] top-[9px] bg-quiet-tag py-1 pl-[7px] pr-3 text-xs text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                Practice
              </span>
            )}
            {show.games.length > 0 && <GamesMark due={due} className="absolute right-[9px] top-[9px]" />}
            <b className="type-caption text-[28px] leading-[.92]">{showName(show)}</b>
            {/* The games' chips left the front in the design round's step 7: the corner turns it over to each game and your place. */}
            <span className={`mt-1 text-xs font-semibold opacity-90 ${places.length ? "pr-8" : ""}`}>
              {show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName}
              {night ? ` · ${night}` : ""}
            </span>
          </NavLink>
          {places.length > 0 && (
            <button
              type="button"
              data-flip
              onClick={() => setFlipped(true)}
              aria-label={`Your games on ${showName(show)}`}
              className="absolute bottom-0 right-0 grid size-11 place-items-center"
            >
              <span className="grid size-[26px] place-items-center rounded-full bg-[rgba(10,8,14,.6)] text-white backdrop-blur-sm">
                <RotateCcw className="size-3.5" aria-hidden />
              </span>
            </button>
          )}
        </div>
        {places.length > 0 && (
          <div className={`${face} flex flex-col bg-card p-[11px] outline-1 -outline-offset-1 outline-border [transform:rotateY(180deg)]`} aria-hidden={!flipped} inert={!flipped}>
            <div className="mb-1 flex items-center justify-between">
              <b className="type-caption truncate text-[17px]">{showName(show)}</b>
              <button type="button" data-unflip onClick={() => setFlipped(false)} aria-label="Flip back" className="-mr-2 -mt-1.5 grid size-10 flex-none place-items-center rounded-[3px]">
                <RotateCcw className="size-4" aria-hidden />
              </button>
            </div>
            {places.map((p) => (
              <NavLink key={p.leagueId} href={paths.show(show.seasonId, "games")} className="flex min-h-11 items-center justify-between gap-2 border-t border-border">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.gameName}</span>
                  <small className="block truncate text-[11px] text-muted-foreground">
                    {p.name} · {p.of} playing
                  </small>
                </span>
                <span className="type-num text-[22px]">{p.rank ? (p.rank.startsWith("T") ? p.rank : ordinal(placeOf(p.rank))) : "–"}</span>
              </NavLink>
            ))}
            <NavLink href={paths.show(show.seasonId)} channel className="mt-auto grid h-10 place-items-center rounded-[3px] bg-foreground text-sm font-bold text-background">
              Open
            </NavLink>
          </div>
        )}
      </div>
    </div>
  );
}

/** A game's going on this show (the user, 2026-11-15: "a game controller in the corner of the show's block"; the guide's card
 *  says it the same way): a white controller, with a yellow dot on it when a move of yours is due there. */
export function GamesMark({ due, className = "" }: { due: boolean; className?: string }) {
  return (
    <span
      data-games-mark={due ? "due" : "on"}
      role="img"
      aria-label={due ? "You play a game on it, and a move is due" : "You play a game on it"}
      className={`grid size-[26px] place-items-center text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,.85))] ${className}`}
    >
      <Gamepad2 className="size-[22px]" strokeWidth={2.2} aria-hidden />
      {due && <i className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-chyron-line shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]" />}
    </span>
  );
}

/**
 * Finished, for the whole couch (the user, 2026-11-15: a season stays while anyone's catching up): it's all aired, you've seen it
 * all, every game of yours on it is over, and everyone on the couch who watches it and shares Where I am is through the last
 * episode. Someone who doesn't share it can't hold it open.
 */
export function finishedFor(home: Home, couch: Couch | null, hub: CouchHub | undefined, s: HomeShow): boolean {
  if (s.status !== "completed") return false;
  const total = Math.max(s.episodeCount ?? 0, s.latestAired);
  if (!total || (s.seenThrough != null && s.seenThrough < total)) return false;
  if ((hub?.games ?? []).some((g) => g.seasonId === s.seasonId && !g.ended)) return false;
  for (const m of couch?.members ?? []) {
    if (m.userId === home.user.id || !m.watching.includes(s.seasonId)) continue;
    const at = m.at?.[s.seasonId];
    if (at != null && at < total) return false;
  }
  return true;
}

/** "Finished · 2 seasons", a fold at the foot of Your shows. */
export function FinishedFold({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-finished-fold={n}
      aria-expanded={open}
      onClick={onToggle}
      className="nd-press mx-4 flex min-h-11 w-[calc(100%-32px)] items-center justify-between border-y border-border text-left text-[15px] font-semibold"
    >
      <span>
        Finished <span className="font-normal text-muted-foreground">· {n} {n === 1 ? "season" : "seasons"}</span>
      </span>
      <ChevronDown className={`size-5 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

/** Your shelf's order: what's on soonest first, then the rest, the newest season first. */
export function shelfOrder(shows: HomeShow[]) {
  const at = (s: HomeShow) => (s.upNext?.airAt ? Date.parse(s.upNext.airAt) : Infinity);
  return [...shows].sort((a, b) => at(a) - at(b) || (b.premiereDate ?? "").localeCompare(a.premiereDate ?? "") || (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
}

export function YourShows({ home, hub, couch = null }: { home: Home; hub: CouchHub | undefined; couch?: Couch | null }) {
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  const [openFinished, setOpenFinished] = useState(false);
  // The first-time tour's demo shows (tour/practice-shows.ts), on the shelf while it shows where shows you add go.
  const practice = usePracticeShows();
  const all = practice.length ? [...home.shows, ...practice] : home.shows;
  // Finished for the whole couch folds away at the foot (the design round's step 7, the user's rule).
  const shows = all.filter((s) => !finishedFor(home, couch, hub, s));
  const finished = all.filter((s) => finishedFor(home, couch, hub, s));
  const poster = (s: HomeShow) => <Poster key={s.seasonId} show={s} due={due.has(s.seasonId)} places={(hub?.games ?? []).filter((p) => p.seasonId === s.seasonId)} />;
  return (
    <section className="mt-8" data-your-shows>
      <SectionHead title="Your shows" />
      <div className="flex gap-3 overflow-x-auto px-4 pb-[18px] pt-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none]">
        {shelfOrder(shows).map((s) => (
          <Poster key={s.seasonId} show={s} due={due.has(s.seasonId)} places={(hub?.games ?? []).filter((p) => p.seasonId === s.seasonId)} />
        ))}
        <button
          type="button"
          data-add-show-poster
          onClick={() => openWatching({ kind: "add" })}
          className="nd-press flex h-[232px] w-[164px] flex-none snap-start flex-col items-center justify-center gap-2 rounded-[4px] p-3 text-center text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
        >
          <span className="grid size-11 place-items-center rounded-[3px] bg-card text-foreground">
            <Plus className="size-6" aria-hidden />
          </span>
          <b className="type-caption text-[22px] text-foreground">Add a show</b>
          <small className="text-[13px] leading-snug">Tell the couch what you&rsquo;re watching.</small>
        </button>
      </div>
      {finished.length > 0 && (
        <>
          <FinishedFold n={finished.length} open={openFinished} onToggle={() => setOpenFinished((o) => !o)} />
          {openFinished && (
            <div data-finished className="nd-rise flex gap-3 overflow-x-auto px-4 pb-[18px] pt-3 [scrollbar-width:none]">
              {shelfOrder(finished).map(poster)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- You both watch ----------

/** "jordan", "riley and jordan", "riley, jordan and 2 more". */
export function namesOf(who: string[]) {
  if (who.length <= 2) return who.join(" and ");
  return `${who.slice(0, 2).join(", ")} and ${who.length - 2} more`;
}

/** Who else on the couch openly watches a season (and shares Where I am: guard.ts; each member's `at` says how far they are). */
export const watchersOn = (couch: Couch | null, meId: string, seasonId: string) => (couch?.members ?? []).filter((m) => m.userId !== meId && m.watching.includes(seasonId));

/**
 * The one show to nudge about (the mock's watching.js nudgeHTML): one you follow that someone else on the couch watches too,
 * still airing or coming up, with no game on the couch and none of yours, and not answered before. The most people first,
 * then the soonest.
 */
export function nudgeShow(home: Home, couch: Couch | null): { show: HomeShow; with: string[] } | null {
  if (!couch) return null;
  const at = (s: HomeShow) => (s.upNext?.airAt ? Date.parse(s.upNext.airAt) : Infinity);
  const list = home.shows
    .filter((s) => s.following && !s.nudgeOff && !s.games.length && s.status !== "completed" && !couch.games.some((g) => g.seasonId === s.seasonId))
    .map((s) => ({ show: s, with: watchersOn(couch, home.user.id, s.seasonId).map((m) => m.name) }))
    .filter((x) => x.with.length > 0)
    .sort((a, b) => b.with.length - a.with.length || at(a.show) - at(b.show));
  return list[0] ?? null;
}

export function BothWatch({ home, couch }: { home: Home; couch: Couch | null }) {
  const refresh = useAfterWatching();
  const [gone, setGone] = useState<string | null>(null);
  const n = nudgeShow(home, couch);
  if (!n || gone === n.show.seasonId) return null;
  const name = plainName(n.show.show.name);
  const ready = n.show.ready !== false;
  return (
    <section className="mx-4 mt-6" data-nudge={n.show.seasonId}>
      <div className="flex flex-col overflow-hidden rounded-[4px] bg-card">
        <ShowArt seasonId={`nudge-${n.show.seasonId}`} artUrl={n.show.show.artUrl} name={name} className="h-24 w-full" />
        <div className="flex flex-col gap-[5px] px-3.5 pb-3.5 pt-3">
          <span className="type-caption self-start bg-secondary py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            {n.with.length > 1 ? "You all watch" : "You both watch"}
          </span>
          <b className="text-[17px] leading-tight">
            {n.with.length > 1 ? `You, ${namesOf(n.with)} all watch ${name}` : `You and ${n.with[0]} both watch ${name}`}
          </b>
          <small className="text-[13px] leading-snug text-muted-foreground">Nobody&rsquo;s playing it yet. Start a game and the couch hears about it once.</small>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ready ? (
              <button
                type="button"
                data-nudge-go
                onClick={() => openStartGame({ seasonId: n.show.seasonId, couchId: couch?.id ?? null })}
                className="nd-press flex h-11 items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-input"
              >
                Start a game
              </button>
            ) : (
              <NavLink
                href={`${paths.show(n.show.seasonId, "games")}?page=make`}
                data-nudge-go
                className="nd-press flex h-11 items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-input"
              >
                Make it a game
              </NavLink>
            )}
            <Btn
              className="h-11"
              data-nudge-no
              onClick={async () => {
                setGone(n.show.seasonId);
                try {
                  await watching.follow(n.show.seasonId, { nudgeOff: true });
                  await refresh();
                  toast("Got it. We won't ask about this one again");
                } catch (e) {
                  setGone(null);
                  toast.quiet((e as Error).message);
                }
              }}
            >
              Not now
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- The couch is watching ----------

type Watched = { s: HomeShow | CouchShow; yours: boolean; who: { userId: string; name: string; at?: Record<string, number> }[] };

/** What the couch watches (the mock's watching.js couchWatchHTML): weekly shows someone else on the couch follows openly,
 *  the ones not on your list first, then the most watched. A streaming drop, or a finished season watched at your own pace, is
 *  the streaming rail's (step 14: streaming.tsx), and a show the couch plays is already on Your shows with its games. */
export function couchWatching(home: Home, couch: Couch | null): Watched[] {
  if (!couch) return [];
  const played = new Set(couch.games.filter((g) => !g.ownPace).map((g) => g.seasonId));
  const all: Watched[] = [
    ...(home.couchShows ?? []).map((s) => ({ s, yours: false, who: watchersOn(couch, home.user.id, s.seasonId) })),
    ...home.shows.filter((s) => s.following || s.games.length).map((s) => ({ s, yours: true, who: watchersOn(couch, home.user.id, s.seasonId) })),
  ];
  return all
    .filter((x) => x.who.length > 0 && !played.has(x.s.seasonId) && !ownPace({ release: x.s.release, status: x.s.status, played: "games" in x.s && x.s.games.some((g) => !g.ownPace) }))
    .sort((a, b) => Number(a.yours) - Number(b.yours) || b.who.length - a.who.length || a.s.show.name.localeCompare(b.s.show.name));
}

const labelOf = (s: { show: { name: string }; seasonNumber: number | null }) => `${plainName(s.show.name)}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

export function CouchWatching({ home, couch }: { home: Home; couch: Couch | null }) {
  const list = couchWatching(home, couch);
  // Who's watching along right now (step 13 part 2: the hub's one read of it, shared with On now).
  const { data: on } = useOnNow(couch?.id ?? null);
  const onNow = (seasonId: string) => (on?.now ?? []).filter((w) => w.seasonId === seasonId);
  if (!list.length) return null;
  return (
    <section className="mt-8" data-couch-watching>
      <SectionHead title="The couch is watching" aside="Tap to check one out" />
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {list.map(({ s, yours, who }) => (
          <div key={s.seasonId} data-watched={labelOf(s)} className="flex w-[200px] flex-none flex-col overflow-hidden rounded-[4px] bg-card">
            <NavLink href={paths.show(s.seasonId)} className="nd-press flex flex-1 flex-col text-left">
              <span className="relative h-24">
                <ShowArt seasonId={`watched-${s.seasonId}`} artUrl={s.show.artUrl} name={plainName(s.show.name)} className="size-full" />
                {!yours && (
                  <span className="type-caption absolute left-2 top-2 rounded-[2px] bg-[rgba(10,8,14,.75)] px-[7px] py-[3px] text-[10px] tracking-[0.05em] text-white outline-1 -outline-offset-1 outline-dashed outline-white/50">
                    Not on your list
                  </span>
                )}
                {onNow(s.seasonId).length > 0 && (
                  <span
                    data-watched-on={onNow(s.seasonId)[0].name}
                    className="type-caption absolute bottom-2 left-2 flex items-center gap-[5px] rounded-[2px] bg-good px-[7px] py-[3px] text-[10px] tracking-[0.05em] text-good-foreground"
                  >
                    <i className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                    {onNow(s.seasonId)[0].name} is on
                  </span>
                )}
              </span>
              <b className="type-caption px-3 pb-1 pt-2.5 text-[18px] leading-none">{labelOf(s)}</b>
              <span className="flex flex-col gap-[5px] px-3 pb-3 text-xs text-muted-foreground">
                {who.slice(0, 3).map((m) => {
                  // How far each is (step 15 part 3: only from those who share Where I am, whose `at` the home read carries).
                  const at = m.at?.[s.seasonId];
                  const where = at == null ? null : whereWords(at, { aired: s.latestAired, total: s.episodeCount ?? 0, ownPace: false }, true);
                  return (
                    <span key={m.userId} className="flex items-center gap-1.5" data-watched-who={m.name}>
                      <Avatar id={m.userId} name={m.name} size={20} />
                      {m.name}
                      {onNow(s.seasonId).some((w) => w.userId === m.userId) ? " · now" : where ? ` · ${where}` : ""}
                    </span>
                  );
                })}
                {who.length > 3 && <span>+{who.length - 3} more</span>}
              </span>
            </NavLink>
            {!yours && (
              <button
                type="button"
                data-watch-add={labelOf(s)}
                onClick={() =>
                  openWatching({
                    kind: "where",
                    target: {
                      seasonId: s.seasonId,
                      label: labelOf(s),
                      show: plainName(s.show.name),
                      artUrl: s.show.artUrl,
                      artPosition: "center",
                      aired: s.latestAired,
                      status: s.status === "upcoming" || s.status === "completed" ? s.status : "airing",
                      premiere: s.premiereDate,
                      seen: 0,
                      following: false,
                      plays: false,
                    },
                  })
                }
                className="nd-press mx-3 mb-3 flex h-10 items-center justify-center gap-1.5 rounded-[3px] text-sm font-bold outline-1 -outline-offset-1 outline-input"
              >
                <Plus className="size-4" aria-hidden />
                Add to my shows
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- On the couch: the feed ----------

/** "now", "5m", "3h", "2d", then the date. */
function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.round(m / 60)}h`;
  if (m < 7 * 24 * 60) return `${Math.round(m / (24 * 60))}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function FeedRow({ e }: { e: FeedItem }) {
  const did =
    e.kind === "revealed"
      ? `revealed Episode ${e.episode}`
      : e.kind === "joined"
        ? "joined the couch"
        : e.kind === "watching"
          ? `started watching ${e.label}`
          : e.kind === "started"
            ? `started ${/^[AEIOU]/.test(e.text ?? "") ? "an" : "a"} ${e.text} · tap to join`
            : e.kind === "planned"
              ? "planned a watch along"
              : e.kind === "bingo"
                ? `called BINGO on Episode ${e.episode} · look at their card`
                : null;
  const body = (
    <>
      <Avatar id={e.userId ?? e.name} name={e.name} size={34} />
      <div className="min-w-0 flex-1 text-sm leading-[1.4]">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1">
            <b className="font-bold">{e.name}</b> {did}
          </span>
          <small className="flex-none text-xs text-muted-foreground">{ago(e.at)}</small>
        </span>
        {(e.kind === "revealed" || e.kind === "started" || e.kind === "bingo") && <span className="mt-0.5 block text-xs text-muted-foreground">{e.label}</span>}
        {e.kind === "planned" && (
          <span data-feed-plan className="mt-0.5 block text-xs text-muted-foreground">
            {e.label} · Ep {e.episode} · {e.how === "live" ? "the live airing" : "starting together"} · {e.startsAt ? airTime(Date.parse(e.startsAt)) : ""} · {e.going} going
          </span>
        )}
        {e.kind === "said" && (
          <>
            {e.gif ? (
              // eslint-disable-next-line @next/next/no-img-element -- a GIF from KLIPY's own hosts (0156)
              <img src={e.gif.url} alt={e.gif.title || "GIF"} data-feed-gif className="mt-[5px] block max-h-[120px] w-[150px] rounded-[3px] object-cover" style={{ aspectRatio: `${e.gif.w} / ${e.gif.h}` }} />
            ) : (
              <span className="mt-[5px] block break-words rounded-[3px] bg-card px-2.5 py-2 text-[15px]">{e.text}</span>
            )}
            <span className="mt-0.5 block text-xs text-muted-foreground">{e.label}</span>
            {!!e.reactions?.length && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {e.reactions.map((r) => (
                  <span
                    key={r.emoji}
                    className={`flex h-[30px] items-center gap-1 rounded-[3px] px-2 text-[13px] font-bold ${r.mine ? "bg-chyron-line/10 outline-1 -outline-offset-1 outline-chyron-line" : "bg-card"}`}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    {r.n}
                  </span>
                ))}
              </span>
            )}
          </>
        )}
      </div>
    </>
  );
  const cls = "flex items-start gap-2.5 border-t border-border py-[11px] text-left first:border-t-0";
  if (!e.seasonId) return <div data-feed={e.kind} className={cls}>{body}</div>;
  return (
    <NavLink
      data-feed={e.kind}
      href={
        e.kind === "bingo"
          ? `${paths.show(e.seasonId, "tonight")}?bingo=${e.episode}&of=${encodeURIComponent(e.userId ?? "")}`
          : paths.show(e.seasonId, e.kind === "watching" || e.kind === "planned" ? "tonight" : e.kind === "started" ? "games" : "chat")
      }
      className={`${cls} nd-press`}
    >
      {body}
    </NavLink>
  );
}

/** What the couch has been up to and said lately (couch-hub.ts), folded past where you are as the chat is. */
/** The feed's first few; the rest one tap on (the user, 2026-11-15: "bloated... could just show 4 and maybe a show more"). */
const FEED_FEW = 4;

export function Feed({ hub }: { hub: CouchHub | undefined }) {
  const chat = hub?.feed.find((e) => e.kind === "said" && e.seasonId);
  const [all, setAll] = useState(false);
  // "Revealed Ep 5" lines are where everyone is, which the hub shows already (the people row, a band's faces): left out.
  const feed = (hub?.feed ?? []).filter((e) => e.kind !== "revealed");
  const shown = all ? feed : feed.slice(0, FEED_FEW);
  return (
    <section className="mt-8" data-feed-list>
      <SectionHead
        title="On the couch"
        aside={
          chat?.seasonId ? (
            <NavLink href={paths.show(chat.seasonId, "chat")} className="font-semibold text-chyron-line">
              Open chat
            </NavLink>
          ) : undefined
        }
      />
      <div className="flex flex-col px-4 pt-1">
        {!hub ? (
          <div className="h-24 animate-pulse rounded-[4px] bg-card" aria-busy />
        ) : feed.length ? (
          <>
            {shown.map((e) => (
              <FeedRow key={e.id} e={e} />
            ))}
            {feed.length > FEED_FEW && (
              <button
                type="button"
                data-feed-more
                aria-expanded={all}
                onClick={() => setAll((a) => !a)}
                className="nd-press flex min-h-11 items-center justify-center gap-1 text-[15px] font-semibold text-muted-foreground"
              >
                {all ? "Show less" : `Show ${feed.length - FEED_FEW} more`}
                <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${all ? "rotate-180" : ""}`} aria-hidden />
              </button>
            )}
          </>
        ) : (
          <p className="py-3 text-sm leading-normal text-muted-foreground">Quiet so far. What the couch says and does shows up here.</p>
        )}
      </div>
    </section>
  );
}

// ---------- the foot, and the new couch's extras ----------

/** The hub's foot: start a game (step 10 part 2b: pick the show, then a game that fits) or join another couch with a code. */
export function Foot({ couchId = null }: { couchId?: string | null }) {
  return (
    <div className="mx-4 mt-8 grid grid-cols-2 gap-2.5">
      <Btn wide data-foot-start onClick={() => openStartGame({ couchId })}>
        <Plus className="size-5" aria-hidden />
        Start a game
      </Btn>
      <Btn data-foot-join onClick={() => openCouchSheet({ kind: "join" })}>
        <Link2 className="size-5" aria-hidden />
        Join a couch
      </Btn>
    </div>
  );
}

/** The show a new couch's first game would be on: the soonest of yours that's a game, still to finish, with none of the couch's on it. */
export function startShow(home: Home, couch: Couch | null): HomeShow | null {
  const at = (s: HomeShow) => (s.upNext?.airAt ? Date.parse(s.upNext.airAt) : Infinity);
  return (
    home.shows
      .filter(
        (s) =>
          (s.following || s.games.length) &&
          s.ready !== false &&
          s.status !== "completed" &&
          s.release !== "binge" &&
          s.show.kind !== "talk" &&
          !(couch?.games ?? []).some((g) => g.seasonId === s.seasonId && !g.archived)
      )
      .sort((a, b) => at(a) - at(b))[0] ?? null
  );
}

/** "Survival Pool needs no draft: Survivor 51 can start with Episode 6 on Wednesday." */
function startLineOf(s: HomeShow): string {
  const label = `${plainName(s.show.name).replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;
  const when = s.upNext ? ` with Episode ${s.upNext.number}${s.upNext.airAt ? ` on ${new Date(s.upNext.airAt).toLocaleDateString("en-US", { weekday: "long" })}` : ""}` : " with the next episode";
  if (s.show.kind === "series") return `Weekly Lineup on ${label}: draft the cast, and it can start${when}.`;
  if (s.show.kind === "sport") return `Weekly Lineup on ${label}: draft from the whole field, and it can start with the next event.`;
  return `Survival Pool needs no draft: ${label} can start${when}.`;
}

/** One of Get the couch going's steps: its number (the first is the one yellow: it's what to do now), title and line. */
function GoStep({ n, title, line, onClick }: { n: number; title: string; line: string; onClick?: () => void }) {
  return (
    <button type="button" data-go-step={n} onClick={onClick} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2.5 text-left">
      <span className="type-num grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-[20px] text-foreground">{n}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold">{title}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <ChevronRight className="size-5 flex-none" aria-hidden />
    </button>
  );
}

/**
 * A new couch's first steps (the mock's fresh.js): start a game (step 10), add the shows you watch (step 10), invite
 * people (your code, and how many are on it).
 */
export function GetGoing({ home, couch }: { home: Home; couch: Couch | null }) {
  const code = useInviteCode(couch?.id ?? null).data?.code;
  const next = startShow(home, couch);
  const startLine = next ? startLineOf(next) : "Pick a show the couch watches. Survival Pool needs no draft.";
  return (
    <section className="mx-4 mt-6" data-get-going>
      <h2 className="type-caption text-[24px]">Get the couch going</h2>
      {couch && <small className="block text-[13px] text-muted-foreground">A new couch · {couch.name}</small>}
      <div className="mt-2 border-b border-border">
        <GoStep n={1} title="Start a game" line={startLine} onClick={() => openStartGame({ seasonId: next?.seasonId ?? null, couchId: couch?.id ?? null })} />
        <GoStep n={2} title="Add the other shows you watch" line="The couch sees what everyone's watching. That's where games start." onClick={() => openWatching({ kind: "add" })} />
        {couch ? (
          <GoStep
            n={3}
            title="Invite more people"
            line={`${code ? `Send ${code}. ` : ""}${couch.members.length} on the couch so far.`}
            onClick={() => openCouchSheet({ kind: "invite", couchId: couch.id })}
          />
        ) : (
          <GoStep n={3} title="Bring your people" line="Start a couch and send the code, or join one with a code" onClick={() => openCouchSheet({ kind: "switch" })} />
        )}
      </div>
    </section>
  );
}

/** One of the grow note's lines: a promise until it's arrived, then a way to the page it promised. */
function GrowLine({ page, icon: Icon, ready, text }: { page: string; icon: typeof Trophy; ready: string | null; text: string }) {
  const p = usePushedPage(page);
  // Couch points' row is the first-time tour's to light (docs/PLAN-first-time-tour.md), promised or there.
  const tour = page === "rankings" ? "rankings" : undefined;
  if (!ready) {
    return (
      <li data-tour={tour} className="flex min-h-11 items-center gap-2.5 text-[13.5px] text-muted-foreground">
        <Icon className="size-4 flex-none" aria-hidden />
        {text}
      </li>
    );
  }
  return (
    <li data-tour={tour}>
      <button type="button" data-grow={page} onClick={p.show} className="flex min-h-11 w-full items-center gap-2.5 text-left text-[13.5px]">
        <Icon className="size-4 flex-none" aria-hidden />
        <span className="flex-1">{ready}</span>
        <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The grows-with-you hub's note of what shows up as the couch plays: power rankings (Couch points, there from the start since
 * 2026-10-31), By the numbers once the stats come in, the trophy shelf when a season ends. Each turns into a way to its page
 * once it's there.
 */
export function GrowNote({ home, hub }: { home: Home; hub: CouchHub | undefined }) {
  const me = (hub?.rankings?.year ?? hub?.rankings?.all)?.find((r) => r.userId === home.user.id);
  const stats = home.shows.some((s) => s.following && s.seenThrough !== 0);
  return (
    <section className="mx-4 mt-8 p-3.5" data-grow-note>
      <b className="type-caption text-base">More shows up as the couch plays</b>
      <ul className="mt-1.5 flex flex-col">
        <GrowLine page="rankings" icon={Trophy} text="Power rankings: Couch points for joining in" ready={hub?.rankings ? (me ? `Power rankings: you're ${me.rank.startsWith("T") ? `tied ${ordinal(me.place)}` : ordinal(me.place)}` : "Power rankings are in") : null} />
        <GrowLine page="numbers" icon={ChartColumn} text="By the numbers, once the stats come in" ready={stats ? "By the numbers: who leads every stat" : null} />
        <GrowLine page="trophies" icon={Crown} text="The trophy shelf, when a season ends" ready={hub?.trophies ? "The trophy shelf: every season the couch has finished" : null} />
      </ul>
    </section>
  );
}
