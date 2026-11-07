// A game's clock for someone (docs/PLAN-start-a-game-gpt.md track L, step L2; the engine's live pieces, A15, use it unchanged):
// where they are in a game, as a moment on the game's own clock. Every fact has a time it became known (a sport's play: ESPN's
// wallclock; a show's: its airing's start plus the runtime), and every game is worked out as of a moment, so the clock is what
// picks the moment: now for someone watching live, their own for a later watch in step with their TV, a fixed one for someone
// looking back (the end, for anyone not watching).
//
// Pure and plain data: a clock is JSON, kept on the phone (and shared only when someone chooses to), and every function takes
// the viewer's real time (`wall`, ms) rather than reading one, so the phone, the server, a 60x replay and the tests agree.
import { msOf, type GameState, type Play, type TeamSport } from "./sport";

/** A moment on a game's own clock, in ms since 1970: for a sport, real time as ESPN stamps its plays (a Play's `at`); for a
 *  show, its airing's start plus the runtime. */
export type Moment = number;

/**
 * Someone's clock in a game:
 * - `live`: now. They see everything known so far.
 * - `synced`: a later watch in step with their TV (the sports plan's decision: start when you press play, pause, 30 s either
 *   way, or tap the last play you saw). At their real time `wall` the game was at `at`; it runs on from there in real time,
 *   or stays there while paused. Never ahead of live.
 * - `snapped`: fixed at a moment, which shows as the last play at or before it (playAt); `at: null` is the end, for anyone not
 *   watching.
 */
export type GameClock =
  | { mode: "live" }
  | { mode: "synced"; at: Moment; wall: number; running: boolean }
  | { mode: "snapped"; at: Moment | null };

export const live = (): GameClock => ({ mode: "live" });

/** Fixed at a moment; `null`: the end (someone not watching sees how it ended). */
export const snapped = (at: Moment | null): GameClock => ({ mode: "snapped", at });

/** The end: the clock for anyone not watching. */
export const ended = (): GameClock => snapped(null);

/** Press play: the game at `from` (its start, or wherever the recording begins) at the viewer's real time `wall`, running. */
export function startAt(from: Moment, wall: number): GameClock {
  return syncedAt(from, wall, true);
}

/**
 * The game's moment on a clock at the viewer's real time `wall`. Live is `wall`; a synced clock is never past it (nobody's
 * ahead of live); the snapped end is Infinity (every play, the final's correction too).
 */
export function momentOf(clock: GameClock, wall: number): Moment {
  if (clock.mode === "live") return wall;
  if (clock.mode === "snapped") return clock.at ?? Infinity;
  return Math.min(clock.running ? clock.at + (wall - clock.wall) : clock.at, wall);
}

/** A synced clock at `at` from `wall` on; caught up with live while running, it's live again. */
function syncedAt(at: Moment, wall: number, running: boolean): GameClock {
  if (running && at >= wall) return live();
  return { mode: "synced", at: Math.min(at, wall), wall, running };
}

/** Pause: the game stays where it is on this clock (pausing live TV leaves you behind it). A snapped clock doesn't move anyway. */
export function pause(clock: GameClock, wall: number): GameClock {
  if (clock.mode === "snapped") return clock;
  return { mode: "synced", at: momentOf(clock, wall), wall, running: false };
}

/** Play: a paused clock runs on from where it stopped, and a snapped one from its moment (the end can't run). */
export function resume(clock: GameClock, wall: number): GameClock {
  if (clock.mode === "live" || (clock.mode === "synced" && clock.running)) return clock;
  if (clock.mode === "snapped" && clock.at == null) return clock;
  return syncedAt(clock.at as Moment, wall, true);
}

/**
 * Nudge by `ms` (the sports plan's 30 s either way). Back from live is a synced clock that far behind (a stream's delay);
 * forward never passes live (a running clock that reaches it is live again).
 */
export function nudge(clock: GameClock, wall: number, ms: number): GameClock {
  if (clock.mode === "snapped") return clock.at == null ? clock : snapped(clock.at + ms);
  if (clock.mode === "live" && ms >= 0) return clock;
  return syncedAt(momentOf(clock, wall) + ms, wall, clock.mode === "live" || clock.running);
}

/**
 * Set the clock to a moment: "tap the last play you saw" sets it to that play's (`playMoment`). A synced clock keeps running
 * or stays paused; any other one runs from there, since they're watching.
 */
export function setTo(clock: GameClock, wall: number, at: Moment): GameClock {
  return syncedAt(at, wall, clock.mode === "synced" ? clock.running : true);
}

/** How far behind live a clock is, in ms (0 live); null for a snapped one. */
export function behind(clock: GameClock, wall: number): number | null {
  if (clock.mode === "snapped") return null;
  return wall - momentOf(clock, wall);
}

/** A play's moment, or null when it has no time (a final with no timed plays). */
export const playMoment = (p: Pick<Play, "at">): Moment | null => msOf(p.at);

/**
 * The last play at or before a moment (a snapped clock's play: where someone is), or null before the first. Plays' times never
 * go back (inOrder), so it's the last of the first so many; a play with no time is only the end's.
 */
export function playAt<P extends Pick<Play, "at">>(plays: P[], at: Moment): P | null {
  let found: P | null = null;
  for (const p of plays) {
    const t = msOf(p.at);
    if (t == null ? at !== Infinity : t > at) break;
    found = p;
  }
  return found;
}

/** The game on someone's clock at their real time `wall`: `sport.reduce` of the plays up to its moment (the end's Infinity:
 *  every play; a clock stored badly, NaN: none), `sides` 0-0 before the first. */
export function stateOn(sport: TeamSport, plays: Play[], clock: GameClock, wall: number, sides: string[] = []): GameState {
  return sport.reduce(plays, momentOf(clock, wall), sides);
}

/* ---- For the engine's live pieces (A15): a question open between two moments, a call stamped with its moment. ---- */

/** A stretch of a game's clock a question is open in: from `opens` up to `closes` (null: from the start; until the end). The
 *  engine resolves a spec's words ("minute 30", "the last 10 minutes", "this at-bat") to moments; the clock only compares. */
export interface GameWindow {
  opens: Moment | null;
  closes: Moment | null;
}

/** Whether a moment is in a window: from its opening, up to but not at its close. */
export function isOpen(w: GameWindow, at: Moment): boolean {
  return (w.opens == null || at >= w.opens) && (w.closes == null || at < w.closes);
}

/** Whether someone's clock has reached a window's close: their own lock, so a later watch locks as late as their TV does. */
export function isLocked(w: GameWindow, clock: GameClock, wall: number): boolean {
  return w.closes != null && momentOf(clock, wall) >= w.closes;
}

/** A call stamped with its moment: the game's moment on the caller's clock (what it's judged by), the real time it was made, and
 *  which clock it was (live calls trust the viewer's clock: the plan's risk, and the stakes stay social). */
export interface Stamp {
  at: Moment;
  wall: number;
  mode: GameClock["mode"];
}

export function stamp(clock: GameClock, wall: number): Stamp {
  return { at: momentOf(clock, wall), wall, mode: clock.mode };
}

/** How early in a window a moment came: 1 at its opening, 0 at its close (earlier worth more: the engine's scoring decides how
 *  much); null outside it, or for a window without both ends. */
export function earliness(w: GameWindow, at: Moment): number | null {
  if (w.opens == null || w.closes == null || w.closes <= w.opens || !isOpen(w, at)) return null;
  return (w.closes - at) / (w.closes - w.opens);
}

/** A unit's stretch (an at-bat, a drive, a possession: a Play's `unit`): from its first play's moment to its last's, when its
 *  outcome became known; null when no timed play has it. */
export function unitWindow(plays: Play[], unit: string): GameWindow | null {
  let opens: Moment | null = null;
  let closes: Moment | null = null;
  for (const p of plays) {
    if (p.unit !== unit) continue;
    const t = msOf(p.at);
    if (t == null) continue;
    if (opens == null) opens = t;
    closes = t;
  }
  return opens == null ? null : { opens, closes };
}
