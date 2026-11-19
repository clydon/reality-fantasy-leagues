"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Hourglass, Lock } from "lucide-react";
import { airTime } from "../clock";
import { useNav } from "../nav";
import { paths } from "../routes";
import { draftRoomPage, draftSoonWords, draftWhen } from "./draft-words";
import type { ShowData } from "../screens/show-space";
import { openCall } from "./calls";
import { doneCards, isRequired, moveCard, openMoves, tabOf, type MovesTab } from "./moves";
import { openSheet } from "./questions";
import { catchingUpIn, hasPacePlate, movedIn } from "./pace-plate";
import { showLabel } from "./react";

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
  if (up?.live) return { tone: "locked", tag: `${ep} ${up.number}`, title: `Locked for ${ep} ${up.number}`, line: "Scores stay hidden until you reveal" };
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

export function MovesStrip({ show }: { show: ShowData }) {
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
  return (
    <section className={`px-3 pt-3 ${settled ? "nd-settle" : ""}`} data-strip={s.tone} data-strip-settled={settled || undefined}>
      <button
        type="button"
        onClick={go}
        className={`nd-press flex min-h-[58px] w-full items-stretch overflow-hidden rounded-[3px] text-left ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`}
      >
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
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2 pl-5 pr-1">
          <b data-strip-title className="text-[16px] font-bold leading-tight">
            {s.title}
          </b>
          {s.line && <small className={`text-[14px] leading-tight ${due ? "text-plate-muted" : "text-muted-foreground"}`}>{s.line}</small>}
        </span>
        <span className="grid flex-none place-items-center px-2.5">
          <ChevronRight className={`size-5 ${due ? "" : "text-muted-foreground"}`} aria-hidden />
        </span>
      </button>
    </section>
  );
}
