"use client";

import { useSyncExternalStore } from "react";
import { Eye } from "lucide-react";
import { useProfile } from "../data";

// Sports scores too (docs/PLAN-start-a-game-gpt.md, "Sports spoilers: Hide scores" and the user's calls of 2026-11-09): with it
// on, a game that has begun says only when it started (never live or final, its clock, period, overtime, score, winner or a team's
// record) until that person taps its Show the score, which shows that one game everywhere for the visit (this tab's session).
// Every sports screen goes through `useGameScore`; nothing draws a score, a result or a record without it. The tap also tells the
// server (POST /api/sports/shown), so a season you follow with that game moves its mark and its results come in.

const KEY = "gys-shown-scores";
const listeners = new Set<() => void>();
let shown: Set<string> | null = null;

function read(): Set<string> {
  if (shown) return shown;
  try {
    shown = new Set(JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    shown = new Set();
  }
  return shown;
}

/** Show this game's score for the visit (and tell the server, for the seasons you follow with it). */
export function showScore(id: string, league?: string) {
  const s = new Set(read());
  s.add(id);
  shown = s;
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* private mode: kept in memory for the visit */
  }
  listeners.forEach((l) => l());
  if (league) void fetch("/api/sports/shown", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ league, event: id }) }).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const NONE = new Set<string>();

/** Whether you hide sports scores (Settings' Sports scores too; off by default). */
export function useHideSports(): boolean {
  return !!useProfile().data?.hideSportsScores;
}

/** The games shown this visit. */
export function useShownScores(): Set<string> {
  return useSyncExternalStore(subscribe, read, () => NONE);
}

export { begun, clockOf, dayOf, gameWords, type GameMoment } from "@/lib/sports/hide";
import { gameWords, type GameMoment } from "@/lib/sports/hide";

/** A game's words for you, with its Show the score. */
export function useGameScore(g: GameMoment | null) {
  const hidden = useHideSports();
  const shownSet = useShownScores();
  if (!g) return { open: true, started: false, when: "", hidden };
  return { ...gameWords(g, hidden, shownSet.has(g.id)), hidden };
}

/** Show the score: the one button that lets a hidden game's score out, for the visit. */
export function ShowScore({ id, league, className = "" }: { id: string; league?: string; className?: string }) {
  return (
    <button
      type="button"
      data-show-score={id}
      onClick={(e) => {
        e.stopPropagation();
        showScore(id, league);
      }}
      className={`nd-press inline-flex h-11 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-semibold outline-1 -outline-offset-1 outline-edge ${className}`}
    >
      <Eye className="size-4" aria-hidden /> Show the score
    </button>
  );
}
