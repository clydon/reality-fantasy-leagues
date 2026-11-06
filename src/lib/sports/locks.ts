// Lineup locks per sport (docs/PLAN-start-a-game-gpt.md track L, L4 part 1a): when each episode's moves close, from the spec's
// `closes` and the games' own starts (ESPN's: season_events.starts_at, not a TV listing's air time). A sport's cadence is its
// `lock` (Sport.lock: daily for the NBA, NHL and MLB, weekly for football and soccer, each event's own start for golf, racing,
// MMA and tennis), carried into a spec as `closes` (spec.ts specCloses), so a game can say otherwise.
// - start: each episode at its own game's start (today's airtime lock);
// - daily: every episode on a day at that day's first start (lineups set for the day, as DraftKings' slates);
// - weekly: every episode in a week at its first start, a week running Tuesday to Monday (Yahoo's football week: Thursday's
//   game to Monday night's).
// Days and weeks are Eastern time's, as the US leagues' and Yahoo's are. Pure: the server stamps them (air-times.ts), the tests
// read them.
import * as Air from "@/lib/game/air-schedule.js";

export type Closes = "start" | "daily" | "weekly";

/** The zone a day or a week is counted in. */
export const LOCK_ZONE = "America/New_York";
/** The first day of a week (0 Sunday ... 6 Saturday): Tuesday, the day after Monday night's game. */
export const WEEK_FROM = 2;

/** The week a local date ("YYYY-MM-DD") is in, as the date of its first day. */
function weekOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return Air.addDays(date, -((day - WEEK_FROM + 7) % 7));
}

/**
 * Each episode's lock (an ISO instant), from its game's start: its own, its day's first or its week's first. An episode with
 * no start has none (it keeps its air time's lock). A lock is never after the episode's own start.
 */
export function locksOf(starts: { episode: number; at: string | null }[], closes: Closes, zone: string = LOCK_ZONE): Map<number, string> {
  const out = new Map<number, string>();
  const timed = starts.filter((s) => s.at && !Number.isNaN(Date.parse(s.at)));
  if (closes === "start") {
    for (const s of timed) out.set(s.episode, new Date(s.at!).toISOString());
    return out;
  }
  const keyOf = (at: string) => {
    const day = Air.localDate(new Date(at), zone);
    return closes === "daily" ? day : weekOf(day);
  };
  const first = new Map<string, number>();
  for (const s of timed) {
    const k = keyOf(s.at!);
    const t = Date.parse(s.at!);
    if (!first.has(k) || t < first.get(k)!) first.set(k, t);
  }
  for (const s of timed) out.set(s.episode, new Date(first.get(keyOf(s.at!))!).toISOString());
  return out;
}
