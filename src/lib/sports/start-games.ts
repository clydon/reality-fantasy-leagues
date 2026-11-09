import * as Spec from "../game/game-spec/index.js";
import { sportGames, sportPageContext } from "./page";

// Start a game on a team (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "Start a game on a team": B in a sport's
// words): the rail of a sport's standard games (its defaults, ./defaults) for some of its games, each named as the board names it,
// with its own words (describeSpec on the sport's page) and whether it fits, by our check on the page with the span set. Which games
// a rail offers is by what's being played, never by sport: one team's games (a game, a series, a season, a rival's meetings) take the
// per-game and small-draft games; a league's slate takes the season-long ones besides. Pure: the server and the tests share it.

/** How the board names each of a sport's standard games, by its defaults' id. */
const NAMES: Record<string, { name: string; sub: string }> = {
  pickem: { name: "Pick'em", sub: "Who wins each game" },
  pickAFew: { name: "Pick a few", sub: "Three players a game" },
  short: { name: "A draft", sub: "Draft a few players" },
  squares: { name: "Squares", sub: "The party game's grid" },
  bestBall: { name: "Best Ball", sub: "Draft once, no lineups" },
  season: { name: "Season league", sub: "Lineups, head to head" },
  categories: { name: "Categories", sub: "Win the most stat columns" },
  roto: { name: "Roto", sub: "Ranked in every stat" },
};

/** A team's games take these; a league's slate these. In the board's order: the classic first. */
const TEAM = ["pickem", "pickAFew", "short", "squares", "bestBall"];
const SLATE = ["pickem", "season", "bestBall", "short", "categories", "roto"];

export interface RailGame {
  id: string;
  name: string;
  sub: string;
  /** The defaults' own words for it. */
  about: string;
  /** The game at a glance (describeSpec's short line) and how it plays, a rule a line. */
  line: string;
  rules: string[];
  /** Null when it fits; else why not, as our check says it. */
  why: string | null;
  spec: Record<string, unknown>;
}

/** The spec for one of a sport's standard games over episodes `from` to `to` of the season it starts on. */
export function railSpec(spec: Record<string, unknown>, from: number, to: number): Record<string, unknown> {
  return { ...structuredClone(spec), span: { from, to } };
}

/**
 * The rail for `league`'s games: `count` of them (episodes 1 to count, as a matchup's season numbers them; a slate's episodes), one
 * team's (`team`) or a whole league's slate. `show`/`part` name the season as its page would.
 */
export function sportRail(league: string, o: { count: number; slate?: boolean; playoffs?: boolean; show?: string; part?: { singular: string; plural: string } }): RailGame[] {
  const ctx = sportPageContext(league, { playoffs: o.playoffs, show: o.show, part: o.part });
  if (!ctx) return [];
  const order = o.slate ? SLATE : TEAM;
  const games = sportGames(league, { playoffs: o.playoffs }).filter((g) => order.includes(g.id));
  games.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return games.map((g) => {
    const spec = railSpec(g.spec, 1, Math.max(1, o.count));
    const problem = Spec.specProblems(spec, ctx as never)[0]?.problem ?? Spec.specWaitsFor(spec as never)[0]?.problem ?? (Spec.typeOf(spec as never) ? null : "No game plays this way yet");
    const d = Spec.describeSpec(spec as never, ctx as never);
    const n = NAMES[g.id] ?? { name: d.short.title || g.id, sub: "" };
    return { id: g.id, name: n.name, sub: n.sub, about: g.about, line: d.short.line, rules: d.rules, why: problem ?? null, spec: g.spec };
  });
}
