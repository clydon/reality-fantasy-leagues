// Own pace for a sports game (docs/PLAN-sports-ready.md step 2.6; BACKLOG 218). The user's rule (2026-11-19): a team sport's seat at
// its own pace is never more than one game behind. "Someone watching the Patriots game won't still want to watch last week's game
// after this week's game is starting." When a game's next one starts, the one before counts as watched: the seat's mark moves on by
// itself (GhostLogic.keepPace), as Keep up's automatic mark does for a follow (keep-up.ts advanceAuto).
//   game  the episode before the latest one started (football, basketball, hockey, soccer: a sport's defaults' `pace.by`).
//   day   baseball's (the user, 2026-11-20: doubleheaders): the episodes before count as watched once a game on a later day starts,
//         so a doubleheader's first game isn't marked watched at the second's first pitch. Days are Eastern, as the locks' are.
// A sport with no `pace` (golf, racing, MMA, tennis: individual sports, which the user doesn't follow) stays plain own pace.
// Pure: the server reads the starts (air-times.ts stampSportLocks) and stamps the floor on the state (state.paceFloor, never saved).
import * as Air from "@/lib/game/air-schedule.js";
import { LOCK_ZONE } from "./locks";

export type PaceBy = "game" | "day";

/**
 * The last episode a seat at its own pace has watched by `now` (ms) at the latest, from each episode's games' starts ({ episode, at };
 * a game called off has none, and is left out), or null while nothing has started. Its own first start is an episode's.
 */
export function paceFloor(starts: { episode: number; at: string | null }[], now: number, by: PaceBy, zone = LOCK_ZONE): number | null {
  const first = new Map<number, number>();
  for (const s of starts) {
    const t = s.at ? Date.parse(s.at) : NaN;
    if (!Number.isInteger(s.episode) || Number.isNaN(t)) continue;
    if (!first.has(s.episode) || t < first.get(s.episode)!) first.set(s.episode, t);
  }
  const begun = [...first].filter(([, t]) => t <= now);
  if (!begun.length) return null;
  const latest = Math.max(...begun.map(([n]) => n));
  if (by === "game") return latest - 1;
  // By the day: the episode before the first of those begun on the latest one's day (a doubleheader's two are one day's).
  const day = Air.localDate(new Date(first.get(latest)!), zone);
  const sameDay = begun.filter(([n, t]) => n <= latest && Air.localDate(new Date(t), zone) === day).map(([n]) => n);
  return Math.min(...sameDay) - 1;
}
