// A game scored by a sport's stats, the spec's way (docs/PLAN-start-a-game-gpt.md track L, L1 part 4a): `score.by: 'stats'`,
// whose shape and check are the game spec's (src/lib/game/game-spec/schema.js statScoreProblems, statScoreSettles), read here
// against a sport's lines. Every shape of sport keeps its competitors' numbers as lines in its own keys (a team sport's box score
// as of a moment, a field's with each one's place in it, a card's with each fighter's result), so one table scores all of them:
// `points` each, `byPosition` a stat's points by the player's position group (FPL's goal), `byPlace` a place's by place or range
// (golf's and racing's POS, the tied each the place's), `byFormat` a bout's by the rounds or sets it's scheduled for (tennis's
// best of five). Pure: the server, the phone and the tests share it. Nothing here knows a sport's numbers: they're its defaults
// (./defaults/*.json) or a game's own spec.
import { placeRange } from "@/lib/game/game-spec";
import { placePoints, statLine } from "@/lib/game/sequence/stats";
import { TeamSport } from "./sport";
import type { SportsGameFacts } from "@/lib/game/game-spec";
import type { Scored, StatBout, StatPart, StatScore } from "@/lib/game/sequence/stats";
import type { Bout, BoutState, FieldState, GameState, LockCadence, Sport, Stats } from "./sport";

export type { Scored, StatBout, StatPart, StatScore };

/** A card as its scoring and grading read it: each bout's id, sides, rounds or sets and whether it's the main event (a BoutCard,
 *  or a kept one: final.ts StoredCard). */
export interface CardBouts {
  bouts: Pick<Bout, "id" | "sides" | "rounds" | "main">[];
}

/** A place or a range of them ("1", "4-10"), as { min, max }; null when it isn't one: the game spec's own, so the check and the
 *  scorer read a table alike. */
export { placeRange };

/** A place's points in a table by place: the place's or its range's; 0 for one it leaves out (or no place: out of the places).
 *  The scoring sequence's (src/lib/game/sequence/stats.js, L3 part 1). */
export { placePoints };

/**
 * Someone's points from one line (their counts in a game, a field event or a bout, places in it), by a stats score: each stat
 * the table scores times its points (by their position group, by the bout's format), and each place stat by its place. A line's
 * missing stat is 0; a place out of the table's places scores nothing. The scoring sequence's step 2 for stats (L3 part 1:
 * sequence/stats.js statLine), so the engine's scorer, the server and the phone score a line alike.
 */
export function linePoints(score: StatScore, line: Stats, o: { group?: string | null; format?: number | string | null; bouts?: StatBout[] } = {}): Scored {
  return statLine(score, line, o);
}

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
  o: { groupOf?: (id: string) => string | null | undefined; card?: CardBouts | null } = {},
): Record<string, Scored> {
  const out: Record<string, Scored> = {};
  // A card scored by format needs its card (each bout's rounds or sets): without it every bout would score at `points`'.
  if ("byBout" in state && score.byFormat && Object.keys(score.byFormat).length && !o.card) throw new Error("A card scored by its bouts' formats needs the card");
  const byBout = "byBout" in state && score.byFormat && o.card ? state.byBout : null;
  for (const [id, raw] of Object.entries(state.lines)) {
    const line = sport instanceof TeamSport ? sport.full(raw) : raw;
    out[id] = linePoints(score, line, { group: o.groupOf?.(id) ?? null, bouts: byBout ? boutsOf(o.card!, byBout, id) : undefined });
  }
  return out;
}

/** The bouts someone fought on a card, each with their own line in it at its rounds or sets (statLine's `bouts`, for a table by
 *  format), in the card's order. */
export function boutsOf(card: CardBouts, byBout: Record<string, Record<string, Stats>>, id: string): StatBout[] {
  return card.bouts.flatMap((b) => (byBout[b.id]?.[id] ? [{ id: b.id, format: b.rounds, line: byBout[b.id][id] }] : []));
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
  o: { status: SportsGameFacts["status"]; sides?: string[]; people?: Record<string, { team?: string | null }>; card?: CardBouts | null; shootout?: Record<string, number> },
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
  } else {
    out.sides = (o.sides ?? Object.keys(state.score)).map((id) => ({ id, score: state.score[id] ?? 0 }));
    // L4 part 1a: level with a penalty shootout (its kicks are never the score: soccer.ts), each side's shootout goals, so a cup
    // tie won on penalties has a winner and only a match that ends level is a draw: ESPN's own (`o.shootout`, the header's, as a
    // kept final has it), else its players' kicks added up (the phone's, from the plays).
    const [a, b] = out.sides;
    if (out.sides.length === 2 && a.score === b.score) {
      const so = (side: string) => o.shootout?.[side] ?? Object.entries(lines).reduce((n, [id, l]) => n + (teams[id] === side ? (l.SOGOAL ?? 0) : 0), 0);
      const [x, y] = [so(a.id), so(b.id)];
      if (x || y) out.sides = [{ ...a, shootout: x }, { ...b, shootout: y }];
    }
  }
  return out;
}

/** When a spec's moves close, from a sport's lock cadence: daily and weekly as they are, an event's at each one's start (an
 *  event is an episode of the season: a tournament, a race weekend, a card). */
export function specCloses(lock: LockCadence): "start" | "daily" | "weekly" {
  return lock === "event" ? "start" : lock;
}
