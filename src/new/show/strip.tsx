"use client";

import { Check, ChevronRight, Lock } from "lucide-react";
import { airTime } from "../clock";
import { useNav } from "../nav";
import type { ShowData } from "../screens/show-space";
import { openCall } from "./calls";
import { doneCards, isRequired, moveCard, openMoves, tabOf } from "./moves";
import { openSheet } from "./questions";
import { hasPacePlate } from "./pace-plate";
import { showLabel } from "./react";

// The strip (the design round's step 3: docs/design-round/step3-tonight-spec.md, "Two parts every show tab shares"; Phase 0's
// decision 2): the show's one statement of what's yours to set, under the show bar in the same place on every tab but Chat. It
// replaces the dock and Tonight's carousel of move cards. Due: DESIGN.md's alert strip, a chyron tag and a white plate (the view's
// one yellow). All set, locked, or waiting on a reveal: the same shape on a night panel, no yellow. Nothing to set: no strip.
// A game with its own-pace plate (catching up, drafting at your pace: pace-plate.tsx hasPacePlate) says its move there, so it
// isn't counted here.

export interface StripState {
  tone: "due" | "waits" | "set" | "locked";
  /** The episode it's for: "Ep 6". */
  tag: string;
  title: string;
  line: string | null;
}

/** What the strip says, or null for no strip. Pure: the show as Tonight reads it. */
export function stripState(show: ShowData): StripState | null {
  if (show.readOnly || !show.games.some((g) => g.yourRole)) return null;
  const up = show.upNext;
  const ep = show.words.ep;
  const paced = new Set((show.play ?? []).filter(hasPacePlate).map((g) => g.leagueId));
  const open = show.moves.filter((m) => isRequired(m) && !paced.has(m.leagueId));
  const n = open[0]?.episode ?? up?.number ?? null;
  const tag = n != null ? `${ep} ${n}` : "Your move";
  if (up?.live) return { tone: "locked", tag: `${ep} ${up.number}`, title: `Locked for ${ep} ${up.number}`, line: "Scores stay hidden until you reveal" };
  if (open.length) {
    const titles = [...new Set(open.map((m) => moveCard(m, show.header?.seasonId ?? "", false, false, show.words.episode).title))];
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
    return { tone: "due", tag, title, line };
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
  if (!s) return null;
  const seasonId = show.header?.seasonId ?? "";
  const go = () => {
    const open = show.moves.filter(isRequired);
    const lead = open[0];
    const href = lead ? (moveCard(lead, seasonId, false).href ?? null) : null;
    if (s.tone === "due" && href) return nav.push(href);
    if (s.tone === "due" && lead?.kind === "calls" && show.header) return openCall({ seasonId, couchId: show.couch?.id ?? null, episode: lead.episode ?? show.upNext?.number ?? 1, label: showLabel(show), solo: show.solo });
    if (s.tone === "due" && lead?.kind === "questions" && show.header) return openSheet({ seasonId, leagueId: lead.leagueId, episode: null, game: lead.leagueName });
    openMoves(tabOf(lead), lead?.leagueId ?? null);
  };
  const due = s.tone === "due";
  return (
    <section className="px-3 pt-3" data-strip={s.tone}>
      <button
        type="button"
        onClick={go}
        className={`nd-press flex min-h-[58px] w-full items-stretch overflow-hidden rounded-[3px] text-left ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`}
      >
        <span
          className={`type-caption -mr-[13px] flex flex-none items-center gap-1.5 whitespace-nowrap py-0 pl-[11px] pr-[22px] text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${
            due ? "bg-chyron text-chyron-foreground" : "bg-secondary text-foreground"
          }`}
        >
          {s.tone === "set" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : s.tone === "locked" ? <Lock className="size-4" aria-hidden /> : null}
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
