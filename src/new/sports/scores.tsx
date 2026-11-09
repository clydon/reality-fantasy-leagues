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

export interface GameMoment {
  id: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  called?: string | null;
}

/** Whether a game has begun (by the provider, or by the clock). */
export const begun = (g: Pick<GameMoment, "state" | "at">, now = Date.now()) => g.state !== "pre" || (!!g.at && Date.parse(g.at) <= now);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8:20 PM", in the phone's time. */
export function clockOf(at: string): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", "Sun", or "Sun, Nov 16" past a week. */
export function dayOf(at: string, now = Date.now()): string {
  const d = new Date(at);
  const midnight = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((midnight(d.getTime()) - midnight(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return DAYS[d.getDay()];
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * How a game may be told to you: `open` when its score and state may show (sports live, or Show the score tapped this visit), and
 * `when`, the line it says either way: before it starts its day and time; once begun and hidden only "Started 8:20 PM" (or with
 * its day when it wasn't today), never live or final; open, "On now" or "Final" (a game called off says so: it wasn't played).
 */
export function gameWords(g: GameMoment, hidden: boolean, shownNow: boolean, now = Date.now()): { open: boolean; started: boolean; when: string } {
  const started = begun(g, now);
  const at = g.at ? `${dayOf(g.at, now) === "Today" ? "" : `${dayOf(g.at, now)} `}${clockOf(g.at)}` : "Time to be set";
  if (!started) return { open: true, started, when: g.at ? `${dayOf(g.at, now)} ${clockOf(g.at)}` : "Time to be set" };
  // A game called off was never played: saying so gives nothing away.
  if (g.called && g.called !== "suspended") return { open: true, started, when: g.called === "canceled" ? "Canceled" : "Postponed" };
  const open = !hidden || shownNow;
  if (!open) return { open, started, when: `Started ${at}` };
  return { open, started, when: g.state === "post" || g.final ? "Final" : "On now" };
}

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
