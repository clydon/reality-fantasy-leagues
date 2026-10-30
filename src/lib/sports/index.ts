// The sports (docs/PLAN-start-a-game-gpt.md track L): one class per sport, found by ESPN's sport slug, the first half of a
// league's path ("baseball" of "baseball/mlb", not yet college baseball, whose box is another; "basketball" of
// "basketball/nba" and "basketball/wnba"; a sport can name the leagues it reads, so a slug can have more than one: college
// basketball is its own feed, an instance a league, the men's halves and the women's quarters; "football" of "football/nfl"
// and, its plays written otherwise, "football/college-football" (college-football.ts); "hockey" of "hockey/nhl", not college
// hockey, which ESPN carries as scores; "soccer" of every soccer league, which ESPN writes alike: "soccer/eng.1", "soccer/usa.1",
// "soccer/uefa.champions"). Golf, racing, MMA and tennis come in L5.
// A game's clock for someone (clock.ts) and a game live on the phone (live.ts) are L2's.
import { Baseball } from "./baseball";
import { Basketball, CollegeBasketball, HALVES } from "./basketball";
import { Football } from "./football";
import { CollegeFootball } from "./college-football";
import { Hockey } from "./hockey";
import { Soccer } from "./soccer";
import baseballDefaults from "./defaults/baseball.json";
import basketballDefaults from "./defaults/basketball.json";
import footballDefaults from "./defaults/football.json";
import hockeyDefaults from "./defaults/hockey.json";
import soccerDefaults from "./defaults/soccer.json";
import type { LockCadence, TeamSport } from "./sport";

export * from "./sport";
export * from "./clock";
export * from "./live";
export { Baseball } from "./baseball";
export { Basketball, CollegeBasketball } from "./basketball";
export { Football, defenseId } from "./football";
export { CollegeFootball } from "./college-football";
export { Hockey } from "./hockey";
export { Soccer, plainName } from "./soccer";

// A sport's own leagues first: a sport slug can have more than one (basketball's NBA and WNBA, and college's two), each naming
// the leagues it reads; sportById gives the first, the sport's own.
const SPORTS: TeamSport[] = [new Baseball(), new Basketball(), new CollegeBasketball("mens-college-basketball", "Men's college basketball", HALVES), new CollegeBasketball("womens-college-basketball", "Women's college basketball"), new Football(), new CollegeFootball(), new Hockey(), new Soccer()];

/** The sport by its id ("baseball"): its first, the one for its pro leagues ("basketball": the NBA's and WNBA's), or null for
 *  one not built yet. */
export function sportById(id: string): TeamSport | null {
  return SPORTS.find((s) => s.id === id) ?? null;
}

/** The sport an ESPN league plays ("baseball/mlb" is Baseball, "hockey/nhl" Hockey, "basketball/mens-college-basketball"
 *  college's halves), or null for one not built yet. */
export function sportOf(league: string): TeamSport | null {
  const [id, name] = String(league).split("/");
  return SPORTS.find((s) => s.id === id && (!s.leagues || s.leagues.includes(name))) ?? null;
}

/** Every sport built so far. */
export function allSports(): TeamSport[] {
  return [...SPORTS];
}

/** A lineup slot in a sport's defaults: how many, and which positions or position groups fill it. */
export interface DefaultSlot {
  slot: string;
  n: number;
  takes: string[];
}

/**
 * A sport's defaults, stored as data (./defaults/<sport>.json): its standard scoring (stat key to points), its categories, its
 * lineup slots and how often lineups lock, and the game specs its Make it a game starts from (`season`, `short`). The specs
 * are in the game spec's shape (docs/PLAN-start-a-game-gpt.md, "The game spec"); nothing in code knows their numbers.
 */
export interface SportDefaults {
  sport: string;
  about: string;
  /** `byPosition`: a stat's points by the sport's position groups, where its standard table says so (FPL's goal is 10 to a
   *  keeper, 4 to a forward); `points` has one of them (soccer's: a midfielder's) until the spec scores by position. */
  scoring: { source: string; points: Record<string, number>; byPosition?: Record<string, Record<string, number>> };
  categories: { source: string; stats: string[] };
  /** `squad`: how many of each position group a roster holds (FPL's 2 goalkeepers, 5 defenders, 5 midfielders, 3 forwards). */
  slots: { source: string; lineup: DefaultSlot[]; bench: number; squad?: Record<string, number> };
  closes: LockCadence;
  specs: Record<string, { about: string; spec: Record<string, unknown> }>;
}

const DEFAULTS: Record<string, SportDefaults> = {
  baseball: baseballDefaults as SportDefaults,
  basketball: basketballDefaults as SportDefaults,
  football: footballDefaults as SportDefaults,
  hockey: hockeyDefaults as SportDefaults,
  soccer: soccerDefaults as SportDefaults,
};

/** A sport's defaults, or null for one that has none yet. */
export function defaultsFor(sportId: string): SportDefaults | null {
  return DEFAULTS[sportId] ?? null;
}
