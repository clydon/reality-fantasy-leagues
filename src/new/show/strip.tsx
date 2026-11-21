"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Hourglass, Lock, Plus } from "lucide-react";
import { airTime } from "../clock";
import type { Move } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { draftRoomPage, draftSoonWords, draftWhen } from "./draft-words";
import type { ShowData } from "../screens/show-space";
import { openCall } from "./calls";
import { doneCards, first, isRequired, moveCard, openMoves, tabOf, type MovesTab } from "./moves";
import { Face } from "./parts";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { openSheet } from "./questions";
import { catchingUpIn, hasPacePlate, movedIn } from "./pace-plate";
import { showLabel } from "./react";
import { dotColour, lockedInEpisode, nightGroups, nightLabel, useLockIn, windowEpisode, type NightGroup } from "./strip-night";
import { RunnerLine } from "../manage/jobs";

// The strip (the design round's step 3: docs/design-round/step3-tonight-spec.md, "Two parts every show tab shares"; Phase 0's
// decision 2): the show's one statement of what's yours to set, under the show bar in the same place on every tab but Chat. It
// replaces the dock and Tonight's carousel of move cards. Due: DESIGN.md's alert strip, a chyron tag and a white plate (the view's
// one yellow). All set, locked, or waiting on a reveal: the same shape on a night panel, no yellow. Nothing to set: no strip.
// A game at your own pace on an aired episode (pace-plate.tsx catchingUpIn) has its move for that episode here, from the game
// itself (the plate's Set step, folded in: "Before you reveal it"), and its reveal in the control. A game with a plate of its own
// (drafting together, picking your team, a waiver moment: hasPacePlate) says its move there, so it isn't counted here.
// A draft that hasn't started (docs/design-round/draft-start-spec.md): whoever runs the game has it as their move ("Start the draft",
// due, first); everyone else sees it waiting, quiet with an hourglass ("Waiting for Riley to start the draft"), never "All set".

export interface StripState {
  /** "soon": something's coming in a game here that isn't yours to do (a draft that hasn't started): quiet, an hourglass. */
  tone: "due" | "waits" | "set" | "locked" | "soon";
  /** The episode it's for: "Ep 6". */
  tag: string;
  title: string;
  line: string | null;
  /** Where a tap goes when it isn't the lead move's own place: a game at your own pace's move. */
  open?: { tab: MovesTab; leagueId: string };
  /** Or a page: the draft room of a draft that hasn't started. */
  href?: string;
  /** Episode night (strip-night.ts): while your moves for an episode on now or aired stay open, you've locked in, or one locked at
   *  airtime is on: who you've got, game by game. */
  night?: { groups: NightGroup[]; episode: number; onAir: boolean };
}

/**
 * Episode night (docs/design-round/strip-night-spec.md; look C, the user's pick): the strip while your moves stay open after
 * airtime; null outside it. The window: a live or own-pace game still takes your moves for an episode that's on, or aired, and you
 * haven't watched (GameView.late). In it the moves are open until you start watching; something missing is the yellow. Locked in
 * (GameView.watching: you said you're watching it), it's locked, with who you've got; so is an episode on air with no window (a
 * game locked at airtime, or by hand).
 */
function nightState(show: ShowData, open: Move[]): StripState | null {
  const up = show.upNext;
  const ep = show.words.ep;
  const n = windowEpisode(show);
  const sid = show.header?.seasonId ?? "";
  // A move's own words, never split inside ("Pick who survives"); moves joined so a line breaks between them, the dot leading.
  const words = (ms: Move[]) => [...new Set(ms.map((m) => moveCard(m, sid, false, false, show.words.episode).title))].map((t) => t.replace(/ /g, "\u00a0"));
  const join = (xs: string[]) => xs.join(" ·\u00a0");
  // You said you're watching it (Lock in, Your moves' question, or Watch along): locked in, in every game, by the server's lock.
  const watching = lockedInEpisode(show);
  if (n == null && watching != null) {
    const groups = nightGroups(show, watching, new Set()).map((g) => ({ ...g, locked: true, open: 0 }));
    if (!groups.length) return null;
    return { tone: "locked", tag: `${ep} ${watching}`, title: "Locked in", line: "You're watching it", open: { tab: groups[0].tab, leagueId: groups[0].leagueId }, night: { groups, episode: watching, onAir: !!up?.live && up.number === watching } };
  }
  if (n != null && (!up || (up.live ? up.number === n : up.number > n))) {
    // The episode's own moves lead (they're the ones before you start watching); anything else due (a replacement owed) after them.
    const due = [...open].sort((a, b) => Number(!!b.late) - Number(!!a.late));
    const replace = due.filter((m) => m.kind === "pickup").map((m) => ({ leagueId: m.leagueId, href: m.href }));
    const groups = nightGroups(show, n, new Set(due.filter((m) => m.kind !== "pickup").map((m) => m.leagueId)), replace);
    if (!groups.length && !due.length) return null;
    // The tag names the episode, so the title doesn't again (the critique: "Ep 6" five times in a view).
    const tag = `${ep} ${n}`;
    const night = { groups, episode: n, onAir: !!up?.live };
    const lead = groups.find((g) => g.due && !g.locked && g.kind !== "replace") ?? groups.find((g) => !g.locked && g.kind !== "replace") ?? groups[0];
    const opens = lead && lead.kind !== "replace" ? { tab: lead.tab, leagueId: lead.leagueId } : undefined;
    if (due.length) {
      const late = due.filter((m) => m.late);
      // Only a move that isn't the episode's (a replacement owed): its own words and time, as the lead move always had.
      if (!late.length) return { tone: "due", tag, title: join(words(due)), line: due[0].deadline ? `Due ${airTime(Date.parse(due[0].deadline))}` : null, night };
      // A live game's window closes when the next one airs: said once that's within a day (on the night it's a week off).
      const cap = late.map((m) => (m.deadline ? Date.parse(m.deadline) : null)).find((d): d is number => d != null && d - Date.now() < 864e5);
      // The condition leads, the moves under it (the user, 2026-11-18: someone twenty minutes in reads that it isn't theirs). A
      // replacement keeps its own time: it isn't a before-you-watch move.
      const rest = due.filter((m) => !m.late).map((m) => `${words([m])[0]}${m.deadline ? ` by\u00a0${airTime(Date.parse(m.deadline)).replace(/ /g, "\u00a0")}` : ""}`);
      // The faces show the moves (the dashed places), so the line counts what the badge counts, one line (the check).
      const line = join([`${late.length}\u00a0to\u00a0set`, ...rest]);
      return { tone: "due", tag, title: `Before you start watching${cap ? ` · locks ${airTime(cap)}` : ""}`, line, open: opens, night };
    }
    // Two games at different paces: the open one is named, the locked one has its padlock.
    const openKinds = [...new Set(groups.filter((g) => !g.locked && g.kind !== "replace").map((g) => g.kind))];
    const mixed = groups.some((g) => g.locked) && openKinds.length > 0;
    const noun = openKinds.length === 1 ? (openKinds[0] === "pick" ? "Your pick" : "Your lineup") : "Your moves";
    return { tone: "set", tag, title: "All set", line: mixed ? `${noun} ${openKinds.length === 1 ? "locks" : "lock"} when you start watching; the rest locked at airtime` : "Locks when you start watching", open: opens, night };
  }
  // On air with no window: everything locked at its start (a game At airtime, or locked by hand). Who you've got stays on it.
  if (n == null && up?.live) {
    const groups = nightGroups(show, up.number, new Set()).filter((g) => g.locked);
    if (!groups.length) return null;
    return { tone: "locked", tag: `${ep} ${up.number}`, title: "Locked at airtime", line: null, open: { tab: groups[0].tab, leagueId: groups[0].leagueId }, night: { groups, episode: up.number, onAir: true } };
  }
  return null;
}

/** What the strip says, or null for no strip. Pure: the show as Tonight reads it. */
export function stripState(show: ShowData): StripState | null {
  if (show.readOnly || !show.games.some((g) => g.yourRole)) return null;
  const up = show.upNext;
  const ep = show.words.ep;
  const paced = new Set((show.play ?? []).filter(hasPacePlate).map((g) => g.leagueId));
  const behind = (show.play ?? []).filter((g) => catchingUpIn(g) && !paced.has(g.leagueId));
  for (const g of behind) paced.add(g.leagueId);
  const open = show.moves.filter((m) => isRequired(m) && !paced.has(m.leagueId));
  const night = nightState(show, open);
  if (night) return night;
  // Your own-pace games' moves for the episode you're on: before anything due live (it's what you play next), soonest episode first.
  const mine = behind.filter((g) => !movedIn(g)).sort((a, b) => a.catchUp!.week - b.catchUp!.week);
  if (mine.length && !up?.live) {
    const g = mine[0];
    const lineup = !!g.lineup && !g.pick;
    const more = mine.length + open.length - 1;
    return {
      tone: "due",
      tag: `${ep} ${g.catchUp!.week}`,
      title: `${lineup ? "Set your lineup" : "Pick who survives"}${more > 0 ? ` · ${more} more` : ""}`,
      line: "Before you reveal it",
      open: { tab: lineup ? "lineup" : "pool", leagueId: g.leagueId },
    };
  }
  const n = open[0]?.episode ?? up?.number ?? null;
  const tag = n != null ? `${ep} ${n}` : "Your move";
  // On air with nothing of yours drawn for it (no window, no lineup or pick). "Scores stay hidden until you reveal" left the strip
  // (decisions.md, 2026-11-18): no scores exist while it's on, and the progress control says what's waiting once they do.
  if (up?.live) return { tone: "locked", tag: `${ep} ${up.number}`, title: `Locked for ${ep} ${up.number}`, line: null };
  // A draft that waits for you to start it: nobody else can pick until you do, so it leads, whatever else is due (the draft spec).
  const start = open.find((m) => m.kind === "draftStart");
  if (start) {
    const more = new Set(open.filter((m) => m !== start).map((m) => m.kind + m.leagueId)).size;
    const twin = open.filter((m) => m.kind === "draftStart").length > 1;
    // A time set after the game's first episode airs: move it (or start it now), the same yellow.
    const late = start.draftLate && start.episode != null;
    return {
      tone: "due",
      tag: "Draft",
      title: `${late ? `Move the draft before ${ep} ${start.episode}` : "Start the draft"}${more ? ` · ${more} more` : ""}`,
      line: `${late ? "It's set for after it airs" : "Nobody can pick until you do"}${twin ? ` · ${start.leagueName}` : ""}`,
    };
  }
  if (open.length) {
    // A draft turn is due now, not at a lock: it leads, and the line says so (step 6's check).
    const turn = open.some((m) => m.kind === "draftTurn");
    const titles = [...new Set([...open].sort((x, y) => Number(y.kind === "draftTurn") - Number(x.kind === "draftTurn")).map((m) => moveCard(m, show.header?.seasonId ?? "", false, false, show.words.episode).title))];
    const title = titles.slice(0, 2).join(" · ") + (titles.length > 2 ? ` · ${titles.length - 2} more` : "");
    const dues = open.map((m) => (m.deadline ? Date.parse(m.deadline) : null)).filter((d): d is number => d != null);
    const first = dues.length ? Math.min(...dues) : up?.airAt ? Date.parse(up.airAt) : null;
    // A due move whose game waits on results you haven't revealed comes after the reveal (the control holds it, and the yellow).
    const waitsOn = open.map((m) => (m.late ? null : (show.play?.find((g) => g.leagueId === m.leagueId)?.revealFirst ?? null))).find((x) => x != null) ?? null;
    if (waitsOn != null) return { tone: "waits", tag, title, line: `After you reveal ${ep} ${waitsOn}` };
    const lockWord = open.some((m) => m.kind === "pickup") ? "due" : open.length > 1 ? "first locks" : "locks";
    // A lock at airtime is said by the control's air time: the strip says when in words, not the time again (R1: each fact once).
    const atAir = first != null && up?.airAt != null && first === Date.parse(up.airAt) && lockWord !== "due";
    const line = first == null ? null : atAir ? (open.length > 1 ? "Lock when it airs" : "Locks when it airs") : `${lockWord[0].toUpperCase()}${lockWord.slice(1)} ${airTime(first)}`;
    return { tone: "due", tag, title, line: turn ? "Your pick now" : line };
  }
  // A draft that hasn't started in a game here, and nothing of yours due: who it waits for, or when it starts (never "All set": you
  // have no team yet). Not one that can't open yet (a later stage's, waiting on the results before it: its game's page says when).
  const soon = (show.play ?? []).find((g) => !paced.has(g.leagueId) && !g.over && g.draftSoon && !g.draftSoon.waits && g.yourRole);
  if (soon?.draftSoon) {
    const seasonId = show.header?.seasonId ?? "";
    const w = draftSoonWords(soon.draftSoon, soon.yourRole === "commissioner", (iso) => draftWhen(iso), ep);
    return { tone: w.due ? "due" : "soon", tag: "Draft", title: w.title, line: w.line, href: w.backstage ? paths.backstage(seasonId) : `${paths.showPage(seasonId, draftRoomPage(soon.draftSoon.kind))}?game=${soon.leagueId}` };
  }
  // Every own-pace move in for the episode you're on: all set until you reveal it.
  if (behind.length) {
    const w = Math.min(...behind.map((g) => g.catchUp!.week));
    if (behind.some((g) => g.pick || g.lineup)) return { tone: "set", tag: `${ep} ${w}`, title: `All set for ${ep} ${w}`, line: "Change it until you reveal" };
  }
  const others = (show.play ?? []).filter((g) => !paced.has(g.leagueId));
  if (!up || !others.length || others.every((g) => g.over)) return null;
  const done = doneCards(others);
  // The air time is the control's: the strip says until when in words (R1: each fact once).
  return { tone: "set", tag: `${ep} ${up.number}`, title: `All set for ${ep} ${up.number}`, line: done.length ? "Change anything until it airs" : null };
}

/** The strip, and under it a runner's job when there's one (Settings Round 3b: manage/jobs.tsx RunnerLine, quiet, never a second
 *  yellow). */
export function MovesStrip({ show, tab }: { show: ShowData; tab?: string }) {
  return (
    <>
      <PlayerStrip show={show} tab={tab} />
      <RunnerLine show={show} />
    </>
  );
}

function PlayerStrip({ show, tab }: { show: ShowData; tab?: string }) {
  const nav = useNav();
  const s = stripState(show);
  // The moment it's all set (the user's B3, 2026-11-15: "you're all set" as a moment, not a bar that vanishes): when the last due
  // move is saved, the tag's yellow drains once and the tick settles in (new.css .nd-settle; none under reduced motion).
  const was = useRef(s?.tone);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const before = was.current;
    was.current = s?.tone;
    if (before !== "due" || s?.tone !== "set") return;
    setSettled(true);
    const id = setTimeout(() => setSettled(false), 1400);
    return () => clearTimeout(id);
  }, [s?.tone]);
  if (!s) return null;
  const seasonId = show.header?.seasonId ?? "";
  const go = () => {
    const open = show.moves.filter(isRequired);
    const lead = open[0];
    const href = lead ? (moveCard(lead, seasonId, false).href ?? null) : null;
    if (s.open) return openMoves(s.open.tab, s.open.leagueId);
    if (s.href) return nav.push(s.href);
    if (s.tone === "due" && href) return nav.push(href);
    if (s.tone === "due" && lead?.kind === "calls" && show.header) return openCall({ seasonId, couchId: show.couch?.id ?? null, episode: lead.episode ?? show.upNext?.number ?? 1, label: showLabel(show), solo: show.solo });
    if (s.tone === "due" && lead?.kind === "questions" && show.header) return openSheet({ seasonId, leagueId: lead.leagueId, episode: null, game: lead.leagueName });
    openMoves(tabOf(lead), lead?.leagueId ?? null);
  };
  const due = s.tone === "due";
  // On Tonight in the window: the plate, a row a game (every other tab keeps the one-line strip).
  if (s.night && tab === "tonight" && s.tone !== "locked") return <NightPlate s={s} settled={settled} seasonId={seasonId} />;
  // The faces row while it fits (three games: past that the line's count says it), and not on the Games tab, whose cards show who
  // you've got (the user, 2026-11-18: keep the vertical real estate in check).
  const faces = s.night && s.night.groups.length <= 3 && tab !== "games" ? s.night.groups : null;
  return (
    <section className={`px-3 pt-3 ${settled ? "nd-settle" : ""}`} data-strip={s.tone} data-strip-settled={settled || undefined}>
      <button
        type="button"
        onClick={go}
        aria-label={faces ? nightLabel(s.tag, s.title, faces, s.line) : undefined}
        className={`nd-press flex min-h-[58px] w-full items-stretch overflow-hidden rounded-[3px] text-left ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`}
      >
        <StripTag s={s} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2 pl-5 pr-1">
          <b data-strip-title className="text-[16px] font-bold leading-tight">
            {s.title}
          </b>
          {s.line && <small className={`text-[14px] leading-tight ${due ? "text-plate-muted" : "text-muted-foreground"}`}>{s.line}</small>}
          {faces && <NightFaces groups={faces} plate={due} locks={s.tone !== "locked"} />}
        </span>
        <span className="grid flex-none place-items-center px-2.5">
          <ChevronRight className={`size-5 ${due ? "" : "text-muted-foreground"}`} aria-hidden />
        </span>
      </button>
    </section>
  );
}

/** The strip's angled tag: the episode, with a tick when it's all set and a padlock when it's locked. */
function StripTag({ s }: { s: StripState }) {
  const due = s.tone === "due";
  return (
    <span
      className={`nd-settle-tag type-caption -mr-[13px] flex flex-none items-center gap-1.5 whitespace-nowrap py-0 pl-[11px] pr-[22px] text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${
        due ? "bg-chyron text-chyron-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {s.tone === "set" ? (
        <Check className="nd-settle-tick size-4" strokeWidth={3} aria-hidden />
      ) : s.tone === "locked" ? (
        <Lock className="size-4" aria-hidden />
      ) : s.tone === "soon" ? (
        <Hourglass className="size-4" strokeWidth={2.5} aria-hidden />
      ) : null}
      {s.tag}
    </span>
  );
}

// ---------- Episode night: the faces row and Tonight's plate (strip-night.ts) ----------

const TILE = "h-[34px] w-[26px] flex-none rounded-[2px]";

/** One game's people for the night: its dot (always: the game, by its colour, deepened on the white plate), the faces as cast tiles
 *  (the lineup sheet's shape, small), an empty place dashed, and a padlock after a group that's locked while the rest isn't (`locks`).
 *  Locked faces read frozen (grey, dimmed): never confused with the live ones. `max`: tiles to draw, the empty places first. */
function NightGroupTiles({ g, plate, max = Infinity, locks = true }: { g: NightGroup; plate: boolean; max?: number; locks?: boolean }) {
  const gaps = Math.min(g.open, max);
  const faces = g.faces.slice(0, Math.max(0, max - gaps));
  return (
    <span data-night-group={g.kind} data-locked={g.locked || undefined} className="flex flex-none items-center gap-[3px]">
      <span className="grid w-3 flex-none place-items-start" aria-hidden>
        <i className="size-2 rounded-full" style={{ background: dotColour(g, plate) }} />
      </span>
      {faces.map((f) => (
        <Face key={f.id} src={f.photo} name={f.name} className={`${TILE} text-[13px] ${g.locked ? "opacity-70 grayscale" : ""}`} />
      ))}
      {Array.from({ length: gaps }, (_, i) => (
        <span
          key={i}
          data-night-open
          className={`grid ${TILE} place-items-center outline-dashed outline-[1.5px] -outline-offset-[1.5px] ${plate ? "text-plate-muted outline-plate-muted" : "text-muted-foreground outline-edge"}`}
        >
          <Plus className="size-3.5" aria-hidden />
        </span>
      ))}
      {locks && g.locked && <Lock className={`ml-0.5 size-3 flex-none ${plate ? "text-plate-muted" : "text-muted-foreground"}`} aria-hidden />}
    </span>
  );
}

/** The faces row: every game's people for the night, in order, never wrapping. Room for about six tiles beside the dots: past it, each
 *  group keeps its empty places and gives up faces from its end, and "+N" counts the faces not drawn (never a gap: the check). */
function NightFaces({ groups, plate, locks = true }: { groups: NightGroup[]; plate: boolean; locks?: boolean }) {
  const room = Math.max(3, 7 - groups.length);
  const total = groups.reduce((a, g) => a + g.faces.length + g.open, 0);
  const shown: { g: NightGroup; max: number }[] = [];
  let left = total > room ? room - 1 : Infinity;
  for (const g of groups) {
    const take = Math.min(g.faces.length + g.open, Math.max(g.open, left));
    left = Math.max(0, left - take);
    shown.push({ g, max: take });
  }
  const more = total - shown.reduce((a, x) => a + Math.min(x.max, x.g.faces.length + x.g.open), 0);
  return (
    <span data-night-faces aria-hidden className="mt-1 flex min-w-0 items-center gap-2.5 overflow-hidden">
      {shown.map(({ g, max }) => (
        <NightGroupTiles key={g.key} g={g} plate={plate} max={max} locks={locks} />
      ))}
      {more > 0 && <span className={`type-num flex-none text-[14px] font-bold ${plate ? "text-plate-muted" : "text-muted-foreground"}`}>+{more}</span>}
    </span>
  );
}

const first_ = first;
const names = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A row's verb, the Games tab's for the same move (your-move.ts): Set a lineup, Pick, Edit what's in, Claim a replacement. */
const verbOf = (g: NightGroup) => (g.locked ? "Locked" : g.kind === "replace" ? "Claim" : g.due || g.open ? (g.kind === "pick" ? "Pick" : "Set") : "Edit");

/** Something of yours here still to set. */
const unsetIn = (g: NightGroup) => !g.locked && (g.due || g.open > 0);

/** What's still to set, in words, for Lock in's ask: "Pool Party · no pick", "Lineup League · 1 open slot". */
const unsetWords = (g: NightGroup) =>
  `${g.name} · ${g.kind === "replace" ? `nobody in for ${g.left ?? "who left"}` : g.kind === "pick" ? "no pick" : g.open ? `${g.open} open ${g.open === 1 ? "slot" : "slots"}` : "not set for this episode"}`;

/** The plate's rows under its head, at most: past them the rest fold into one row (the user, 2026-11-18: "keep the vertical real
 *  estate in check... who's to know how many games could be going on"). Three games show three rows, as before; seven show two and
 *  the fold. */
const PLATE_ROWS = 3;

/** One game's row on the plate: its name, its people, the move in words, its verb; the way into that game's move. */
function NightRow({ g, plate, onGo }: { g: NightGroup; plate: boolean; onGo: (g: NightGroup) => void }) {
  const muted = plate ? "text-plate-muted" : "text-muted-foreground";
  const who = g.faces.map((f) => first_(f.name)).filter(Boolean);
  // A big lineup (a sport's nine) is counted, not named: its faces show four, the rest a "+N".
  const big = g.faces.length + g.open > 4;
  const words =
    g.kind === "replace"
      ? `${g.left ?? "Someone"} left · pick who comes in`
      : big
        ? [`${g.faces.length} starting`, g.open ? `${g.open} open` : null].filter(Boolean).join(" · ")
        : [who.length ? names(who) : g.kind === "pick" ? "No pick yet" : "Nobody yet", g.kind === "lineup" && g.open ? `${g.open} open` : null].filter(Boolean).join(" · ");
  return (
    <button type="button" data-plate-row={g.kind} onClick={() => onGo(g)} className={`nd-press block min-h-[60px] w-full border-t px-3 py-2 text-left ${plate ? "border-plate-foreground/10" : "border-border"}`}>
      <span className={`type-caption block truncate text-[13px] tracking-[0.05em] ${muted}`}>{g.name}</span>
      <span className="mt-1 flex items-center gap-2.5">
        <NightGroupTiles g={g} plate={plate} max={4} />
        {big && <span className={`type-num -ml-1 flex-none text-[14px] font-bold ${muted}`}>+{g.faces.length + g.open - 4}</span>}
        {/* Never cut: a long line of names takes a second line (the alert strip's rule: grow, don't truncate). */}
        <span className="min-w-0 flex-1 text-pretty text-[15px] font-semibold leading-snug">{words}</span>
        <span className={`flex flex-none items-center gap-0.5 text-[14px] font-bold ${g.locked ? muted : ""}`}>
          {verbOf(g)}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </span>
    </button>
  );
}

/**
 * Tonight's plate in the window (look C, the user's pick, 2026-11-18): the strip's tag, "Before you watch" and what's left, and Lock
 * in on the right ("I made my picks, I'm about to watch"); then a row a game, its people and its verb, each the way into that game's
 * move: the ones that need you first, and never more than three rows (PLATE_ROWS). Past three, the rest fold into one row, a face a
 * game and what they need ("All set", "2 to set"), opened in place. Locking in locks every game's moves for the episode (the
 * server's lock: strip-night.ts useLockIn) and the plate gives way to the one-line locked strip, so it's tall only while you've
 * something to decide. Every other tab shows the one-line strip.
 */
function NightPlate({ s, settled, seasonId }: { s: StripState; settled: boolean; seasonId: string }) {
  const nav = useNav();
  const lock = useLockIn(seasonId);
  const [ask, setAsk] = useState(false);
  const [more, setMore] = useState(false);
  const due = s.tone === "due";
  const muted = due ? "text-plate-muted" : "text-muted-foreground";
  const line = due ? "border-plate-foreground/10" : "border-border";
  const n = s.night!.episode;
  // The ones that need you first (a stable sort keeps the rest in the games' order).
  const groups = [...s.night!.groups].sort((a, b) => Number(unsetIn(b)) - Number(unsetIn(a)));
  const unset = groups.filter(unsetIn);
  const folds = groups.length > PLATE_ROWS;
  const shown = folds ? groups.slice(0, PLATE_ROWS - 1) : groups;
  const rest = folds ? groups.slice(PLATE_ROWS - 1) : [];
  const restUnset = rest.filter(unsetIn).length;
  const restGames = new Set(rest.map((g) => g.leagueId)).size;
  // Four faces fit beside the words; past them, three and a count.
  const restTiles = rest.length > 4 ? rest.slice(0, 3) : rest;
  const go = (g: NightGroup) => (g.kind === "replace" ? nav.push(`${paths.showPage(seasonId, "waivers")}?game=${g.leagueId}`) : openMoves(g.tab, g.leagueId));
  const lockIn = () => {
    setAsk(false);
    void lock(n, `Locked in for Episode ${n}. ${s.night!.onAir ? "Enjoy the episode." : "Results when they're in."}`);
  };
  return (
    <section className={`px-3 pt-3 ${settled ? "nd-settle" : ""}`} data-strip={s.tone} data-night-plate data-night-games={groups.length}>
      <div className={`overflow-hidden rounded-[3px] ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`}>
        <div className="flex min-h-[60px] items-stretch">
          <StripTag s={s} />
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pl-5 pr-2">
            <b className="type-caption text-[19px] leading-none tracking-[0.01em]">Before you watch</b>
            <small className={`text-[13px] leading-tight ${muted}`}>{unset.length ? `${unset.length} to set` : "All set"}</small>
          </span>
          {/* "I made my picks, I'm about to watch" (the user): the honour system as one deliberate tap, where the moves are. */}
          <span className="flex flex-none items-center pr-2.5">
            <button
              type="button"
              data-lock-in={n}
              onClick={() => (unset.length ? setAsk(true) : lockIn())}
              className={`nd-press flex h-11 items-center gap-1.5 rounded-[4px] px-3 text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] ${
                due ? "text-plate-foreground outline-plate-foreground/50" : "text-foreground outline-foreground/60"
              }`}
            >
              <Lock className="size-4" aria-hidden />
              Lock in
            </button>
          </span>
        </div>
        {shown.map((g) => (
          <NightRow key={g.key} g={g} plate={due} onGo={go} />
        ))}
        {folds && !more && (
          // The rest, folded: a face a game (an empty place where one's missing), what they need, and the way to open them here.
          <button type="button" data-night-fold={rest.length} aria-expanded={false} onClick={() => setMore(true)} className={`nd-press block min-h-[60px] w-full border-t px-3 py-2 text-left ${line}`}>
            <span className={`type-caption block truncate text-[13px] tracking-[0.05em] ${muted}`}>{restGames} more {restGames === 1 ? "game" : "games"}</span>
            <span className="mt-1 flex items-center gap-2.5">
              <span className="flex flex-none items-center gap-2">
                {restTiles.map((g) => (
                  <NightGroupTiles key={g.key} g={g} plate={due} max={1} locks={false} />
                ))}
                {rest.length > restTiles.length && <span className={`type-num text-[14px] font-bold ${muted}`}>+{rest.length - restTiles.length}</span>}
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{restUnset ? `${restUnset} to set` : "All set"}</span>
              <span className="flex flex-none items-center gap-0.5 text-[14px] font-bold">
                Show
                <ChevronDown className="size-4" aria-hidden />
              </span>
            </span>
          </button>
        )}
        {folds && more && (
          <>
            {rest.map((g) => (
              <NightRow key={g.key} g={g} plate={due} onGo={go} />
            ))}
            <button type="button" data-night-fold-less onClick={() => setMore(false)} className={`nd-press flex min-h-11 w-full items-center gap-1 border-t px-3 text-[14px] font-semibold ${line} ${muted}`}>
              Show less
              <ChevronDown className="size-4 rotate-180" aria-hidden />
            </button>
          </>
        )}
      </div>
      <Sheet open={ask} onOpenChange={setAsk} title={`Lock in ${s.tag}?`} subtitle={`${unset.length} not set yet`}>
        <div data-lock-in-ask={n} className="flex flex-col gap-3 pb-1">
          <p className="text-[15px] leading-snug">Your moves lock as they are, in every game. Still not set:</p>
          <ul className="flex flex-col gap-1.5">
            {unset.map((g) => (
              <li key={g.key} className="flex items-center gap-2 text-[15px] font-semibold">
                <i className="size-2 flex-none rounded-full" style={{ background: g.colour }} aria-hidden />
                {unsetWords(g)}
              </li>
            ))}
          </ul>
          <Btn tone="must" wide className="mt-1" data-lock-in-first onClick={() => (setAsk(false), unset[0] && go(unset[0]))}>
            Set {unset.length === 1 ? "it" : "them"} first
          </Btn>
          <Btn wide data-lock-in-anyway onClick={lockIn}>
            Lock in anyway
          </Btn>
        </div>
      </Sheet>
    </section>
  );
}

/**
 * Episode night (strip-night.ts): Watch along is watching. Started while your moves for the episode on air are still open, it says
 * first that it locks them, with who you've got: Start watching (locks them, the server's lock, then watch along) or Change my moves
 * first (Your moves).
 */
export function WatchLockSheet({ show, n, open, onOpenChange, onStart, onChange }: { show: ShowData; n: number; open: boolean; onOpenChange: (o: boolean) => void; onStart: () => void; onChange: () => void }) {
  const groups = stripState(show)?.night?.groups ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Start watching ${show.words.ep} ${n}?`} subtitle="Watching along locks your moves for it">
      <div data-watch-lock={n} className="flex flex-col gap-3 pb-1">
        <p className="text-[15px] leading-snug">Your {show.words.episode} {n} moves lock in as you start, in every game:</p>
        <NightFaces groups={groups} plate={false} />
        <Btn tone="must" wide className="mt-1" data-watch-lock-start onClick={onStart}>
          Start watching
        </Btn>
        <Btn wide data-watch-lock-change onClick={onChange}>
          Change my moves first
        </Btn>
      </div>
    </Sheet>
  );
}
