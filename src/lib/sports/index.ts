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
import { PLAYOFFS } from "./playoffs";
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
export * from "./pace";
import type { PaceBy } from "./pace";
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
  // A check's stand-in league ("football/zt-scf": fake-espn.js) reads as its sport's own, as soccer reads every league; no league
  // of ESPN's starts "zt-".
  return SPORTS.find((s) => s.id === id && (!s.leagues || s.leagues.includes(name) || name?.startsWith("zt-"))) ?? null;
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
  /** `eligible` (step 2.3): a player fills the other positions their roster lists them at (ESPN's `positions`, the ones they've
   *  played), each in their own position group, and those named in `across` in another group too (baseball's SP: a two-way
   *  player). Without it a player fills their roster's one position. */
  /** `ir` (step 2.4): injured reserve on its season games, as the spec's get.ir: `n` places outside the roster's count, each for
   *  someone their roster lists as one of `takes` (ESPN's injury codes as espn.ts injuryOf tags them). */
  slots: { source: string; lineup: DefaultSlot[]; bench: number; squad?: Record<string, number>; eligible?: { source: string; across: string[] }; ir?: { source: string; n: number; takes: string[] } };
  closes: LockCadence;
  /** Step 2.5: its season games' waivers (sportWaivers): `swaps` a week (null, no limit), `daily` a period every game day, `hours`
   *  before the period's first game its claims clear. */
  waivers?: { source: string; swaps: number | null; daily: boolean; hours: 12 | 24 | 48 };
  /** Step 2.6 (BACKLOG 218): how a seat at its own pace keeps up (pace.ts paceFloor): by each game, or by the day (baseball's). A
   *  sport without one (an individual sport's) stays plain own pace. */
  pace?: { source: string; by: PaceBy };
  /** `on`: the season a spec plays on, where it isn't any (L8 part 1's engine items, part 2: a bracket of the playoffs is a
   *  league's playoffs slate's: specContextOf's `playoffs`). */
  specs: Record<string, { about: string; on?: "playoffs"; spec: Record<string, unknown> }>;
  /** Step 2.2 (BACKLOG 214): a league whose fantasy playoffs end before its regular season does (the NFL's at Week 17, before Week
   *  18's rested starters): `endsBefore` of the regular season's last weeks they leave out. A league's own only. */
  playoffs?: { source: string; endsBefore: number };
  /** Step 2.7: the final a game through the playoffs runs to, as people name it ("the Super Bowl", "the World Series": "Through the
   *  Super Bowl"); a league's own over the sport's (`finalSource` says where the words come from). */
  final?: string;
  finalSource?: string;
  /** A league's own, where its standard game differs from the sport's (racing's F1 and IndyCar from NASCAR's): each part given
   *  replaces the sport's, and its specs each of the sport's of the same name (defaultsFor with the league). */
  leagues?: Record<string, Partial<Pick<SportDefaults, "about" | "scoring" | "categories" | "slots" | "specs" | "playoffs" | "final">>>;
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
  // A check's stand-in league ("zt-nfl-slate": fake-espn.js) reads as its sport's own first, as sportOf reads it, so the recorded
  // NFL season plays the NFL's own games (BACKLOG 226's final).
  const name = league ? String(league).split("/").pop()! : undefined;
  const key = name?.startsWith("zt-") ? (sportById(sportId)?.leagues?.[0] ?? name) : name;
  const own = key ? d.leagues?.[key] : undefined;
  // A league's specs over the sport's, one by one (L4 part 1a: F1's own season and short beside racing's pick'em).
  const out = own ? { ...d, ...own, ...(own.specs ? { specs: { ...d.specs, ...own.specs } } : {}) } : d;
  return withLineupSlots(out);
}

/**
 * Step 2.2 (BACKLOG 214): how many of the regular season's last weeks a league's fantasy playoffs leave out (the NFL's 1: its final
 * by Week 17), 0 for none. `league` as "football/nfl"; a check's stand-in league ("football/zt-nfl-slate") reads as its sport's own
 * first, as sportOf and specContextOf read it.
 */
export function playoffsEndBefore(league: string): number {
  const sport = sportOf(league);
  const d = sport ? defaultsFor(sport.id, String(league).split("/")[1]) : null;
  const n = d?.playoffs?.endsBefore;
  return Number.isInteger(n) && n! > 0 ? n! : 0;
}

/**
 * Step 2.7 (docs/PLAN-sports-ready.md): the final a league's game through the playoffs runs to, as people name it ("the Super Bowl",
 * "the Finals", "the World Series", "the Stanley Cup Final", "MLS Cup"), else "the final". `league` as "football/nfl"; a check's
 * stand-in league reads as its sport's own first.
 */
export function finalName(league: string): string {
  const sport = sportOf(league);
  const d = sport ? defaultsFor(sport.id, String(league).split("/")[1]) : null;
  return typeof d?.final === "string" && d.final.trim() ? d.final : "the final";
}

/**
 * Step 2.6 (BACKLOG 218): how a league's seats at their own pace keep up ("game", "day": pace.ts), or null for plain own pace (an
 * individual sport's, or one not built). `league` as "football/nfl"; a check's stand-in league reads as its sport's own.
 */
export function paceBy(league: string): PaceBy | null {
  const sport = sportOf(league);
  const by = sport ? defaultsFor(sport.id, String(league).split("/")[1])?.pace?.by : undefined;
  return by === "game" || by === "day" ? by : null;
}

/**
 * Cast properties (docs/PLAN-cast-properties.md chunk 5): a sport's standard games start its lineup by position, its defaults'
 * slots as the spec's count.slots (football's QB, 2 RB, 2 WR, TE, a W/R/T, K, DEF; the NBA's PG, SG, G, SF, PF, F, 2 C, 2 Util), on
 * each spec counting exactly that many. A slot's `takes` are ESPN positions, which a castaway's stamped `position` (its roster's)
 * names, or position groups ("guards", "batters"), which their stamped group (state.statGroups) names: SlotLogic.fits reads both.
 * Football's since chunk 5; every sport's since step 2.3 (docs/PLAN-sports-ready.md: the NBA's, MLB's and NHL's, soccer's
 * formation). Not a lineup of one slot taking everyone (golf's golfers, racing's drivers): it constrains nothing.
 */
const SLOTTED = new WeakMap<SportDefaults, SportDefaults>();
function withLineupSlots(d: SportDefaults): SportDefaults {
  if (!slotted(d.slots?.lineup)) return d;
  // The same defaults read twice are the same object (college's are football's own).
  const had = SLOTTED.get(d);
  if (had) return had;
  const total = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  const slots = d.slots.lineup.map((s) => ({ label: s.slot, of: "position", values: [...s.takes], n: s.n }));
  // Step 2.4 (docs/PLAN-sports-ready.md): its IR places on each such game with a draft (a season's).
  const ir = d.slots.ir ? { n: d.slots.ir.n, takes: [...d.slots.ir.takes] } : null;
  const specs = Object.fromEntries(
    Object.entries(d.specs).map(([id, x]) => {
      const c = (x.spec as { count?: { start?: number; best?: number } }).count;
      const fits = c && (c.start === total || c.best === total);
      const get = (x.spec as { get?: { by?: string; each?: number } }).get;
      const withIr = ir && get?.by === "draft" ? { get: { ...get, ir } } : {};
      // Step 2.5: its waivers on each such game with a draft (sportWaivers), unless the spec says its own.
      const extras = (x.spec as { extras?: { waivers?: unknown } }).extras;
      const waivers = get?.by === "draft" && !extras?.waivers ? sportWaivers(d, get.each, (x.spec as { closes?: string }).closes) : null;
      const withWaivers = waivers ? { extras: { ...extras, waivers } } : {};
      return [id, fits ? { ...x, spec: { ...x.spec, count: { ...c, slots }, ...withIr, ...withWaivers } } : x];
    })
  );
  const out = { ...d, specs };
  SLOTTED.set(d, out);
  return out;
}

/**
 * Step 2.5 (docs/PLAN-sports-ready.md, BACKLOG 219): a team sport's waivers as the spec says them (extras.waivers), from its defaults'
 * `waivers`: a window every episode (a week), a rolling order, free agency, `swaps` a week (null: the team's size, no limit), and
 * `daily` (a period every game day: claims clear that morning, `hours` before its first game) for the NBA's, NHL's and MLB's lineups
 * that lock at each game (`closes`; best ball's run by the week). Null for a
 * sport with none (its games keep waivers off).
 */
export function sportWaivers(d: Pick<SportDefaults, "waivers">, each: number | undefined, closes?: string): Record<string, unknown> | null {
  const w = d.waivers;
  if (!w) return null;
  const team = Number.isInteger(each) && each! >= 1 ? each! : null;
  const swaps = w.swaps === null ? team ?? 1 : team === null ? w.swaps : Math.min(w.swaps, team);
  return {
    feel: "balanced", replace: "never", short: null,
    windows: { schedule: "everyEpisode", every: 3, swaps },
    order: "rolling", hours: w.hours, freeAgency: true, autoFill: true,
    // Every game day only on a lineup that locks at each game (best ball has none: its waivers run by the week).
    ...(w.daily && closes === "game" ? { daily: true } : {}),
  };
}

/** Whether a default lineup's slots say anything: more than one slot (one taking everyone, golf's six golfers, holds nobody back). */
export function slotted(lineup: DefaultSlot[] | null | undefined): boolean {
  return Array.isArray(lineup) && lineup.length > 1;
}

/**
 * Step 2.3: what else someone fills besides their roster's position, by their league's rule (its defaults' `slots.eligible`): the
 * positions their roster lists them at (ESPN's `positions`) in their own position group, and those the rule names `across` in
 * another, with that position's group (a two-way player listed SP fills SP and the pitchers' P). Stamped per read as
 * state.castEligible (cast-props.ts) and read by SlotLogic.fits. [] for a league with no rule (the NBA's and NHL's rosters list
 * one position), a role the sport doesn't know, or nothing listed.
 */
export function eligibleFor(league: string, role: string | null | undefined, listed: readonly string[] | null | undefined): string[] {
  const sport = sportOf(league);
  const rule = sport ? defaultsFor(sport.id, String(league).split("/")[1])?.slots?.eligible : null;
  const own = role ? sport?.position(sport.positionKey(role) ?? "") : null;
  if (!sport || !rule || !own || !listed?.length) return [];
  const out: string[] = [];
  const add = (v: string) => { if (v !== own.key && !out.includes(v)) out.push(v); };
  for (const said of listed) {
    const p = sport.position(sport.positionKey(said) ?? "");
    if (!p) continue;
    if (p.group === own.group) add(p.key);
    else if (rule.across.includes(p.key)) {
      add(p.key);
      add(p.group);
    }
  }
  return out;
}

/**
 * What a game spec on a sport is checked against (the game spec's ctx, its data-can-settle rule: L1 part 4a): the stats it can
 * score or ask about (a place's marked: it scores only by place), the stats a categories game can name (L4 part 1b: a rate's too,
 * marked, and which way is better), its position groups (a stat's points by position name them),
 * its bouts' formats (byFormat) and its standard roster from its defaults (the lineup's starters and the bench), which raise a
 * show's size limits; and its shape, what its games' finals say (a team game's a side's win, a total and a margin; a field's
 * and a card's someone's win). L4 part 2: its periods (squares pay at their ends) and, a sport whose cards are draws (tennis's),
 * the draws a bracket can be of. `league` as defaultsFor's (racing's F1); else the sport's own first. L8 part 1's engine items,
 * part 2: a team sport's season made of a league's playoffs (`playoffs`: a playoffs slate) has them as its one draw.
 */
export function specContextOf(sport: AnySport, league?: string, o: { playoffs?: boolean } = {}): { stats: { key: string; label: string; place?: true }[]; categories: { key: string; label: string; better: "higher" | "lower"; rate?: true }[]; positions: { key: string; label: string }[]; formats: { key: string; label: string }[]; shape: "team" | "field" | "card"; periods: { word: string; plural: string; regulation: number }; draws?: { key: string; label: string }[]; sizes?: { starters: number; bench: number } } {
  const d = defaultsFor(sport.id, league ?? sport.leagues?.[0]);
  const positions = sport.groups.map((g) => ({ key: g.key, label: g.label }));
  // What a game's final says (L1 part 4b): a team game's sides have a total and a margin; a field and a card have a winner.
  const shape = sport instanceof TeamSport ? ("team" as const) : sport instanceof FieldSport ? ("field" as const) : ("card" as const);
  const periods = { word: sport.periods.word, plural: sport.periods.plural, regulation: sport.periods.regulation };
  // A card whose bouts are in draws (tennis's: Tennis.draws) has its draws, the sport's positions (men's singles...), for a bracket.
  const draws = typeof (sport as { draws?: unknown }).draws === "function" ? sport.positions.map((p) => ({ key: p.key, label: p.label })) : sport instanceof TeamSport && o.playoffs ? [{ key: PLAYOFFS as string, label: "Playoffs" }] : null;
  const ctx = { stats: sport.specStats(), categories: sport.specCategories(), positions, formats: sport.formats.map((n) => ({ key: String(n), label: `${n} ${sport.periods.plural}` })), shape, periods, ...(draws ? { draws } : {}) };
  return d ? { ...ctx, sizes: { starters: d.slots.lineup.reduce((n, s) => n + s.n, 0), bench: d.slots.bench } } : ctx;
}
export * from "./slate";
export { PLAYOFFS, roundOf, seriesOf, gameWinner, isBracket, playoffsFacts, playoffsStart, type PlayoffRound, type PlayoffGame, type PlayoffSeries } from "./playoffs";
