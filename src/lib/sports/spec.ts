// A game scored by a sport's stats, the spec's way (docs/PLAN-start-a-game-gpt.md track L, L1 part 4a): `score.by: 'stats'`,
// whose shape and check are the game spec's (src/lib/game/game-spec/schema.js statScoreProblems, statScoreSettles), read here
// against a sport's lines. Every shape of sport keeps its competitors' numbers as lines in its own keys (a team sport's box score
// as of a moment, a field's with each one's place in it, a card's with each fighter's result), so one table scores all of them:
// `points` each, `byPosition` a stat's points by the player's position group (FPL's goal), `byPlace` a place's by place or range
// (golf's and racing's POS, the tied each the place's), `byFormat` a bout's by the rounds or sets it's scheduled for (tennis's
// best of five). Pure: the server, the phone and the tests share it. Nothing here knows a sport's numbers: they're its defaults
// (./defaults/*.json) or a game's own spec.
import { placeRange } from "@/lib/game/game-spec";
import { TeamSport } from "./sport";
import type { SportsGameFacts } from "@/lib/game/game-spec";
import type { BoutCard, BoutState, FieldState, GameState, LockCadence, Sport, Stats } from "./sport";

/** A spec's score by a sport's stats (the game spec's `score` when `by` is "stats"). */
export interface StatScore {
  by?: "stats";
  points?: Record<string, number>;
  byPosition?: Record<string, Record<string, number>>;
  byPlace?: Record<string, Record<string, number>>;
  byFormat?: Record<string, Record<string, number>>;
}

/** One stat's part of someone's points: its value (a place, for a place) and what it scored; `bout`, the bout it was in, when
 *  its points were its format's. */
export interface StatPart {
  stat: string;
  value: number;
  points: number;
  bout?: string;
}

/** Someone's points and the stats that made them, in the table's order (counts, then places). */
export interface Scored {
  points: number;
  parts: StatPart[];
}

const cents = (n: number) => Math.round(n * 100) / 100;
const has = (o: object | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/** A place or a range of them ("1", "4-10"), as { min, max }; null when it isn't one: the game spec's own, so the check and the
 *  scorer read a table alike. */
export { placeRange };

// A table's places read once (a field's every competitor, at every poll).
const RANGES = new WeakMap<Record<string, number>, { min: number; max: number; points: number }[]>();
function rangesOf(table: Record<string, number>) {
  let r = RANGES.get(table);
  if (!r) {
    r = Object.entries(table).flatMap(([k, points]) => {
      const at = placeRange(k);
      return at ? [{ ...at, points }] : [];
    });
    RANGES.set(table, r);
  }
  return r;
}

/** A place's points in a table by place: the place's or its range's; 0 for one it leaves out (or no place: out of the places). */
export function placePoints(table: Record<string, number>, place: number | null | undefined): number {
  if (place == null || !Number.isFinite(place)) return 0;
  return rangesOf(table).find((r) => place >= r.min && place <= r.max)?.points ?? 0;
}

/** What one of a stat scores for someone: their position group's points (byPosition), else their bout's format's (byFormat),
 *  else `points`'; 0 when the table doesn't score it. */
function eachOf(score: StatScore, stat: string, group: string | null, format: Record<string, number> | undefined): number {
  const pos = group != null ? score.byPosition?.[stat] : undefined;
  if (pos && has(pos, group!)) return pos[group!];
  if (format && has(format, stat)) return format[stat];
  return score.points?.[stat] ?? 0;
}

/**
 * Someone's points from one line (their counts in a game, a field event or a bout, places in it), by a stats score: each stat
 * the table scores times its points (by their position group, by the bout's format), and each place stat by its place. A line's
 * missing stat is 0; a place out of the table's places scores nothing.
 */
export function linePoints(score: StatScore, line: Stats, o: { group?: string | null; format?: number | string | null } = {}): Scored {
  const group = o.group ?? null;
  const format = o.format != null ? score.byFormat?.[String(o.format)] : undefined;
  const places = score.byPlace ?? {};
  const keys = new Set([...Object.keys(score.points ?? {}), ...Object.keys(format ?? {})]);
  if (group != null) for (const [k, by] of Object.entries(score.byPosition ?? {})) if (has(by, group)) keys.add(k);
  const parts: StatPart[] = [];
  for (const stat of keys) {
    if (has(places, stat)) continue;
    const value = line[stat] ?? 0;
    const each = eachOf(score, stat, group, format);
    if (value && each) parts.push({ stat, value, points: cents(value * each) });
  }
  for (const [stat, table] of Object.entries(places)) {
    const points = placePoints(table, line[stat]);
    if (points) parts.push({ stat, value: line[stat], points });
  }
  return { points: cents(parts.reduce((n, p) => n + p.points, 0)), parts };
}

const minus = (a: Stats, b: Stats): Stats => {
  const out: Stats = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) - v;
  return out;
};

/**
 * Everyone's points as of a moment, by a stats score, from the sport's state then (its reduce or stateAt: a team game's, a
 * field's or a card's): a team sport's lines with their derived stats worked out (Sport.full: total bases from the plays'
 * counts); a card scored by format, each bout's own line at its format (BoutState.byBout, Bout.rounds) and whatever the card's
 * line has besides (the final's correction) at `points`'. `groupOf`: a player's position group (their roster's), for byPosition.
 */
export function statePoints(
  sport: Sport,
  score: StatScore,
  state: GameState | FieldState | BoutState,
  o: { groupOf?: (id: string) => string | null | undefined; card?: BoutCard | null } = {},
): Record<string, Scored> {
  const out: Record<string, Scored> = {};
  // A card scored by format needs its card (each bout's rounds or sets): without it every bout would score at `points`'.
  if ("byBout" in state && score.byFormat && Object.keys(score.byFormat).length && !o.card) throw new Error("A card scored by its bouts' formats needs the card");
  const byBout = "byBout" in state && score.byFormat && o.card ? state.byBout : null;
  for (const [id, raw] of Object.entries(state.lines)) {
    const line = sport instanceof TeamSport ? sport.full(raw) : raw;
    const group = o.groupOf?.(id) ?? null;
    if (!byBout) {
      out[id] = linePoints(score, line, { group });
      continue;
    }
    const parts: StatPart[] = [];
    let rest = line;
    for (const bout of o.card!.bouts) {
      const own = byBout[bout.id]?.[id];
      if (!own) continue;
      for (const p of linePoints(score, own, { group, format: bout.rounds }).parts) parts.push({ ...p, bout: bout.id });
      rest = minus(rest, own);
    }
    parts.push(...linePoints(score, rest, { group }).parts);
    out[id] = { points: cents(parts.reduce((n, p) => n + p.points, 0)), parts };
  }
  return out;
}

/**
 * A sport's game as the game spec's grader reads it (L1 part 4b: facts.games' one, answers.js sportsVerdict), from the sport's
 * state as of the viewer's moment (its reduce or stateAt: the server's from a stored final, the phone's from the poller) and
 * where the game is then (`status`: final once the viewer's moment is past its end). A team game's sides and score, everyone's
 * lines (derived stats worked out) and their teams (`people`: the box's or the poller's who's who); a field's places; a card's
 * bouts and their results.
 */
export function gameFacts(
  sport: Sport,
  state: GameState | FieldState | BoutState,
  o: { status: SportsGameFacts["status"]; sides?: string[]; people?: Record<string, { team?: string | null }>; card?: BoutCard | null },
): SportsGameFacts {
  const team = sport instanceof TeamSport;
  const lines = Object.fromEntries(Object.entries(state.lines).map(([id, l]) => [id, team ? sport.full(l) : l]));
  const teams = Object.fromEntries(Object.entries(o.people ?? {}).flatMap(([id, p]) => (p.team ? [[id, p.team]] : [])));
  const placed = sport.stats.filter((s) => s.place).map((s) => s.key);
  const out: SportsGameFacts = { status: o.status, sides: [], lines, teams, ...(placed.length ? { placed } : {}) };
  if ("standings" in state) out.places = Object.fromEntries(state.standings.map((s) => [s.id, s.place]));
  else if ("bouts" in state) {
    // Without its card a bout's sides and the main event aren't known: every bout would read as not on the card.
    if (!o.card) throw new Error("A card's facts need the card");
    out.bouts = Object.fromEntries((o.card?.bouts ?? []).map((b) => {
      const r = state.bouts[b.id]?.result ?? null;
      return [b.id, { sides: b.sides, winner: r?.winner ?? null, outcome: r?.outcome ?? null, main: b.main }];
    }));
  } else out.sides = (o.sides ?? Object.keys(state.score)).map((id) => ({ id, score: state.score[id] ?? 0 }));
  return out;
}

/** When a spec's moves close, from a sport's lock cadence: daily and weekly as they are, an event's at each one's start (an
 *  event is an episode of the season: a tournament, a race weekend, a card). */
export function specCloses(lock: LockCadence): "start" | "daily" | "weekly" {
  return lock === "event" ? "start" : lock;
}
