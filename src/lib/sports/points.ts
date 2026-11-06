// Each holding's points in a game scored by a sport's stats, live on the phone (docs/PLAN-start-a-game-gpt.md track L, L3 part
// 3): the screens call this with the poller's state as of the viewer's moment (LiveGame's or LiveEvent's stateAt(t), or
// state(clock): live for someone watching live, their own moment for a later watch) and, once the server has it, the saved
// final. The same line as the server's (the scoring sequence's statLine, through statePoints), so a holding scores alike on the
// phone and in the standings. While the game's on, the poller's points are provisional: ESPN's plays, which the final corrects
// (a scorer's change, a stat the plays don't carry). Once the viewer's moment reaches the end and the saved final's in, its
// points replace them, and what the final changed is said (`corrections`). Pure: the screens (U1) and the tests share it.
import { finalState, type StoredFinal } from "./final";
import { statePoints, type CardBouts, type Scored } from "./spec";
import type { AnySport } from "./index";
import type { BoutState, FieldState, GameState } from "./sport";
import { cents } from "@/lib/game/sequence/stats";
import type { StatScore } from "@/lib/game/sequence/stats";

/** A state any poller gives: a team game's, a field's or a card's. */
export type LiveState = GameState | FieldState | BoutState;

export interface LivePoints {
  /** Each holding's points and the stats that made them, by holding (the league's castaway, `who`'s; else the provider's id). */
  points: Record<string, Scored>;
  /** Where they're from: the saved final's (corrections in), the poller's as of the moment (provisional), or nothing yet. */
  from: "final" | "live" | "none";
  /** With the final: each holding whose points it changed from the poller's end, by how much (+1.5: the final gave them more). */
  corrections: Record<string, number>;
}

/** Whether a state reaches the game's end: its last play is the final's correction (the timelines put it last once it's final). */
export function atFinal(state: LiveState | null | undefined): boolean {
  return state?.last?.final === true;
}

/**
 * Each holding's points by a stats score (a spec's `score`), as of the viewer's moment:
 * - `live`: the poller's state then (stateAt(t) or state(clock)); null before its first answer; left out when there's no poller
 *   (the viewer's past the end: the saved final alone).
 * - `saved`: the final the server kept (finals.ts: sports_events.lines, people and shape), once it's in, in the provider's ids
 *   as `live`'s are.
 * - `card`: a card's bouts (the poller's `shape`), for a table by format; a saved card brings its own.
 * - `who`: a provider's id to its holding's (the league's castaway, by season_cast.provider_ids); someone without one keeps the
 *   provider's id. `groupOf`: a holding's position group (their roster's), for a table by position.
 * The saved final replaces the poller's once the viewer's moment is at the end (or there's no poller); before it, the poller's
 * are provisional; with neither, nothing.
 */
export function livePoints(
  sport: AnySport,
  score: StatScore,
  o: {
    live?: LiveState | null;
    saved?: StoredFinal | null;
    card?: CardBouts | null;
    who?: (id: string) => string | null | undefined;
    groupOf?: (holding: string) => string | null | undefined;
  },
): LivePoints {
  const idOf = (id: string) => o.who?.(id) ?? id;
  const scoreOf = (state: LiveState, card: CardBouts | null | undefined) => {
    const out: Record<string, Scored> = {};
    const by = statePoints(sport, score, state, { groupOf: (id) => o.groupOf?.(idOf(id)) ?? null, card: card ?? null });
    // Two provider ids for one holding (rare: a person under two ids) keep the first.
    for (const [id, s] of Object.entries(by)) out[idOf(id)] ??= s;
    return out;
  };
  const saved = o.saved?.final ? o.saved : null;
  const ended = o.live === undefined || atFinal(o.live);
  if (saved && ended) {
    const points = scoreOf(finalState(saved), saved.kind === "card" ? saved.card : null);
    const corrections: Record<string, number> = {};
    if (o.live) {
      const was = scoreOf(o.live, o.card ?? (saved.kind === "card" ? saved.card : null));
      for (const id of new Set([...Object.keys(points), ...Object.keys(was)])) {
        const d = cents((points[id]?.points ?? 0) - (was[id]?.points ?? 0));
        if (d) corrections[id] = d;
      }
    }
    return { points, from: "final", corrections };
  }
  if (o.live) return { points: scoreOf(o.live, o.card), from: "live", corrections: {} };
  return { points: {}, from: "none", corrections: {} };
}

/** Points as the scoring sequence's moments (momentRaw's events: one per holding that scored), for the rest of the sequence on
 *  the phone (a captain, the episode's multiplier, best ball's best n), as the server's statMoments gives them. */
export function asMoments(points: Record<string, Scored>): { castawayId: string; points: number }[] {
  return Object.entries(points).flatMap(([id, s]) => (s.points ? [{ castawayId: id, points: s.points }] : []));
}
