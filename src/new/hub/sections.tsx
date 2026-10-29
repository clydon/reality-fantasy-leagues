"use client";

import { useState } from "react";
import { ChartColumn, ChevronRight, Crown, Link2, Plus, RotateCcw, Tv, Trophy } from "lucide-react";
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
  type WeekProgress,
} from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { openStartGame } from "../couch/start-game";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar, useNow } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Btn, SectionHead } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { openWatching } from "../watching/sheets";
import { useOpenTogether } from "../show/watch-along";
import { showWords } from "@/lib/game/show-words";

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
  if (m.kind === "pickup") return `${name} waivers ${when ? `close ${when}` : "are open"}`;
  return m.text.charAt(0).toLowerCase() + m.text.slice(1);
}

/** Moves in the order they're due: soonest deadline first, the ones without one after. */
export function movesByDue(moves: Move[]) {
  return [...moves].sort((a, b) => (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity));
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
            <b className="text-foreground">{reveal.results.reveal!.stage === "early" ? "Early results are in" : "Results are in"}</b> · {showName(reveal)} Episode {reveal.results.reveal!.episode}
            {moves.length ? ` · ${due}` : ""}
          </>
        ) : kind === "moves" ? (
          <>
            <b className="text-foreground">{due}</b> · {moveLine(first, show)}
          </>
        ) : kind === "final" ? (
          <>
            <b className="text-foreground">Final scores are in</b> · {showName(morning!)} Episode {morning!.results.final!.episode}
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

/** Who's set: the people in that game, those not set yet dimmed, and the count. */
function WhoIsSet({ progress }: { progress: WeekProgress }) {
  return (
    <span data-progress className="flex items-center gap-2.5 text-[13px] text-white/90">
      <span className="flex">
        {progress.people.slice(0, 6).map((p, i) => (
          <span key={p.playerId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""} ${p.done ? "" : "opacity-45"}`}>
            <Avatar id={p.userId ?? p.playerId} name={p.name} size={24} />
          </span>
        ))}
      </span>
      {progress.done} of {progress.of} {progress.label}
    </span>
  );
}

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

/**
 * The show on next: its art large, when it's on, and on a caption plate what it asks of you: Reveal when its results
 * are in (the one yellow), else your move for it (yellow), else the morning update's final scores (teal); then who's set.
 * Nothing to do: no plate (it said "All set · Nothing due", on a show with no game too, and a line that asks nothing of
 * you is noise; the show's name still opens it, and who's set still shows).
 */
export function UpNext({ home, show, couch }: { home: Home; show: HomeShow; couch: Couch | null }) {
  const up = show.upNext;
  const reveal = show.results?.reveal ?? null;
  const final = !reveal ? (show.results?.final ?? null) : null;
  const move = movesByDue(home.moves).find((m) => show.games.some((g) => g.leagueId === m.leagueId));
  // Who's set: in the game of the move on the plate ("0 of 4 picked" beside a pick), else in this couch's game here (a
  // lineup's before a pick's), else in any of yours.
  const here = show.progress.filter((p) => !couch || couch.games.some((g) => g.leagueId === p.leagueId));
  const pool = here.length ? here : show.progress;
  const progress =
    (move && pool.find((p) => p.leagueId === move.leagueId)) ?? [...pool].sort((a, b) => Number(a.label !== "lineups set") - Number(b.label !== "lineups set"))[0];
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  const name = showName(show);
  const href = paths.show(show.seasonId);
  const kind = reveal ? "reveal" : move ? "move" : final ? "final" : "set";
  const ep = showWords(show.show.terms).ep;
  // A night the couch planned on this show (the soonest you can watch: never past your next episode) takes Watch along's place.
  const next = show.seenThrough == null ? Number.POSITIVE_INFINITY : show.seenThrough + 1;
  const night = couch ? ((home.plans ?? []).find((p) => p.seasonId === show.seasonId && p.couchId === couch.id && p.episode <= next) ?? null) : null;
  const plate = kind === "set" ? null : {
    reveal: {
      tag: "Reveal",
      tone: "bg-chyron text-chyron-foreground",
      title: `Episode ${reveal?.episode} ${reveal?.stage === "early" ? "early results" : "results"} are in`,
      line: reveal?.stage === "early" ? "Who went home · full scores come later" : "Watched it? Reveal for every game at once",
    },
    move: {
      tag: move ? (MOVE_TAG[move.kind] ?? "To do") : "",
      tone: "bg-chyron text-chyron-foreground",
      title: move?.text ?? "",
      line: move?.deadline ? `${move.kind === "lineup" || move.kind === "pick" ? "Locks" : "Due"} ${calmWhen(Date.parse(move.deadline), now)}` : (move?.leagueName ?? ""),
    },
    final: { tag: "Morning update", tone: "bg-good text-good-foreground", title: "Final scores are in", line: `Episode ${final?.episode} · every point counted` },
  }[kind];
  return (
    // Over the show's header art, as its page's show bar (desk parity 7b: the Header's Up next crop), else its cards': Night in
    // both themes (step 15 part 4).
    <section data-art-scope data-upnext={kind} className="dark relative isolate mx-4 mt-1 flex min-h-[330px] flex-col overflow-hidden rounded-[4px] text-foreground shadow-[0_18px_40px_rgba(0,0,0,.45)]">
      <span className="absolute inset-0 -z-[2] overflow-hidden">
        <ShowArt
          seasonId={show.seasonId}
          artUrl={show.show.backdropUrl || show.show.artUrl}
          name={show.show.name}
          position={show.show.backdropUrl ? `${UNFRAMED.header.x}% ${UNFRAMED.header.y}%` : "center"}
          className="nd-kenburns size-full"
        />
      </span>
      <span
        aria-hidden
        className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.25)_0%,rgba(16,14,21,.2)_30%,rgba(16,14,21,.88)_72%,rgba(16,14,21,.97)_100%)]"
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`type-caption py-[5px] pl-[9px] pr-[18px] text-[13px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)] ${
              !reveal && up?.live ? "bg-live text-live-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {reveal ? "Results are in" : up?.live ? "On now" : "Up next"}
          </span>
          <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
            {show.seasonNumber ? `Season ${show.seasonNumber}` : (show.seasonName ?? "")}
            {reveal ? ` · ${ep} ${reveal.episode}` : up ? ` · ${ep} ${up.number}${t != null ? ` · ${airTime(t)}` : ""}` : ""}
          </span>
        </div>
        <h2 className="type-caption mt-auto text-[44px] [text-shadow:0_2px_20px_rgba(0,0,0,.5)]">
          <NavLink href={href} channel className="inline-flex items-center gap-1">
            {name}
            <ChevronRight className="size-7" strokeWidth={3} aria-hidden />
          </NavLink>
        </h2>
        {!reveal && t != null && !up?.live && <div className="type-caption -mt-1 text-[20px] tracking-[0.02em]">{calmWhen(t, now)}</div>}
        {plate && (
          <NavLink
            href={href}
            channel
            className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
          >
            <span
              className={`type-caption -mr-[13px] flex items-center whitespace-nowrap py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${plate.tone}`}
            >
              {plate.tag}
            </span>
            <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
              <span className="type-caption text-[19px]">{plate.title}</span>
              <span className="text-[13px] text-plate-muted">{plate.line}</span>
            </span>
            <span className="grid place-items-center px-3">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </NavLink>
        )}
        {night && <PlannedNight plan={night} me={home.user.id} />}
        <div className="flex items-center justify-between gap-2.5">
          {progress && !reveal ? <WhoIsSet progress={progress} /> : <span />}
          {!night && (
            <NavLink
              href={paths.watch(show.seasonId)}
              data-upnext-watch
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-[rgba(16,14,21,.7)] px-3 text-[13px] font-bold text-white outline-1 -outline-offset-1 outline-white/25 backdrop-blur-sm"
            >
              <Tv className="size-4" aria-hidden />
              Watch along
            </NavLink>
          )}
        </div>
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

// ---------- On now ----------

/**
 * Who else on the couch is watching along right now (step 13 part 2; the mock's hubplus.js nowHTML, its Watch along moved under the
 * name, where the mock's cut the show's name off at 390): the first of them (on one of
 * your shows first), which show and episode, and how many more. On a show of yours it opens your watch along of it (their episode
 * when you're that far, else your next: never past it); on one you don't follow, the show. Read once when the hub opens
 * (watch-along.ts couchOnNow), never polled; with nobody on, nothing here.
 */
export function OnNow({ home, couch }: { home: Home; couch: Couch | null }) {
  const { data } = useOnNow(couch?.id ?? null);
  const list = data?.now ?? [];
  if (!list.length) return null;
  const mine = (seasonId: string) => home.shows.find((s) => s.seasonId === seasonId && (s.following || s.games.length > 0));
  const w = [...list].sort((a, b) => Number(!!mine(b.seasonId)) - Number(!!mine(a.seasonId)))[0];
  const yours = mine(w.seasonId);
  const next = yours ? (yours.seenThrough == null ? Number.POSITIVE_INFINITY : yours.seenThrough + 1) : 0;
  const href = yours ? paths.watch(w.seasonId, w.episode <= next ? w.episode : null) : paths.show(w.seasonId);
  return (
    <NavLink
      href={href}
      data-on-now={w.name}
      data-on-now-season={w.seasonId}
      className="nd-press mx-4 mb-3.5 mt-3.5 flex items-center gap-2.5 rounded-[4px] bg-good/10 px-2.5 py-2 text-left outline-1 -outline-offset-1 outline-good/45"
    >
      <span className="type-caption flex flex-none items-center gap-[5px] text-[10px] tracking-[0.06em] text-good">
        <i className="size-[7px] animate-pulse rounded-full bg-good" aria-hidden />
        On now
      </span>
      <Avatar id={w.userId} name={w.name} size={26} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm">
          {w.name} is watching {plainName(w.header.show.name)}
        </b>
        <small className="flex items-center whitespace-nowrap text-xs text-muted-foreground">
          {w.live ? "Live · " : ""}Episode {w.episode}
          {list.length > 1 ? ` · and ${list.length - 1} more` : ""}
          {" · "}
          <span className="ml-1 inline-flex items-center gap-0.5 font-bold text-good">
            {yours ? "Watch along" : "Have a look"} <ChevronRight className="size-3.5" aria-hidden />
          </span>
        </small>
      </span>
    </NavLink>
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
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,0)_35%,rgba(10,8,14,.9)_100%)]" />
            {best && (
              <span data-best className="type-caption absolute left-[9px] top-[9px] bg-plate py-1 pl-[7px] pr-3 text-xs text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                Best {ordinal(best)}
              </span>
            )}
            {due && <i className="absolute right-[11px] top-[11px] size-2.5 rounded-full bg-live" aria-label="A move is due" />}
            <b className="type-caption text-[28px] leading-[.92]">{showName(show)}</b>
            <span className="mt-1 text-xs font-semibold opacity-90">
              {show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName}
              {night ? ` · ${night}` : ""}
            </span>
            {show.games.length > 0 && (
              <span className={`mt-2 flex flex-wrap gap-1 ${places.length ? "pr-8" : ""}`}>
                {/* By game, once each: the same game on two couches is one chip. */}
                {[...new Set(show.games.map((g) => g.gameName))].map((name) => (
                  <span key={name} className="rounded-[2px] bg-[rgba(10,8,14,.6)] px-[5px] py-[3px] text-[10px] font-bold backdrop-blur-sm">
                    {name}
                  </span>
                ))}
              </span>
            )}
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

/** Your shelf's order: what's on soonest first, then the rest, the newest season first. */
function shelfOrder(shows: HomeShow[]) {
  const at = (s: HomeShow) => (s.upNext?.airAt ? Date.parse(s.upNext.airAt) : Infinity);
  return [...shows].sort((a, b) => at(a) - at(b) || (b.premiereDate ?? "").localeCompare(a.premiereDate ?? "") || (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
}

export function YourShows({ home, hub }: { home: Home; hub: CouchHub | undefined }) {
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  return (
    <section className="mt-8">
      <SectionHead title="Your shows" aside={home.shows.length ? "Tap to open" : undefined} />
      <div className="flex gap-3 overflow-x-auto px-4 pb-[18px] pt-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none]">
        {shelfOrder(home.shows).map((s) => (
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
    </section>
  );
}

// ---------- You both watch ----------

/** "jordan", "riley and jordan", "riley, jordan and 2 more". */
export function namesOf(who: string[]) {
  if (who.length <= 2) return who.join(" and ");
  return `${who.slice(0, 2).join(", ")} and ${who.length - 2} more`;
}

/** As people say a show: "The Traitors", not "The Traitors (US)". */
const plainName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

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
  const played = new Set(couch.games.map((g) => g.seasonId));
  const all: Watched[] = [
    ...(home.couchShows ?? []).map((s) => ({ s, yours: false, who: watchersOn(couch, home.user.id, s.seasonId) })),
    ...home.shows.filter((s) => s.following || s.games.length).map((s) => ({ s, yours: true, who: watchersOn(couch, home.user.id, s.seasonId) })),
  ];
  return all
    .filter((x) => x.who.length > 0 && !played.has(x.s.seasonId) && !ownPace({ release: x.s.release, status: x.s.status, played: "games" in x.s && x.s.games.length > 0 }))
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
            <span className="mt-[5px] block break-words rounded-[3px] bg-card px-2.5 py-2 text-[15px]">{e.text}</span>
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
export function Feed({ hub }: { hub: CouchHub | undefined }) {
  const chat = hub?.feed.find((e) => e.kind === "said" && e.seasonId);
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
        ) : hub.feed.length ? (
          hub.feed.map((e) => <FeedRow key={e.id} e={e} />)
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
    <button type="button" data-go-step={n} onClick={onClick} className="flex w-full items-center gap-3 border-t border-plate-muted/20 py-2.5 text-left">
      <span className={`type-num grid size-10 flex-none place-items-center rounded-[3px] text-[20px] ${n > 1 ? "bg-chyron-foreground text-white" : "bg-chyron text-chyron-foreground"}`}>{n}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="block text-[12.5px] leading-snug text-plate-muted">{line}</small>
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
    <section className="mx-4 mb-3 rounded-[4px] bg-plate p-3.5 text-plate-foreground" data-get-going>
      <span className="type-caption inline-block bg-chyron py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
        New couch
      </span>
      <b className="type-caption mt-2 block text-[30px]">Get the couch going</b>
      {couch && <small className="block text-[13px] text-plate-muted">{couch.name}</small>}
      <div className="mt-2">
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
  if (!ready) {
    return (
      <li className="flex min-h-11 items-center gap-2.5 text-[13.5px] text-muted-foreground">
        <Icon className="size-4 flex-none" aria-hidden />
        {text}
      </li>
    );
  }
  return (
    <li>
      <button type="button" data-grow={page} onClick={p.show} className="flex min-h-11 w-full items-center gap-2.5 text-left text-[13.5px]">
        <Icon className="size-4 flex-none" aria-hidden />
        <span className="flex-1">{ready}</span>
        <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The grows-with-you hub's note of what shows up as the couch plays: power rankings after the first scored episode, By
 * the numbers once the stats come in, the trophy shelf when a season ends. Each turns into a way to its page once it's
 * there.
 */
export function GrowNote({ home, hub }: { home: Home; hub: CouchHub | undefined }) {
  const me = hub?.rankings?.year.find((r) => r.userId === home.user.id) ?? hub?.rankings?.all.find((r) => r.userId === home.user.id);
  const stats = home.shows.some((s) => s.following && s.seenThrough !== 0);
  return (
    <section className="mx-4 mt-8 p-3.5" data-grow-note>
      <b className="type-caption text-base">More shows up as the couch plays</b>
      <ul className="mt-1.5 flex flex-col">
        <GrowLine page="rankings" icon={Trophy} text="Power rankings, after your first scored episode" ready={hub?.rankings ? (me ? `Power rankings: you're ${me.rank.startsWith("T") ? `tied ${ordinal(me.place)}` : ordinal(me.place)}` : "Power rankings are in") : null} />
        <GrowLine page="numbers" icon={ChartColumn} text="By the numbers, once the stats come in" ready={stats ? "By the numbers: who leads every stat" : null} />
        <GrowLine page="trophies" icon={Crown} text="The trophy shelf, when a season ends" ready={hub?.trophies ? "The trophy shelf: every season the couch has finished" : null} />
      </ul>
    </section>
  );
}
