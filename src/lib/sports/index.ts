// The sports (docs/PLAN-start-a-game-gpt.md track L): one class per sport, found by ESPN's sport slug, the first half of a
// league's path ("baseball" of "baseball/mlb", and, its box and feeds another, "baseball/college-baseball"; "basketball" of
// "basketball/nba" and "basketball/wnba"; a sport can name the leagues it reads, so a slug can have more than one: college
// basketball is its own feed, an instance a league, the men's halves and the women's quarters; "football" of "football/nfl"
// and, its plays written otherwise, "football/college-football" (college-football.ts); "hockey" of "hockey/nhl", not college
// hockey, which ESPN carries as scores; "soccer" of every soccer league, which ESPN writes alike: "soccer/eng.1", "soccer/usa.1",
// "soccer/uefa.champions"); and the field sports (FieldSport: a field and its standings): "golf" of its stroke-play tours, "golf/pga",
// "golf/lpga", "golf/eur", "golf/liv", "golf/champions-tour", "golf/ntw" and the Olympics' (golf.ts; not TGL's match play); "racing" of
// its five series, an instance a series ("racing/f1", "racing/nascar-premier", "racing/nascar-secondary", "racing/nascar-truck",
// "racing/irl": racing.ts); and the bout sports (BoutSport: one-on-one bouts): "mma" of every promotion ESPN carries, which it
// writes alike ("mma/ufc", "mma/pfl", "mma/lfa": mma.ts; only the UFC's have statistics and timed plays), and "tennis" of both
// tours, all ESPN carries ("tennis/atp", "tennis/wta": tennis.ts; an event's draws of matches, their scores alone).
// A game's clock for someone (clock.ts) and a game live on the phone (live.ts) are L2's.
import { Baseball } from "./baseball";
import { CollegeBaseball } from "./college-baseball";
import { Basketball, CollegeBasketball, HALVES } from "./basketball";
import { Football } from "./football";
import { CollegeFootball } from "./college-football";
import { Hockey } from "./hockey";
import { Soccer } from "./soccer";
import { Golf } from "./golf";
import { RACING_SERIES, Racing } from "./racing";
import { MMA } from "./mma";
import { Tennis } from "./tennis";
import baseballDefaults from "./defaults/baseball.json";
import basketballDefaults from "./defaults/basketball.json";
import footballDefaults from "./defaults/football.json";
import hockeyDefaults from "./defaults/hockey.json";
import soccerDefaults from "./defaults/soccer.json";
import golfDefaults from "./defaults/golf.json";
import racingDefaults from "./defaults/racing.json";
import mmaDefaults from "./defaults/mma.json";
import tennisDefaults from "./defaults/tennis.json";
import { FieldSport, TeamSport } from "./sport";
import type { BoutSport, LockCadence } from "./sport";

export * from "./sport";
export * from "./clock";
export * from "./live";
export * from "./live-event";
export * from "./spec";
export * from "./final";
export * from "./points";
export * from "./locks";
export { Baseball } from "./baseball";
export { CollegeBaseball } from "./college-baseball";
export { Basketball, CollegeBasketball } from "./basketball";
export { Football, defenseId } from "./football";
export { CollegeFootball } from "./college-football";
export { Hockey } from "./hockey";
export { Soccer, plainName } from "./soccer";
export { Golf, GOLF_LEAGUES, boardCounts, holeKind, roundStats, toParOf } from "./golf";
export { Racing, RACING_SERIES, coreFilled, coreReads, coreStats, weekendOver, type Series } from "./racing";
export { MMA, methodOf, coreFighterStats, mmaCoreStats, mmaCenterStats, playsEnd } from "./mma";
export { Tennis, boardMatches, matchOver, matchSuspended, noteWinner, setComplete, setOf, type DrawEntry, type DrawStanding } from "./tennis";

/** A sport of any shape: a team sport's box score and plays, a field's standings, or a card's bouts. */
export type AnySport = TeamSport | FieldSport | BoutSport;

// A sport's own leagues first: a sport slug can have more than one (basketball's NBA and WNBA, and college's two), each naming
// the leagues it reads; sportById gives the first, the sport's own.
const SPORTS: AnySport[] = [new Baseball(), new CollegeBaseball(), new Basketball(), new CollegeBasketball("mens-college-basketball", "Men's college basketball", HALVES), new CollegeBasketball("womens-college-basketball", "Women's college basketball"), new Football(), new CollegeFootball(), new Hockey(), new Soccer(), new Golf(), ...RACING_SERIES.map((s) => new Racing(s)), new MMA(), new Tennis()];

/** The sport by its id ("baseball"): its first, the one for its pro leagues ("basketball": the NBA's and WNBA's), or null for
 *  one not built yet. */
export function sportById(id: string): AnySport | null {
  return SPORTS.find((s) => s.id === id) ?? null;
}

/** The sport an ESPN league plays ("baseball/mlb" is Baseball, "hockey/nhl" Hockey, "basketball/mens-college-basketball"
 *  college's halves), or null for one not built yet. */
export function sportOf(league: string): AnySport | null {
  const [id, name] = String(league).split("/");
  return SPORTS.find((s) => s.id === id && (!s.leagues || s.leagues.includes(name))) ?? null;
}

/** Every sport built so far. */
export function allSports(): AnySport[] {
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
  /** The spec's own tables (score.by 'stats', L1 part 4a: the specs carry them as they are here). `byPosition`: a stat's points
   *  by the sport's position groups, where its standard table says so (FPL's goal is 10 to a keeper, 4 to a forward); `points`
   *  has one of them (soccer's: a midfielder's). `byPlace`: a place stat's points by place or range ("1", "4-10"), for each
   *  place stat the standard table scores (golf's POS, the tied each taking the place's; racing's POS, SPR, QUAL); never in
   *  `points`. `byFormat`: a stat's points in a bout of another format, by its rounds (tennis's best of five:
   *  `{ "5": { GW: 2 } }`), where its standard table says so; `points` is the usual format's (best of three). */
  scoring: { source: string; points: Record<string, number>; byPosition?: Record<string, Record<string, number>>; byPlace?: Record<string, Record<string, number>>; byFormat?: Record<string, Record<string, number>> };
  categories: { source: string; stats: string[] };
  /** `squad`: how many of each position group a roster holds (FPL's 2 goalkeepers, 5 defenders, 5 midfielders, 3 forwards). */
  slots: { source: string; lineup: DefaultSlot[]; bench: number; squad?: Record<string, number> };
  closes: LockCadence;
  specs: Record<string, { about: string; spec: Record<string, unknown> }>;
  /** A league's own, where its standard game differs from the sport's (racing's F1 and IndyCar from NASCAR's): each part given
   *  replaces the sport's, and its specs each of the sport's of the same name (defaultsFor with the league). */
  leagues?: Record<string, Partial<Pick<SportDefaults, "about" | "scoring" | "categories" | "slots" | "specs">>>;
}

const DEFAULTS: Record<string, SportDefaults> = {
  baseball: baseballDefaults as SportDefaults,
  basketball: basketballDefaults as SportDefaults,
  football: footballDefaults as SportDefaults,
  hockey: hockeyDefaults as SportDefaults,
  soccer: soccerDefaults as SportDefaults,
  golf: golfDefaults as SportDefaults,
  racing: racingDefaults as SportDefaults,
  mma: mmaDefaults as SportDefaults,
  tennis: tennisDefaults as SportDefaults,
};

/** A sport's defaults, or null for one that has none yet; with a league ("f1", or "racing/f1"), that league's own parts in
 *  place of the sport's (racing's F1 and IndyCar). */
export function defaultsFor(sportId: string, league?: string): SportDefaults | null {
  const d = DEFAULTS[sportId];
  if (!d) return null;
  const own = league ? d.leagues?.[String(league).split("/").pop()!] : undefined;
  // A league's specs over the sport's, one by one (L4 part 1a: F1's own season and short beside racing's pick'em).
  return own ? { ...d, ...own, ...(own.specs ? { specs: { ...d.specs, ...own.specs } } : {}) } : d;
}

/**
 * What a game spec on a sport is checked against (the game spec's ctx, its data-can-settle rule: L1 part 4a): the stats it can
 * score or ask about (a place's marked: it scores only by place), the stats a categories game can name (L4 part 1b: a rate's too,
 * marked, and which way is better), its position groups (a stat's points by position name them),
 * its bouts' formats (byFormat) and its standard roster from its defaults (the lineup's starters and the bench), which raise a
 * show's size limits; and its shape, what its games' finals say (a team game's a side's win, a total and a margin; a field's
 * and a card's someone's win). `league` as defaultsFor's (racing's F1); else the sport's own first.
 */
export function specContextOf(sport: AnySport, league?: string): { stats: { key: string; label: string; place?: true }[]; categories: { key: string; label: string; better: "higher" | "lower"; rate?: true }[]; positions: { key: string; label: string }[]; formats: { key: string; label: string }[]; shape: "team" | "field" | "card"; sizes?: { starters: number; bench: number } } {
  const d = defaultsFor(sport.id, league ?? sport.leagues?.[0]);
  const positions = sport.groups.map((g) => ({ key: g.key, label: g.label }));
  // What a game's final says (L1 part 4b): a team game's sides have a total and a margin; a field and a card have a winner.
  const shape = sport instanceof TeamSport ? ("team" as const) : sport instanceof FieldSport ? ("field" as const) : ("card" as const);
  const ctx = { stats: sport.specStats(), categories: sport.specCategories(), positions, formats: sport.formats.map((n) => ({ key: String(n), label: `${n} ${sport.periods.plural}` })), shape };
  return d ? { ...ctx, sizes: { starters: d.slots.lineup.reduce((n, s) => n + s.n, 0), bench: d.slots.bench } } : ctx;
}
