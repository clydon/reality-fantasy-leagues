import { statKeyIn } from "../game/game-words/pack.js";
import { defaultsFor, specContextOf, sportOf, type AnySport } from "./index";

// A sport's page as the Start-a-game GPT reads it (docs/PLAN-start-a-game-gpt.md step G3): what a game spec on it is checked against
// (the sport's ctx, with what a sport's results never say), the stat words a request names a stat by ("home run", "HR", "home runs":
// its key), and the sport's standard games, each in its own words. Pure: the server's context pack (src/lib/server/game-words.ts),
// the capability tracker's sports pages (src/lib/game/capability-rows.ts) and the tests share it. Nothing here knows a sport: the
// words are each Sport's own StatDefs, the games its defaults (./defaults).

/** What the check reads of a sport's page: specContextOf's, plus its words and what a sport's results never say. */
export type SportPageContext = ReturnType<typeof specContextOf> & {
  show: string;
  castaway: string;
  castaways: string;
  part: { singular: string; plural: string };
  /** The sport's id and ESPN's league ("basketball/nba"). */
  sport: string;
  league: string;
  /** Nobody goes home or wins a season of games; no research runs on one (no trivia, no votes, no moments). */
  results: false;
  winner: false;
  trivia: false;
  jury: false;
  votes: false;
  moments: [];
  phases: [];
  roles: [];
};

/**
 * The ctx a spec on `league`'s games is checked against (null for a league no sport reads). `show`: the page's name; `person` and
 * `part`: its words for a player and a game (a show's own terms, else "player" and "game"); `playoffs`: a season made of a league's
 * playoffs (specContextOf's).
 */
export function sportPageContext(league: string, o: { show?: string; person?: { one: string; many: string }; part?: { singular: string; plural: string }; playoffs?: boolean } = {}): SportPageContext | null {
  const sport = sportOf(league);
  if (!sport) return null;
  const name = league.split("/")[1];
  return {
    ...specContextOf(sport, name, { playoffs: o.playoffs }),
    show: o.show ?? sport.name,
    castaway: o.person?.one ?? "player",
    castaways: o.person?.many ?? "players",
    part: o.part ?? { singular: "game", plural: "games" },
    sport: sport.id,
    league,
    results: false,
    winner: false,
    trivia: false,
    jury: false,
    votes: false,
    moments: [],
    phases: [],
    roles: [],
  };
}

/** A stat as the pack says it: its key, the words for it (its label, its column's short form, a noun for one), a place's marked, and
 *  a rate's (it can't score points: only a categories game reads it). */
export interface StatWords {
  key: string;
  says: string;
  short: string;
  one: string;
  place?: true;
  rate?: true;
}

/** Every stat a request can name on `sport`, in its own words. */
export function statWords(sport: AnySport): StatWords[] {
  return sport.stats.map((s) => ({ key: s.key, says: s.label, short: s.short, one: s.noun, ...(s.place ? { place: true as const } : {}), ...(s.kind === "rate" ? { rate: true as const } : {}) }));
}

/**
 * The stat some words name on `sport` (its key), or null: a key as it is ("HR"), a column's short form where only one stat has it,
 * or its words or noun, singular or plural ("home runs", "a home run", "total bases"). Never a guess (game-words pack.js statKeyIn,
 * which our check uses on the pack's stats).
 */
export function statKeyOf(sport: AnySport, words: string): string | null {
  return statKeyIn(statWords(sport), words);
}

/** A sport's standard games, each in its own words, as the GPT's examples: { id, about, spec } (L1 part 4a's default specs); one
 *  that plays only on a league's playoffs (a bracket of them) only when the page is them (`playoffs`). */
export function sportGames(league: string, o: { playoffs?: boolean } = {}): { id: string; about: string; spec: Record<string, unknown>; on?: "playoffs" }[] {
  const sport = sportOf(league);
  const d = sport ? defaultsFor(sport.id, league.split("/")[1]) : null;
  return d ? Object.entries(d.specs).filter(([, s]) => !s.on || (s.on === "playoffs" && o.playoffs)).map(([id, s]) => ({ id, about: s.about, spec: s.spec, ...(s.on ? { on: s.on } : {}) })) : [];
}

/** A sport's standard scoring and lineup, as the pack says them: its table's points, its lineup's starters and bench, and how often a
 *  lineup locks. Null for a sport with no defaults. */
export function sportStandard(league: string): { scoring: Record<string, number>; source: string; starters: number; bench: number; locks: "daily" | "weekly" | "event" } | null {
  const sport = sportOf(league);
  const d = sport ? defaultsFor(sport.id, league.split("/")[1]) : null;
  if (!d) return null;
  return { scoring: d.scoring.points, source: d.scoring.source, starters: d.slots.lineup.reduce((n, s) => n + s.n, 0), bench: d.slots.bench, locks: d.closes };
}
