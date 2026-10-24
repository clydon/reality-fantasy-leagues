"use client";

import { useSyncExternalStore } from "react";
import { airTime } from "../clock";
import type { Move } from "../data";
import { paths } from "../routes";

// Your moves on a show (docs/PLAN-new-design.md step 1; the mock's refine.js Tonight cards and dock.js): the moves
// due in this show's games, as the home lists them (/api/me/home: actionItems, the classic action bar's), turned
// into Tonight's cards, the dock's one line and the "Your moves" sheet's tabs. Required moves are cards; a
// prediction is an extra (optional, no counts).

export type MovesTab = "lineup" | "pool" | "predict" | "outlast";

/** Moves that are cards on Tonight, in the order a tie goes. */
const REQUIRED = ["lineup", "pickup", "pick", "draftTurn", "blindDraft"];
export const isRequired = (m: Move) => REQUIRED.includes(m.kind);

/** "Set your episode 5 lineup (2 empty slots)" → 2. */
const slotsOf = (m: Move) => Number(/\((\d+) empty slot/.exec(m.text)?.[1] ?? 1);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface MoveCard {
  key: string;
  title: string;
  line: string;
  action: string;
  /** Opens the moves sheet at this tab, or goes to `href` (waivers, the drafts). */
  tab?: MovesTab;
  href?: string;
}

/** A required move as Tonight's card. `twin`: another move of the same kind is due here (two leagues), so name it. */
export function moveCard(m: Move, seasonId: string, twin: boolean): MoveCard {
  const when = m.deadline ? airTime(Date.parse(m.deadline)) : null;
  const which = twin ? ` · ${m.leagueName}` : "";
  const key = `${m.kind}-${m.leagueId}`;
  switch (m.kind) {
    case "lineup":
      return { key, title: "Set your lineup", line: `${plural(slotsOf(m), "open slot")}${when ? ` · locks ${when}` : ""}${which}`, action: "Set lineup", tab: "lineup" };
    case "pick":
      return { key, title: "Pick who survives", line: `Picks close at airtime${when ? ` · ${when}` : ""}${which}`, action: "Make my pick", tab: "pool" };
    case "pickup":
      return { key, title: m.text, line: `${when ? `Due ${when} · ` : ""}you pick who comes in${which}`, action: "Pick who comes in", href: paths.showPage(seasonId, "waivers") };
    case "draftTurn":
      return { key, title: "Your turn to draft", line: m.leagueName, action: "Draft", href: paths.showPage(seasonId, "draft") };
    case "blindDraft":
      return { key, title: "Lock in your draft picks", line: `Pick in private, reveal together${which}`, action: "Pick my team", href: paths.showPage(seasonId, "blind") };
    default:
      return { key, title: m.text, line: m.leagueName, action: "Open", tab: "lineup" };
  }
}

/** The dock's one line: "1 open slot · no pick · 2 calls". */
export function dockWords(moves: Move[]): string {
  const words = moves.map((m) => {
    if (m.kind === "lineup") return plural(slotsOf(m), "open slot");
    if (m.kind === "pick") return "no pick";
    if (m.kind === "prediction") return plural(Number(/^(\d+) predictions/.exec(m.text)?.[1] ?? 1), "call");
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

let sheet: { open: boolean; tab: MovesTab } = { open: false, tab: "lineup" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openMoves(tab: MovesTab) {
  sheet = { open: true, tab };
  emit();
}

export function closeMoves() {
  sheet = { ...sheet, open: false };
  emit();
}

const CLOSED = { open: false, tab: "lineup" as MovesTab };

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
