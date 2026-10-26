"use client";

import { useSyncExternalStore } from "react";
import { airTime } from "../clock";
import type { CastFace, GameView, Move } from "../data";
import { paths } from "../routes";

// Your moves on a show (docs/PLAN-new-design.md step 1; the mock's refine.js Tonight cards and dock.js): the moves
// due in this show's games, as the home lists them (/api/me/home: actionItems, the classic action bar's), turned
// into Tonight's cards, the dock's one line and the "Your moves" sheet's tabs; and what you've already set this
// episode (your games, game-view.ts) as done cards. Required moves are cards; a prediction is an extra (optional,
// no counts).

export type MovesTab = "lineup" | "pool" | "predict" | "outlast";

/** Moves that are cards on Tonight, in the order a tie goes ("calls": Weekly Calls' two calls on the next show, step 12 part 2). */
const REQUIRED = ["lineup", "pickup", "pick", "calls", "draftTurn", "blindDraft"];
export const isRequired = (m: Move) => REQUIRED.includes(m.kind);

/** "Set your episode 5 lineup (2 empty slots)" → 2. */
const slotsOf = (m: Move) => Number(/\((\d+) empty slot/.exec(m.text)?.[1] ?? 1);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface MoveCard {
  key: string;
  title: string;
  line: string;
  action: string;
  /** Opens the moves sheet at this tab (of this game's), or goes to `href` (waivers, the drafts), or opens Call it for this
   *  episode (Weekly Calls). */
  tab?: MovesTab;
  leagueId?: string;
  href?: string;
  call?: number;
  /** Opens the bingo card for this episode (Weekly Bingo, step 12 part 3). */
  bingo?: number;
}

/** A required move as Tonight's card. `twin`: another move of the same kind is due here (two leagues), so name it. */
export function moveCard(m: Move, seasonId: string, twin: boolean): MoveCard {
  const when = m.deadline ? airTime(Date.parse(m.deadline)) : null;
  const which = twin ? ` · ${m.leagueName}` : "";
  const key = `${m.kind}-${m.leagueId}`;
  switch (m.kind) {
    case "lineup":
      return { key, title: "Set your lineup", line: `${plural(slotsOf(m), "open slot")}${when ? ` · locks ${when}` : ""}${which}`, action: "Set lineup", tab: "lineup", leagueId: m.leagueId };
    case "pick":
      return { key, title: "Pick who survives", line: `Picks close at airtime${when ? ` · ${when}` : ""}${which}`, action: "Make my pick", tab: "pool", leagueId: m.leagueId };
    case "pickup":
      return { key, title: m.text, line: `${when ? `Due ${when} · ` : ""}you pick who comes in${which}`, action: "Pick who comes in", href: paths.showPage(seasonId, "waivers") };
    case "draftTurn":
      return { key, title: "Your turn to draft", line: m.leagueName, action: "Draft", href: `${paths.showPage(seasonId, "draft")}?game=${m.leagueId}` };
    case "blindDraft":
      return { key, title: "Lock in your draft picks", line: `Pick in private, reveal together${which}`, action: "Pick my team", href: `${paths.showPage(seasonId, "blind")}?game=${m.leagueId}` };
    case "calls":
      return { key, title: m.text, line: `Weekly Calls · closes at airtime${when ? ` · ${when}` : ""}${which}`, action: "Call it", call: m.episode ?? undefined, leagueId: m.leagueId };
    default:
      return { key, title: m.text, line: m.leagueName, action: "Open", tab: "lineup" };
  }
}

/** First names: "Kristin". */
export const first = (name: string) => name.split(" ")[0];

/** A castaway of this game's, by id. */
export const faceIn = (g: GameView, id: string): CastFace | undefined => g.cast.find((c) => c.id === id);

/**
 * What you've already set for the next episode, as done cards (each with Change): a lineup that's in, a pick
 * that's made. Only while they can still change. `twin`: two games of a kind here, so each says which.
 */
export function doneCards(play: GameView[]): MoveCard[] {
  const twin = (g: GameView) => play.filter((x) => x.gameType === g.gameType).length > 1;
  const cards: MoveCard[] = [];
  for (const g of play) {
    if (g.revealFirst) continue;
    const which = twin(g) ? ` · ${g.name}` : "";
    const l = g.lineup;
    if (l && !l.locked && l.set && l.starters.length) {
      const names = l.starters.map((id) => first(faceIn(g, id)?.name ?? "")).filter(Boolean);
      const until = l.airsAt ? ` · change until ${airTime(Date.parse(l.airsAt))}` : "";
      cards.push({ key: `lineup-done-${g.leagueId}`, title: "Your lineup is in", line: `${names.join(", ")}${until}${which}`, action: "Change", tab: "lineup", leagueId: g.leagueId });
    }
    const c = g.call;
    if (g.gameType === "weekly-calls" && c && c.open && c.of > 0 && c.made === c.of) {
      const until = c.airsAt ? ` · change until ${airTime(Date.parse(c.airsAt))}` : "";
      cards.push({ key: `calls-done-${g.leagueId}`, title: "Your calls are in", line: `Weekly Calls${until}${which}`, action: "Change", call: c.episode, leagueId: g.leagueId });
    }
    // Weekly Bingo has nothing to set before a show: its card is ready (the mock's rbGameJob), and ticks open at airtime.
    const b = g.bingo;
    if (g.gameType === "weekly-bingo" && b) {
      const line = b.open
        ? `${b.ticked ? `${b.ticked} ticked${b.lines ? ` · ${b.lines} ${b.lines === 1 ? "line" : "lines"}` : ""}` : "Tap squares as it happens"}${which}`
        : `Opens ${b.airsAt ? airTime(Date.parse(b.airsAt)) : "at airtime"} · tap squares as it happens${which}`;
      cards.push({ key: `bingo-${g.leagueId}`, title: `Your card for Episode ${b.episode}`, line, action: "Open my card", bingo: b.episode, leagueId: g.leagueId });
    }
    const p = g.pick;
    if (p && p.open && p.pick) {
      cards.push({
        key: `pick-done-${g.leagueId}`,
        title: `Survival Pool: ${first(faceIn(g, p.pick)?.name ?? "your pick")}`,
        line: `${p.streak ? `Streak ${p.streak} on the line` : "Your first right pick starts a streak"}${which}`,
        action: "Change",
        tab: "pool",
        leagueId: g.leagueId,
      });
    }
  }
  return cards;
}

export interface SheetTab {
  key: string;
  kind: MovesTab;
  label: string;
  /** The game it's for; null for Predictions, which gathers every game's. */
  leagueId: string | null;
}

/** The sheet's tabs: the games you play here (by name, or by league when two share a game), then Predictions. */
export function sheetTabs(play: GameView[]): SheetTab[] {
  const tab = (g: GameView, kind: MovesTab): SheetTab => ({
    key: `${kind}:${g.leagueId}`,
    kind,
    leagueId: g.leagueId,
    label: play.filter((x) => x.gameType === g.gameType).length > 1 ? g.name : g.gameName,
  });
  return [
    ...play.filter((g) => g.gameType === "active-roster").map((g) => tab(g, "lineup")),
    ...play.filter((g) => g.gameType === "pickem").map((g) => tab(g, "pool")),
    ...(play.some((g) => g.predictions.length) ? [{ key: "predict", kind: "predict" as const, label: "Predictions", leagueId: null }] : []),
    // Weekly Calls' calls are Call it's sheet (calls.tsx), Weekly Bingo's cards the bingo sheet (bingo.tsx): neither is a tab here.
    ...play.filter((g) => !["active-roster", "pickem", "weekly-calls", "weekly-bingo"].includes(g.gameType)).map((g) => tab(g, "outlast")),
  ];
}

/** The dock's one line: "1 open slot · no pick · 2 calls". */
export function dockWords(moves: Move[]): string {
  const words = moves.map((m) => {
    if (m.kind === "lineup") return plural(slotsOf(m), "open slot");
    if (m.kind === "pick") return "no pick";
    if (m.kind === "prediction") return plural(Number(/^(\d+) predictions/.exec(m.text)?.[1] ?? 1), "prediction");
    if (m.kind === "calls") return "your calls";
    if (m.kind === "pickup") return m.text.charAt(0).toLowerCase() + m.text.slice(1);
    if (m.kind === "draftTurn") return "your draft turn";
    if (m.kind === "blindDraft") return "draft picks";
    return m.text.charAt(0).toLowerCase() + m.text.slice(1);
  });
  const line = [...new Set(words)].join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** Which tab of the sheet a move opens. */
export function tabOf(m: Move | undefined): MovesTab {
  if (m?.kind === "pick") return "pool";
  if (m?.kind === "prediction") return "predict";
  return "lineup";
}

// ---- the sheet: one per show, opened from Tonight's cards, its Extras and the dock ----

let sheet: { open: boolean; tab: MovesTab; leagueId: string | null } = { open: false, tab: "lineup", leagueId: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Opens Your moves at a tab: that game's, when `leagueId` says which. */
export function openMoves(tab: MovesTab, leagueId: string | null = null) {
  sheet = { open: true, tab, leagueId };
  emit();
}

export function closeMoves() {
  sheet = { ...sheet, open: false };
  emit();
}

const CLOSED = { open: false, tab: "lineup" as MovesTab, leagueId: null };

export function useMovesSheet() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sheet,
    () => CLOSED
  );
}
