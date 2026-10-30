// Types for game-spec/index.js: a game as data (docs/PLAN-start-a-game-gpt.md, "The game spec", step A1). Values marked
// sports are in the schema now and built by the sports branch (VOCAB says which); today's engine plays the rest (questions
// since step A4).
import type { LeagueSettings } from "../types";

export type PresetId = "outlast" | "weekly-lineup" | "survival-pool" | "weekly-calls" | "weekly-bingo";
export type LeagueTypeId = "classic-draft" | "active-roster" | "pickem" | "weekly-calls" | "weekly-bingo" | "questions";
/** Who builds a value: today's engine, a later step, the sports branch, or no step yet. */
export type Builder = "now" | "sports" | "later";

/** A start at a phase of the season's rulebook (A3): { phase } while it waits for it, { phase, at } once data says where it
 *  starts (at: the episode it plays from). */
export interface PhaseFrom {
  phase: string;
  at?: number;
}

export interface SpecSpan {
  /** The episode it starts at, or a phase start. */
  from: number | PhaseFrom;
  /** Its last episode, or null: the season's end. */
  to: number | null;
}

export interface SpecPool {
  of: "cast";
  /** null or { stillIn: true }: today. sports: { teams }. later: { group }. */
  where: null | { stillIn: true } | { teams: string[] } | { group: string };
}

export type SpecGet =
  /** A10 part 3: order "draw" deals each team at random when the draft starts (either ownership); across spreads a draft over
   *  the cast's groups as the data has them then. Part 3b: order "auction" (exclusive) sells the cast by sealed bids; a budget
   *  beside any other order is a salary cap, prices from the data. */
  | { by: "draft"; each: number; order: "snake" | "blind" | "draw" | "auction"; own: "exclusive" | "shared"; groups?: GroupSlots; across?: DraftAcross; budget?: DraftBudget; keep?: DraftKeep }
  /** A10 part 2's second: a second pick beside the first, open every episode, counting on a night two or more go home (void, or
   *  counts like the first, on a night only one goes). */
  /** A11 part 2: repeat "never", nobody picked twice in the game, and its fallback for a night you've picked everyone still in
   *  (miss: a missed pick; skip: nothing counts that night). */
  | { by: "pick"; each: 1; repeat: "cycle" | "never"; second?: { fallback: "void" | "counts" }; fallback?: "miss" | "skip" }
  | { by: "card" }
  | { by: "none" }
  /** sports */
  | { by: "squares" };

export type SpecCount =
  | { start: number }
  | { all: true }
  | { pick: true }
  /** A9 part 2: best ball, your best n each episode (no lineups); shows and sports. */
  | { best: number }
  | null;

/** A9 part 2: when a draft's points multiply: one episode, a run of them (to null or left out: the season's end), a phase of
 *  the season (where data says it starts), or its finale (the episode that ends it). An episode in two multiplies by both. */
export type SpecWhen = { times: number } & (
  | { episode: number }
  | { from: number; to?: number | null }
  | { phase: string }
  | { finale: true }
);

export type SpecScore =
  /** points: moment id -> points over the rulebook's own; null = its own. A9 part 2: a lineup's captain, one of your starters you
   *  name each episode, whose points multiply by `times`; and when the points multiply (`times`). */
  | { by: "moments"; points: Record<string, number> | null; captain?: { times: number }; times?: SpecWhen[] }
  /** A9 part 2's reverse: the earlier they go home the more (1, plus 1 for everyone who outlasts them). */
  | { by: "place"; reverse?: true }
  /** A10 part 2: lives (a wrong pick costs one, out at none), a buyback (someone out before `before` is back in from the next
   *  episode with one life, `cost` points off their total, `times` in a game), mulligans (the first n wrong picks forgiven). */
  | { by: "survive"; means: "staysIn" | "scores"; points: number; lives?: number; buyback?: PoolBuyback; mulligans?: number }
  /** A9: points per line (1 when it's left out). */
  | { by: "lines"; points?: number }
  /** Only the ask's questions (A4): Weekly Calls (the show's calls), a game of questions. A9's parlays: someone right on every
   *  one of `of` in the same window has their points on them multiplied by `times`. */
  | { by: "answers"; parlays?: SpecParlay[] }
  /** sports: the Sport's stat keys -> points */
  | { by: "stats"; points: Record<string, number> };

/** A9: a parlay of a game of questions' plain questions (2 to 4, asked the same way), its multiplier when all are right. */
export interface SpecParlay {
  of: string[];
  times: number;
}

export interface SpecRank {
  /** total, streak: today; standing (A10 part 2): last one standing, a pool with lives; worth (A10 part 3c): a stock market's,
   *  cash plus the team at today's prices. sports: matchups, categories, roto. */
  by: "total" | "streak" | "standing" | "worth" | "matchups" | "categories" | "roto";
  /** A11 part 1, beside a draft: a race (the first to `to` points wins, the game ending there) and players knocked out. */
  race?: { to: number };
  cut?: { at: { every: number } | { episode: number } | { phase: string }; out?: number | "half"; tie?: "keep" | "all"; quiet?: "cut" | "skip" }[];
  /** A11 part 2, beside last one standing: once one or none is left, the game ends there or plays on (a draft's default ends, a
   *  pool's plays); a pool's night everyone left goes out (all out by points, the default; all out sharing the win; all back). */
  oneLeft?: "ends" | "plays";
  allOut?: "points" | "share" | "back";
}

/** A10 part 2: a pool's buyback. before: a phase of the season or an episode (someone out before it can buy back), or null (any
 *  time). */
export interface PoolBuyback {
  times: number;
  before: { phase: string } | { episode: number } | null;
  cost: number;
}

export type SpecSettle =
  /** out: who goes home (asked once: the first in the game; a group answer: the groups they were on); stays: who doesn't (an
   *  episode's); winner, placed (`place`th) and top (in the top `place`): the season's. */
  | { by: "results"; take: "winner" | "out" | "placed" | "top" | "stays" | "order" | "split" | "outlast"; place?: number }
  /** In the episode (asked once, over the game; over a window, A7): whether it happened, how many times (a per-unit moment's
   *  units), who it happened to (a group answer: their groups), who most (A6), first (A7: who, or which episode). */
  | { by: "moment"; moment: string; take: "happened" | "count" | "who" | "most" | "first" | "order" }
  /** A8: each person's points by the game's rules in the episode or window: who scored most, or the leaderboard. */
  | { by: "points"; take: "most" | "order" }
  /** A7: a phase of the season (not its first): the episode it starts (asked once), or whether it starts in the window. */
  | { by: "phase"; phase: string; take: "starts" | "happened" }
  /** A secret role (A6): who held it, who held it among those still in at the end, how many of them. */
  | { by: "role"; role: string; take: "who" | "end" | "count" }
  /** The show's calls (Call it's: calls.ts), Weekly Calls' one question. */
  | { by: "calls" }
  /** sports */
  | { by: "final"; take: "winner" | "total" | "margin" }
  /** sports */
  | { by: "stat"; stat: string; take: "most" | "least" | "value" };

/** A question answered before its lock (A4), each settled by data. */
export interface SpecQuestion {
  /** Its key, for its answers (game_answers.question): letters, digits, ".", "_" or "-", up to 40. */
  id: string;
  ask: string;
  /** group: a tribe or team (A6). order, confidence, chips, split, pairs (A8). side: sports. calls: the show's calls (Weekly
   *  Calls'). */
  answer: "person" | "group" | "side" | "yesNo" | "number" | "overUnder" | "choice" | "calls" | "order" | "confidence" | "chips" | "split" | "pairs";
  /** A8: an order scores each one within this many places of right (0: exactly). */
  within?: number;
  /** A8: a chips answer's chips to spread. */
  chips?: number;
  /** A8: a pairs answer's pairs, drawn from who's in at the game's start. */
  pairs?: number;
  /** A8: the most points you can stake on your answer: right, its points and the stake; wrong, the stake lost. A9: "total", any
   *  of your points as they stand when you answer. */
  wager?: number | "total";
  /** A9: split, a pot for each window split between everyone right (by what each would have earned); only, a right answer scores
   *  only when nobody else's does. */
  share?: "split" | "only";
  /** A9 (asked each, every N or by phase): a window nobody earns anything on carries its points into the next. */
  rollover?: true;
  /** A9 (asked once, closing at the finale): its points shrink by `points` for each of the game's episodes that had started when
   *  the answer was made, or each change made once the game started; never below 0. */
  shrink?: { points: number; per: "episode" | "change" };
  /** A right answer's (a right pick's). */
  points: number;
  settle: SpecSettle;
  /** once (for the game; the default) | each (every episode it plays) | every (A7: each run of `every` episodes) | phase (A7:
   *  once a phase of the season). Its answers are for the window they open at. */
  asked?: "once" | "each" | "every" | "phase";
  /** A7, asked every: how many episodes each run is (2 to 10). */
  every?: number;
  /** A7, asked each: about that episode and the next over - 1 (2 to 10). */
  over?: number;
  /** start: when its window's first episode starts (asked each, every or by phase) or the game's first does (the default) |
   *  finale: the season's last (asked once). */
  closes?: "start" | "finale";
  /** A person or group answer: how many to name (default 1), each right one scores. */
  pick?: number;
  /** A person answer: the cast still in (default), or your own team (a draft's). */
  from?: "cast" | "team";
  /** overUnder's line; null: the wizard asks (or ESPN's, the sports branch). */
  line?: number | null;
  /** choice's options. */
  options?: string[];
  /** A6: asked about each person still in when it closes, answered { castawayId: answer } (a yes or no, a number, an over/under or
   *  a choice for each), settled for each by their own moment or whether they go home or stay. */
  each?: "person";
  /** F3 part 2: a group answer asked each episode, on a season played in groups the league doesn't hold (pairs, from the format's
   *  state over time): void (the default) when its groups aren't sure, no points either way; carry-on follows the people;
   *  next-stage is A12's. */
  fallback?: "void" | "carry-on" | "next-stage";
}
/** A question as a spec holds it once it's whole (fullSpec): asked and closes always said. */
export type Question = SpecQuestion & { asked: "once" | "each" | "every" | "phase"; closes: "start" | "finale" };

/** What a game's results say, for grading its questions (answers.js). */
export interface AnswerFacts {
  from: number | null;
  to: number | null;
  over: boolean;
  /** Each of the game's episodes with results (answers.js has what each part says). */
  episodes: Map<
    number,
    {
      out: string[] | null;
      events: Map<string, number> | null;
      /** A6's (AnswerLogic.facts always gives them; the grader reads a missing one as nobody). */
      who?: Map<string, Map<string, number>> | null;
      in?: string[];
      groups?: Map<string, string | null>;
      roles?: Map<string, string | null> | null;
      /** A8: each person's points in it by the game's rules, once the full results are in. */
      points?: Map<string, number> | null;
    }
  >;
  winner: string | null;
  ended: boolean;
  order: string[] | null;
  names: Map<string, string>;
  groupNames?: Map<string, string>;
  /** A7: each phase's start the viewer has seen; the game's later phase windows; the last episode they've seen with results. */
  phases?: Map<string, number>;
  windows?: { phase: string; at: number; from: number }[];
  seen?: number;
  /** A8: who was in at the game's first episode (a pairs question's pairs are drawn from them). */
  startIn?: string[];
  /** A8: the finalists' jury votes, once the season is over. */
  jury?: Map<string, number> | null;
  /** F3 part 2: the groups a group question asked each episode reads from the format's state over time, by episode, on a
   *  season played in groups the league doesn't hold (format-timeline.js groupFacts). */
  formatGroups?: Map<number, FormatGroups>;
}
/** One episode's groups from the format's state over time (F3 part 2): those offered at its lock (going into it), each person's,
 *  whether that was sure, and once it has a report, how it was played (sure, and the offered groups that played it as offered). */
export interface FormatGroups {
  offered: { id: string; name: string; members: string[] }[];
  byCastaway: Map<string, string>;
  lockSure: boolean;
  why: string[];
  played: { sure: boolean; held: Set<string> } | null;
  /** F4: why an episode the league's own groups would otherwise have answered is off: 'unknown' (played in pairs nobody knew
   *  going in), 'apart' (played without groups, or nobody in one going in); null on the timeline's own. */
  off?: "unknown" | "apart" | null;
}
/** How a question stands: still to settle, off (nobody went home, right on the line), or what was right (and a count; the
 *  groups the right people were on; a question about each person, each one's verdict by castaway id). */
export type Verdict =
  | { state: "waiting" }
  | { state: "off"; why: string }
  | {
      state: "known";
      right: string[];
      value?: number;
      groups?: string[];
      each?: Record<string, Verdict>;
      /** A8, a ranking: the places each one could hold (0-based; ties share a block). */
      places?: Record<string, [number, number]>;
      /** F3 part 2, a group answer on the timeline's groups: the offered groups that played the episode as offered (a pick of
       *  any other is void). */
      held?: string[];
    };

export interface SpecWaivers {
  feel: "casual" | "balanced" | "competitive";
  replace: "always" | "whenShort" | "windows" | "never";
  /** whenShort's N; null: the recommended (starting spots - 1). */
  short: number | null;
  windows: { schedule: "everyEpisode" | "every" | "manual"; every: number; swaps: number };
  order: "rolling" | "leastPoints" | "mostPoints";
  hours: 12 | 24 | 48;
  freeAgency: boolean;
  autoFill: boolean;
}

export interface SpecExtras {
  /** A draft's mid-season moves; null: none (shared Outlast, no draft). */
  waivers: SpecWaivers | null;
  /** Side bets ("Predictions", graded by whoever runs the game): each new one's points; null: off. */
  bets: { points: number } | null;
  /** A Survival Pool's weekly Who goes home? call (the public pool): counted, not ranked. */
  calls: boolean;
  /** A draft's room; null: no draft. */
  draft: { at: string | null; timer: 0 | 60 | 120; away: "wait" | "queue" } | null;
  /** Who can join; null: the recommended (open where castaways can be on several teams, else ask). */
  join: "open" | "ask" | "locked" | null;
  /** A lineup's starters stay hidden until the lock. */
  hideStarters: boolean;
  /** Lock it down: nobody new joins, the rules don't change for the season. */
  lockedDown: boolean;
  /** A7, a game of questions': someone who hasn't seen an episode answers its questions until they have, up to these hours past
   *  its air time; null: none. */
  lateLock: { hours: 12 | 24 | 48 | 72 } | null;
  /** A10 part 4b: a team two people share: how many accounts can hold one seat (2 to MAX_SEAT_PEOPLE). Left out: one a seat. */
  seats?: { people: number };
}

export interface GameSpec {
  spec: 1;
  preset: PresetId | null;
  span: SpecSpan;
  pool: SpecPool;
  get: SpecGet;
  count: SpecCount;
  score: SpecScore;
  rank: SpecRank;
  ask: Question[];
  /** start: today. sports: daily, weekly. */
  closes: "start" | "daily" | "weekly";
  extras: SpecExtras;
}

/** A spec as written: anything left out is the preset's, or the defaults (fullSpec). */
export type SpecInput = Partial<Omit<GameSpec, "extras" | "ask">> & { extras?: Partial<SpecExtras>; ask?: SpecQuestion[] };

/** A10 part 1: a draft's group slots (get.groups): a slot holds a pair or a team the show forms, picked after the episode that
 *  showed it, riding with it while it lasts and dropping when it changes (state-logic.js GroupSlotLogic). */
export interface GroupSlots {
  /** 1 or 2 (MAX_GROUP_SLOTS). */
  slots: number;
  /** shared: anyone can hold the same group; exclusive: one team's at a time, while the groups on offer cover every slot. */
  own: "shared" | "exclusive";
  /** Whether a slot can change its group while that group lasts. */
  swap: boolean;
  /** An episode whose groups at the lock or as played aren't sure: void for the slot, or follow the people. */
  fallback: "void" | "carry-on" | "next-stage";
  /** A group's points: its members' mean (a slot scores like one more person), or their sum. */
  points: "mean" | "sum";
}

/** A10 part 3b: a draft's prices (get.budget). Everyone's `total`; `floor` the lowest price or bid. An auction (order
 *  "auction"): what a castaway costs is the winning bid, and a team the bids didn't fill is filled from what's left at the floor
 *  (`fallback` fill) or left short. A salary cap (any other order): each castaway's price from their points so far by the game's
 *  own rules, `floor` to `ceiling` by where they stand, a team's prices together up to `total` when it's drafted or changed;
 *  someone gone home counts as nothing or the price they went home at (`gone`). */
export interface DraftBudget {
  total: number;
  floor: number;
  ceiling?: number;
  gone?: "zero" | "last";
  fallback?: "fill" | "short";
  /** A10 part 3c: a stock market, buying and selling each week at the data's prices (an auction's too, after its bids), each
   *  trade costing `fee`; its trades are its waiver windows' swaps. */
  trade?: { fee: number };
  /** What the draft's money left over does: cash to trade with (a market's default), lost, or bids on waivers (no step yet). */
  left?: "cash" | "lost" | "bids";
}

/** A10 part 4: keepers across seasons (get.keep): a game that continues `from` (the couch's game on an earlier season of the
 *  show), each person keeping up to `each` of their team there who are on this season's cast (named before the draft; someone
 *  not back frees the place for the draft), the draft filling the rest. A keeper costs a place on the team, one of a snake's
 *  earliest rounds, or their price at the draft (a salary cap's or a stock market's); someone who names nobody keeps their best
 *  who are back, or nobody (state-logic.js KeeperLogic). */
export interface DraftKeep {
  each: number;
  from: string;
  cost: "place" | "round" | "price";
  fallback: "best" | "none";
}

/** A10 part 3: a draft spread across the cast's groups (get.across): no more than ceil(each / groups) from one group, at least
 *  floor(each / groups) from each while it has someone to take, read from the groups the data has people on when it drafts
 *  (state-logic.js SpreadLogic). gender waits on data that says who is which (no show records it). */
export interface DraftAcross {
  of: "group" | "gender";
  /** A drafted castaway who changes group, or whose group ends (a swap, the merge): still yours. */
  then: "keep";
}

/** What a spec refers to, in the show's words, and the data that settles it. All optional. */
export interface SpecContext {
  /** "Survivor 51", "the Red Sox–Yankees series". */
  show?: string;
  /** What the show calls one of its people, lower case ("castaway"), and many ("castaways"). */
  castaway?: string;
  castaways?: string;
  /** What one part of the season is called. */
  part?: { singular: string; plural: string };
  /** The scoring groups' labels (a format's eventCategories). */
  groups?: string[];
  /** The show's moments (rulebook-moments.js momentsFor, or a format's events). */
  moments?: { id: string; label?: string; defaultPoints?: number | { exclusive: number; shared: number }; answeredBy?: "research" | "league"; auto?: boolean; off?: boolean }[];
  /** The sport's stat keys (the Sport's, on the sports branch); a label is a singular noun ("home run"). */
  stats?: ({ key: string; label?: string } | string)[];
  /** false when the show's results don't say who goes home or wins. */
  results?: boolean;
  /** false when nobody wins the show (no way out that means winning): who wins, where they finish and a top can't settle. */
  winner?: boolean;
  /** Who settles the show's calls: its results, or (a talk show) the couch, whose word only a league's own keeps. */
  calls?: "results" | "couch";
  /** The season's rulebook's phases, in order (its blocks' season.phases): a phase start is one of them, never the first. */
  phases?: { id: string; name?: string }[];
  /** The show's secret roles (its secretRole twists': ["Traitor", "Faithful"]): a role settles only if it's one (A6). */
  roles?: string[];
  /** false when nobody on the show is in a group (its cast has none): no group answers (A6). */
  grouped?: boolean;
  /** false when no jury decides the finale: no jury vote split (A8). */
  jury?: boolean;
  /** A10 part 1: how many can be drafted where the game drafts, and how many people are on its couch: an exclusive draft has to
   *  cover every pick (covers), else it's shared. Either left out: not counted. */
  pool?: number;
  couch?: number;
  /** A10 part 4b: how many teams the couch makes when some share one (extras.seats): counted in place of couch. */
  teams?: number;
  /** A10 part 4: the couch's games on the show's earlier seasons (league ids, or { id }): keepers come from one of them. */
  games?: (string | { id: string })[];
  /** A10 part 3: how many can be drafted in each of the cast's groups where the game drafts: an exclusive spread draft has every
   *  group cover its share of every team. */
  poolGroups?: number[];
  /** A10 part 3: what the show calls one of its groups, lower case ("tribe"), for the words. */
  group?: string;
}

export interface SpecProblem {
  at: string;
  problem: string;
}
export interface SpecWait {
  at: string;
  /** The step that builds it; null: every part is built, but no game plays them together yet. */
  step: Exclude<Builder, "now"> | null;
  problem: string;
}

export interface SpecDescription {
  /** The preset's name ("Weekly Lineup"), or null. */
  name: string | null;
  sentence: string;
  /** The sentence in pieces, with the part of the spec each says. */
  parts: { text: string; at: "preset" | "about" | "get" | "count" | "span" | "score" | "ask" | "rank" | null }[];
  /** How it works, a rule a line. */
  rules: string[];
  /** The details nobody asked about. */
  details: { id: string; label: string; value: string; recommended: boolean }[];
}

/** A league's settings fields as a spec writes them; undefined: the field goes. */
export type SpecFields = Partial<Record<keyof LeagueSettings | "joinMode" | "replaceRule", unknown>>;

export const SPEC_VERSION: 1;
export const VOCAB: Record<string, Record<string, Builder>>;
export const PRESETS: Record<PresetId, GameSpec>;
export const PRESET_TYPES: Record<PresetId, LeagueTypeId>;
export const TYPE_PRESETS: Partial<Record<LeagueTypeId, PresetId>>;
export const PRESET_LABELS: Record<PresetId, string>;
export const NO_WAIVERS: SpecWaivers;
/** Waivers fit a draft whose castaways can come free (not a shared Outlast). */
export function waiversFit(spec: Partial<GameSpec>): boolean;
/** Side bets go with a draft: nothing else scores them (A4). */
export function betsFit(spec: Partial<GameSpec>): boolean;
/** The ask presets (A4): Weekly Calls' question (the show's calls), and a draft's finale predictions as two questions. */
export const CALLS: Question;
export function finaleQuestions(f: { top3: number; winner: number; from: "any" | "own" }): Question[];
export function finaleOf(ask: SpecQuestion[] | null | undefined): { top3: number; winner: number; from: "any" | "own" } | null;
/** The answers that name someone (a person) or something (a group), `pick` of them (A6). */
export const NAMES: readonly SpecQuestion["answer"][];
/** The settles a number answer is graded by ("by:take"). */
export const NUMBERS: readonly string[];
/** A question about each person (A6), by its answer: what settles it for each of them ("by:take"). */
export const EACH_SETTLES_FOR: Partial<Record<SpecQuestion["answer"], string[]>>;
export function isCalls(q: unknown): boolean;
export function callsAsk(ask: unknown): boolean;
export function fullQuestion(q: SpecQuestion): Question;
/** A choice option as the range a count falls in ("2", "3+", "0-1"), else null. */
export function optionRange(o: string): { min: number; max: number } | null;
export const MAX_QUESTIONS: number;
export const MAX_PICK: number;
export const MAX_QUESTION_POINTS: number;
/** Grading (answers.js): how a question stands, what each answer earns, whether one was right, why one can't be given. */
export function verdictOf(q: Question, episode: number, facts: AnswerFacts): Verdict;
/** F3 part 2: whether a group question reads its groups from the format's state over time where the season has them (asked
 *  each episode, about the one episode). */
export function readsTimeline(q: Question): boolean;
export function rightAnswers(q: Question, v: Verdict, facts?: AnswerFacts): string[] | null;
export function pointsFor(q: Question, v: Verdict, answers: { playerId: string; answer: unknown }[], facts?: AnswerFacts): Map<string, number>;
export function isRight(q: Question, v: Verdict, mine: { playerId: string; answer: unknown }, answers: { playerId: string; answer: unknown }[], facts?: AnswerFacts): boolean | null;
/** o.most: a wager of any of your points (A9), your points as they stand. */
export function answerProblem(q: Question, value: unknown, faces?: Set<string> | null, o?: { most?: number }): string | null;
/** A9: what each answer earns on one window with its ways of combining (a split pot, only the only right one, a rollover's worth,
 *  a shrinking call). */
export function windowPoints(
  q: Question,
  v: Verdict,
  answers: { playerId: string; answer: unknown; late?: number; changes?: number }[],
  facts?: AnswerFacts,
  o?: { worth?: number }
): Map<string, number>;
/** A9: who's right on every leg of a parlay in one window. */
export function allRight(legs: { q: Question; v: Verdict | undefined; answers: { playerId: string; answer: unknown }[] }[], facts?: AnswerFacts): Set<string>;
/** A9: what a shrinking call is worth, as it was made (its late, changes). */
export function shrunk(q: Question, worth: number, a?: { late?: number; changes?: number } | null): number;
export const WAGER_TOTAL: "total";
/** A8: a pairs question's pairs, drawn from who was in at the game's start (the same every time). */
export function pairsFrom(q: Question, ids: string[]): [string, string][];
/** A8: a pair's key for its answers ({ "a|b": who }): its two ids, sorted. */
export function pairKey(pair: [string, string] | string[]): string;
export const RANKS: readonly string[];
export const MAX_ORDER: number;
/** The one set of size limits (an Outlast team; a lineup's starters and bench; a lineup's whole team). */
export const MAX_TEAM: number;
export const MAX_STARTERS: number;
export const MAX_BENCH: number;
export const MAX_LINEUP_TEAM: number;
export const MAX_BET_POINTS: number;
export const DRAFT_TIMERS: number[];
export const WAIVER_HOURS: number[];
export const REPLACE_RULES: SpecWaivers["replace"][];
export const WAIVER_FEELS: SpecWaivers["feel"][];
export const WAIVER_ORDERS: SpecWaivers["order"][];
/** Two values the same, whatever order their keys are in. */
export function sameValue(a: unknown, b: unknown): boolean;
/** Settings fields a spec can write, and those that aren't the game at all. */
export const OWNED: string[];
export const OUTSIDE: string[];

/** The episode a span plays from: its number, a phase start's `at`, or null while it waits for its phase. */
export function spanStart(span: SpecSpan | null | undefined): number | null;
/** The phase a span starts at, or null. */
export function spanPhase(span: SpecSpan | null | undefined): string | null;

/** A10 part 1: a draft's most group slots, and a slot's defaults when the spec leaves them out. */
export const MAX_GROUP_SLOTS: number;
export const GROUP_SLOTS: GroupSlots;
/** A10 part 2: a pool's most lives, buybacks, mulligans and a buyback's most cost; a buyback's and a second pick's defaults. */
export const MAX_LIVES: number;
export const MAX_BUYBACKS: number;
export const MAX_MULLIGANS: number;
export const MAX_BUYBACK_COST: number;
export const BUYBACK: { times: number; before: null };
export const SECOND_PICK: { fallback: "void" | "counts" };
/** A11 part 2: a pick that never repeats, its fallback's default; last one standing's end defaults, a draft's and a pool's. */
export const NEVER: { fallback: "miss" | "skip" };
export const DRAFT_END: { oneLeft: "ends" | "plays" };
export const POOL_END: { oneLeft: "ends" | "plays"; allOut: "points" | "share" | "back" };
/** A10 part 2: a pool's lives (null: none, nobody's out), mulligans (0: none), buyback (with lives, its defaults filled), second
 *  pick and last one standing, read the one way the engine and the words read them; null for a pool with none, or no pool. */
export interface PoolParts {
  lives: number | null;
  mulligans: number;
  buyback: PoolBuyback | null;
  second: { fallback: "void" | "counts" } | null;
  standing: boolean;
  /** A11 part 2: a pick that never repeats (its fallback), else null; last one standing's end, with lives ranked standing (else
   *  null). */
  never: { fallback: "miss" | "skip" } | null;
  oneLeft: "ends" | "plays" | null;
  allOut: "points" | "share" | "back" | null;
}
export function poolParts(spec: GameSpec | SpecInput | null | undefined): PoolParts | null;
/** A10 part 3: a spread draft's defaults, a draw's ownership said alone, and a spread's bounds for a team of `each` over
 *  `groups` groups (null: not divided). */
export const DRAFT_ACROSS: { then: "keep" };
export const DRAW_OWN: "exclusive";
export function spreadBounds(each: number, groups: number): { least: number; most: number } | null;
/** A10 part 3b: a budget's most and defaults, a sealed bid sheet's most bids, a salary cap's highest price when it's left out,
 *  and a draft's prices read from a whole spec (null: none). */
export const MAX_BUDGET: number;
export const BUDGET: { total: number; floor: number };
export const CAP: { gone: "zero" | "last" };
export const AUCTION: { fallback: "fill" | "short" };
export const MAX_BIDS: number;
export function ceilingFor(total: number, each: number, floor: number): number | null;
export interface BudgetParts {
  auction: boolean;
  total: number;
  floor: number;
  ceiling?: number | null;
  gone?: "zero" | "last";
  fallback?: "fill" | "short";
  trade?: { fee: number };
  left?: "cash" | "lost" | "bids";
}
/** A10 part 3c: a stock market's defaults (a trade costs nothing; the money left over is cash), its waivers when the spec leaves
 *  them out (a window after every episode, the whole team each), and whether a spec is one. */
export const TRADE: { fee: number };
export const MARKET_LEFT: "cash";
export function marketWaivers(each: number): SpecWaivers;
export function marketOf(spec: unknown): boolean;
export function budgetParts(spec: GameSpec | SpecInput | null | undefined): BudgetParts | null;
/** A10 part 4: keepers' defaults, and keepers read from a whole spec (null: none). */
export const KEEP: { each: number; fallback: "best" | "none" };
export function keepParts(spec: GameSpec | SpecInput | null | undefined): { each: number; from: string | null; cost: "place" | "round" | "price"; fallback: "best" | "none" } | null;
/** Whether a pool covers every pick of an exclusive draft: people x each <= pool. */
export function covers(o: { pool: number; people: number; each: number }): boolean;
/** A10 part 4b: a shared seat's default people, the most one seat holds, and how many a whole spec's seat holds (1 unless shared). */
export const SEATS: { people: number };
export const MAX_SEAT_PEOPLE: number;
export function seatPeople(spec: GameSpec | SpecInput | null | undefined): number;
/** A10 part 4b: the teams the exclusive count counts (ctx.teams, else ctx.couch), or null. */
export function teamsOf(ctx: SpecContext | null | undefined): { n: number; said: string } | null;
/** The spec with everything it leaves out filled in (the preset's, or the defaults); never mutates it. */
export function fullSpec(spec: SpecInput | GameSpec): GameSpec;
/** The league type today's engine plays it as, or null. */
export function typeOf(spec: SpecInput | GameSpec): LeagueTypeId | null;
/** typeOf on a spec that's already whole, without copying it. */
export function playsAs(spec: GameSpec): LeagueTypeId | null;
/** The league type's flags, worked out from a whole spec. */
export function flagsOf(spec: GameSpec): {
  hasRoster: boolean; hasActiveRoster: boolean; hasBestBall: boolean; hasGroupSlots: boolean; hasKeepers: boolean; hasWeeklyPicks: boolean; hasCalls: boolean; hasQuestions: boolean; hasBingo: boolean;
  supportsReplenish: boolean; supportsTrade: boolean; supportsFinalePredictions: boolean;
};
/**
 * What's wrong with it; with ctx, the data-can-settle rule too. opts.league: it's a league's own (every write to a
 * league), so its couch-answered moments (Make it ours) and points for moments its rules don't have stay as they are;
 * opts.was, with it: the spec it's changing from, so the size limits hold for what grows.
 */
export function specProblems(spec: unknown, ctx?: SpecContext | null, opts?: { league?: boolean; was?: SpecInput | GameSpec }): SpecProblem[];
/** What it needs that isn't built yet; empty when today's engine plays it. */
export function specWaitsFor(spec: SpecInput | GameSpec): SpecWait[];
/** The spec a league's settings play, from its fields. */
export function specOf(settings: Partial<LeagueSettings> | Record<string, unknown> | null | undefined): GameSpec;
/** The spec a league plays: its carried settings.game, else specOf. Read only. */
export function gameOf(settings: Partial<LeagueSettings> | Record<string, unknown> | null | undefined): Readonly<GameSpec>;
/** A side bet's points, 1 to MAX_BET_POINTS. */
export function clampBet(v: unknown): number;
/** The settings fields a spec writes, or null when it has problems or no game plays it today. */
export function settingsOf(spec: SpecInput | GameSpec): SpecFields | null;
export function ownedFields(spec: SpecInput | GameSpec): string[] | null;
/** The settings with the spec's fields written into a copy, or null when settingsOf has none. */
export function withSpec<T extends object>(settings: T, spec: SpecInput | GameSpec): T | null;
export function describeSpec(spec: SpecInput | GameSpec, ctx?: SpecContext | null): SpecDescription;
