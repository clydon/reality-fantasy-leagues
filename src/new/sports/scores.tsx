"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Eye } from "lucide-react";
import { useProfile, useSportsRecordings } from "../data";

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
  noteSeen(id);
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

// The games you've seen on an earlier visit (docs/PLAN-sports-couch.md A1: a final stays on the hub's scores strip until you've
// seen it): this phone's, kept a few days. A per-phone convenience, so localStorage: lost, a final shows again for its 36 hours.
const SEEN = "gys-seen-games";
const SEEN_KEEP_MS = 4 * 86_400_000;
let seenAtLoad: Set<string> | null = null;

function seenStore(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** You've seen this game's score (shown it, or watched it live on the strip): for this visit, and so a later visit drops its final. */
export function noteSeen(id: string) {
  const s = new Set(read());
  if (!s.has(id)) {
    s.add(id);
    shown = s;
    try {
      sessionStorage.setItem(KEY, JSON.stringify([...s]));
    } catch {
      /* private mode: kept in memory for the visit */
    }
    listeners.forEach((l) => l());
  }
  try {
    const now = Date.now();
    const kept = Object.fromEntries(Object.entries(seenStore()).filter(([, at]) => now - at < SEEN_KEEP_MS));
    if (!kept[id]) localStorage.setItem(SEEN, JSON.stringify({ ...kept, [id]: now }));
  } catch {
    /* storage off: a final shows again next visit, for its 36 hours */
  }
}

/** Whether you saw this game on an earlier visit (seen, and not shown again this one): the strip is done with its final. */
export function seenBefore(id: string): boolean {
  if (typeof window === "undefined") return false;
  seenAtLoad ??= new Set(Object.keys(seenStore()));
  return seenAtLoad.has(id) && !read().has(id);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const NONE = new Set<string>();

/** The clock the sports screens are drawn at, moved on each minute (a game begins while you look). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Whether you hide sports scores (Settings' Sports scores too; off by default). */
export function useHideSports(): boolean {
  return !!useProfile().data?.hideSportsScores;
}

/** Whether Hide sports scores is known yet (the profile read has answered, or failed). Until then a screen can't tell whether to
 *  hide, so it must neither show a result nor count one as seen (a live row's "watching it here is seeing it" would otherwise mark
 *  a hidden game seen in the moment before the setting arrives: the Scores tab's check, 2026-11-22). */
export function useHideSportsKnown(): boolean {
  return useProfile().isFetched;
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
  // A game you're watching as if live (the design round's step 7) says only when it started, everywhere, whatever else is on,
  // until you've watched it.
  const recordings = useSportsRecordings().data?.recordings;
  if (!g) return { open: true, started: false, when: "", hidden, recording: false };
  if (recordings?.some((r) => r.game === g.id)) return { ...gameWords(g, true, false), hidden, recording: true };
  return { ...gameWords(g, hidden, shownSet.has(g.id)), hidden, recording: false };
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
