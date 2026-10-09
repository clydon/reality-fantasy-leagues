"use client";

import { useSyncExternalStore } from "react";
import type { Castaway, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

// Where one episode stands for THIS viewer (docs/PLAN-ux-redesign.md, 2e): the one status its row in
// the Episodes list shows, and what its own page opens on. Read from the viewer's trimmed state, so
// an episode whose results they haven't revealed carries `resultsHidden` and nothing else.
export type EpisodeStatus =
  /** Results are in; this viewer hasn't revealed them. */
  | { kind: "hidden" }
  /** Results recorded and visible. */
  | { kind: "scored" }
  /** Nothing recorded, and it hasn't aired yet. */
  | { kind: "upcoming"; airsAt: number }
  /** Nothing recorded, and it has aired (or the season has no schedule). */
  | { kind: "waiting" };

export function episodeStatus(ep: Episode, now: number | null): EpisodeStatus {
  if (ep.resultsHidden) return { kind: "hidden" };
  if (StateLogic.episodeHasResults(ep)) return { kind: "scored" };
  const airsAt = ep.airsAt ? Date.parse(ep.airsAt) : NaN;
  if (Number.isFinite(airsAt) && now !== null && airsAt > now) return { kind: "upcoming", airsAt };
  return { kind: "waiting" };
}

/** The earliest episode before `ep` whose results this viewer still hasn't revealed, if any. An
 *  episode after one of those stays shut: its lineups and picks were set knowing who went home. */
export function hiddenBefore(state: LeagueState, ep: Episode): number | null {
  const earlier = state.episodes.filter((e) => e.resultsHidden && e.number < ep.number).map((e) => e.number);
  return earlier.length ? Math.min(...earlier) : null;
}

/** "Wed, Oct 7" from the schedule, else the wiki's own air date text, else nothing. */
export function episodeDate(ep: Episode, withTime = false): string | null {
  if (ep.airsAt) {
    const d = new Date(ep.airsAt);
    return withTime
      ? d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }
  return ep.airDate ?? null;
}

/** "Airs tonight" / "Airs tomorrow" / "Airs in 5 days", by calendar day in the viewer's timezone. */
export function airsInLabel(airsAt: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const days = day(airsAt) - day(now);
  if (days <= 0) return "Airs today";
  if (days === 1) return "Airs tomorrow";
  return `Airs in ${days} days`;
}

/** Who left in this episode, as castaways (unknown ids dropped). */
export function episodeExits(state: LeagueState, ep: Episode) {
  return ep.events
    .map((ev) => ({ ev, c: StateLogic.getCastaway(state, ev.castawayId) }))
    .filter((x): x is { ev: Episode["events"][number]; c: Castaway } => !!x.c);
}

/** "on Sam's team", "on Sam and Josie's rosters" -- who owned someone who left. */
export function ownersLine(state: LeagueState, c: Castaway): string | null {
  const names = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)?.name).filter((n): n is string => !!n);
  if (names.length === 0) return null;
  const noun = StateLogic.getLeagueType(state).hasActiveRoster ? "roster" : "team";
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `on ${who}'s ${noun}${names.length > 1 ? "s" : ""}`;
}

// "Now" to the minute, without reading the clock during render (the linter forbids it, and it would
// differ between renders). Null until the client has a clock, so nothing time-based shows on a server
// render; ticks once a minute so "Airs today" turns over on its own.
const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
};
export function useNowMinute(): number | null {
  const minute = useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  return minute === null ? null : minute * 60_000;
}
