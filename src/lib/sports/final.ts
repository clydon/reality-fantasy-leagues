// A sport's final as the server keeps it (docs/PLAN-start-a-game-gpt.md track L, L3 parts 1 and 3): read once from ESPN when the
// game or event is final, saved with it (sports_events.lines, people and shape: migrations 0301 and 0302), and never asked
// again. Everyone's counts at the end (the plays added up with the final's correction: Sport.timeline, so ESPN's own numbers
// whatever the plays missed), each one's team and position, and what the shape has besides: a team game's score, a field's
// standings (golf's, a race weekend's), a card's bouts and results (a fight card's, a tennis event's draws) with each bout's own
// counts. Everything a game scored by stats, or a question a sport's game settles, reads of a finished one is here: the derived
// stats are worked out at the read (Sport.full), so a sport's reader fixed later scores a kept final the new way. Pure: the
// server, the phone (points.ts) and the tests share it.
import { gameFacts } from "./spec";
import { TeamSport, headerTeams, type Bout, type BoutAnswer, type BoutResult, type BoutSport, type BoutState, type EspnSummary, type FieldAnswer, type FieldEvent, type FieldSport, type FieldState, type GameState, type Sport, type Standing, type Stats } from "./sport";
import type { SportsGameFacts } from "@/lib/game/game-spec";

/** Each person's team (ESPN's id, or a car's team as ESPN names it) and position (the sport's key, or ESPN's abbreviation: a
 *  soccer sub's is "SUB"; a card's, the class of their first bout: MMA's weight class, tennis's draw). */
export type StoredPeople = Record<string, { team: string | null; position: string | null }>;

/** A team game's final as it's kept. */
export interface StoredGame {
  kind?: undefined;
  /** ESPN's box score says it's over: the lines are the final's (its correction in them). */
  final: boolean;
  /** Each team's id and score, in ESPN's header's order; `shootout`, a soccer match's penalty shootout goals as ESPN's header
   *  says them (never in the score: L4 part 1a). */
  sides: { id: string; score: number; shootout?: number }[];
  /** L4 part 2: each period's end, each side's score then, in order (TeamSport.periodScores: squares' pays); left out when the
   *  summary had no plays to read them from. */
  periods?: Record<string, number>[];
  /** Each person's counts (raw: derived stats are the read's, Sport.full), in the sport's keys; a team's own (football's
   *  defense) under its id. */
  lines: Record<string, Stats>;
  people: StoredPeople;
}

/** A field's final as it's kept (golf's tournament, a race weekend): everyone's counts with their places in them, the field and
 *  its standings at the end (ESPN's own). */
export interface StoredField {
  kind: "field";
  final: boolean;
  event: FieldEvent;
  standings: Standing[];
  lines: Record<string, Stats>;
  people: StoredPeople;
}

/** A bout as it's kept: what the reads need (its sides, its rounds or sets for a table by format, the main event, its class). A
 *  Grand Slam's 600-odd matches with their draws' places, seeds and starts would be ~180 KB; so they're ~55 KB. */
export type StoredBout = Pick<Bout, "id" | "order" | "sides" | "rounds" | "main" | "class"> & {
  /** L4 part 2: how many rounds it is from its draw's final, for a bout in a draw's main rounds (tennis's: a bracket's). */
  fromFinal?: number;
};
/** A result as it's kept: how it ended and who won (the grader's; how they won is in their line: MMA's KO, SUB, DEC). */
export type StoredResult = Pick<BoutResult, "bout" | "outcome" | "winner" | "loser">;

/** A card's final as it's kept (a fight card, a tennis event's draws): everyone's counts over the card, the card's bouts, each
 *  bout's own counts by who (a table by format scores them), and the results (ESPN's own). */
export interface StoredCard {
  kind: "card";
  final: boolean;
  card: { event: string; bouts: StoredBout[]; field: string[] };
  byBout: Record<string, Record<string, Stats>>;
  results: StoredResult[];
  lines: Record<string, Stats>;
  people: StoredPeople;
}

/** A game's or an event's final as it's kept. */
export type StoredFinal = StoredGame | StoredField | StoredCard;

/** What the kept final's shape has besides its lines and people (sports_events.shape: a field's and a card's; a team game's
 *  sides are the row's own, so its shape is a penalty shootout's goals by side (L4 part 1a) and its periods' ends (L4 part 2), or
 *  null with neither). */
export type StoredShape = Pick<StoredField, "kind" | "event" | "standings"> | Pick<StoredCard, "kind" | "card" | "byBout" | "results"> | { kind: "team"; shootout?: Record<string, number>; periods?: Record<string, number>[] };

/** A team game's summary as it's kept: its counts at the end of its timeline, its people, its score; null without a box score. */
export function storedGame(sport: TeamSport, summary: EspnSummary): StoredGame | null {
  const box = sport.readBox(summary);
  if (!box) return null;
  const state = sport.stateAt(summary);
  const people = Object.fromEntries(Object.values(box.people).map((p) => [p.id, { team: p.team || null, position: p.position }]));
  // The timeline's last score: a final's is the box score's own (its correction carries it).
  // Level at the end, a shootout's goals as ESPN's header has them (soccer's box: its teams' SOGOAL), over the kicks the plays
  // counted (L4 part 1a).
  const so = new Map(box.teams.map((t) => [t.id, t.stats.SOGOAL]));
  const plain = headerTeams(summary).map((t) => ({ id: t.id, score: state.score[t.id] ?? 0 }));
  const level = plain.length === 2 && plain[0].score === plain[1].score && plain.every((s) => typeof so.get(s.id) === "number");
  const sides = level ? plain.map((s) => ({ ...s, shootout: so.get(s.id) as number })) : plain;
  // L4 part 2: each period's end (squares' pays), as far as the plays say.
  const periods = sport.periodScores(summary);
  return { final: box.final, sides, ...(periods.length ? { periods } : {}), lines: state.lines, people };
}

/** A field's answer (the pollers' calls, asked once: live-event.ts) as it's kept: its counts and standings at the end of its
 *  timeline, its people; null when it has no field. */
export function storedField(sport: FieldSport, answer: FieldAnswer): StoredField | null {
  const box = sport.readBox(answer);
  if (!box) return null;
  const state = sport.stateAt(answer);
  const people = Object.fromEntries(Object.values(box.people).map((p) => [p.id, { team: p.car?.team ?? null, position: null }]));
  const event: FieldEvent = { event: box.event, field: box.field, parts: box.parts, cut: box.cut };
  return { kind: "field", final: box.final, event, standings: state.standings, lines: state.lines, people };
}

/** A card's answer (the pollers' calls, asked once) as it's kept: its counts, each bout's and its results at the end of its
 *  timeline, its bouts, its people; null when it has no bouts. */
export function storedCard(sport: BoutSport, answer: BoutAnswer): StoredCard | null {
  const box = sport.readBox(answer);
  if (!box) return null;
  const state = sport.stateAt(answer);
  // L4 part 2: a bout's distance from its draw's final (a bracket's), only for a draw's main rounds.
  const bouts = box.bouts.map((b) => ({ id: b.id, order: b.order, sides: b.sides, rounds: b.rounds, main: b.main, class: b.class, ...(b.place?.fromFinal != null ? { fromFinal: b.place.fromFinal } : {}) }));
  const people: StoredPeople = {};
  for (const b of box.bouts) for (const id of b.sides) people[id] ??= { team: null, position: b.class };
  const results = state.results.map((r) => ({ bout: r.bout, outcome: r.outcome, winner: r.winner, loser: r.loser }));
  return { kind: "card", final: box.final, card: { event: box.event, bouts, field: box.field }, byBout: state.byBout, results, lines: state.lines, people };
}

/** A kept final's shape, for sports_events.shape (null for a team game). */
export function shapeOf(g: StoredFinal): StoredShape | null {
  if (g.kind === "field") return { kind: "field", event: g.event, standings: g.standings };
  if (g.kind === "card") return { kind: "card", card: g.card, byBout: g.byBout, results: g.results };
  // A team game's sides are the row's own; only a shootout's goals (L4 part 1a) and its periods' ends (L4 part 2) aren't.
  const shootout = Object.fromEntries(g.sides.flatMap((s) => (typeof s.shootout === "number" ? [[s.id, s.shootout]] : [])));
  const periods = g.periods?.length ? g.periods : null;
  if (!Object.keys(shootout).length && !periods) return null;
  return { kind: "team", ...(Object.keys(shootout).length ? { shootout } : {}), ...(periods ? { periods } : {}) };
}

/** A kept team game as the sport's state at its end (the reduce's shape: what statePoints and gameFacts read). */
export function storedState(g: StoredGame): GameState {
  return { plays: 0, last: null, score: Object.fromEntries(g.sides.map((s) => [s.id, s.score])), lines: g.lines };
}

/** Any kept final as its sport's state at the end: a team game's, a field's (its standings) or a card's (each bout done with its
 *  result: who won, how it ended; nothing of its rounds). */
export function finalState(g: StoredFinal): GameState | FieldState | BoutState {
  if (g.kind === "field") return { plays: 0, last: null, lines: g.lines, parts: {}, score: {}, standings: g.standings };
  if (g.kind === "card") {
    const results: BoutResult[] = g.results.map((r) => ({ ...r, method: null, how: null, round: null, time: null, cards: [] }));
    const bouts = Object.fromEntries(results.map((r) => [r.bout, { stage: "done" as const, round: null, rounds: {}, result: r }]));
    return { plays: 0, last: null, lines: g.lines, byBout: g.byBout, bouts, results };
  }
  return storedState(g);
}

/** A kept final as the game spec's grader reads it (facts.games' one, answers.js sportsVerdict), at `status`: the server's view. */
export function storedFacts(sport: Sport, g: StoredFinal, status: SportsGameFacts["status"]): SportsGameFacts {
  if (g.kind) return gameFacts(sport, finalState(g), { status, people: g.people, card: g.kind === "card" ? g.card : null });
  const shootout = Object.fromEntries(g.sides.flatMap((s) => (typeof s.shootout === "number" ? [[s.id, s.shootout]] : [])));
  return gameFacts(sport, storedState(g), { status, sides: g.sides.map((s) => s.id), people: g.people, ...(Object.keys(shootout).length ? { shootout } : {}), ...(g.periods?.length ? { periods: g.periods } : {}) });
}

/**
 * A kept final in someone else's ids (the league's people: `idOf` a provider's id to a castaway's, or itself): its lines and
 * people, a field's competitors and standings, a card's sides, each bout's own counts and its results' winners. A team's own
 * ids (a game's sides, a team's line) are left as they are unless `idOf` says otherwise.
 */
export function renamed<G extends StoredFinal>(g: G, idOf: (id: string) => string): G {
  // Two ids for one person keep the first's (as livePoints does).
  const keys = <T,>(o: Record<string, T>) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(o)) if (!(idOf(k) in out)) out[idOf(k)] = v;
    return out;
  };
  const out = { ...g, lines: keys(g.lines), people: keys(g.people) };
  if (out.kind === "field") {
    out.event = { ...out.event, field: out.event.field.map(idOf) };
    out.standings = out.standings.map((s) => ({ ...s, id: idOf(s.id) }));
  } else if (out.kind === "card") {
    out.card = { ...out.card, field: out.card.field.map(idOf), bouts: out.card.bouts.map((b) => ({ ...b, sides: b.sides.map(idOf) })) };
    out.byBout = Object.fromEntries(Object.entries(out.byBout).map(([b, lines]) => [b, keys(lines)]));
    out.results = out.results.map((r) => ({ ...r, winner: r.winner == null ? null : idOf(r.winner), loser: r.loser == null ? null : idOf(r.loser) }));
  }
  return out;
}

/**
 * Someone's position group, for a table by position (byPosition): their roster's position (season_cast.role, ESPN's roster's
 * name for it: "Goalkeeper", or its abbreviation) before the game's (a soccer sub's is "SUB", which isn't one), else null.
 */
export function groupOf(sport: Sport, role: string | null | undefined, position?: string | null): string | null {
  for (const said of [role, position]) {
    const s = (said ?? "").trim();
    if (!s) continue;
    const p = sport.position(sport.positionKey(s) ?? "") ?? sport.positions.find((x) => x.label.toLowerCase() === s.toLowerCase());
    if (p) return p.group;
  }
  return null;
}
