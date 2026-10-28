// Types for formats/rulebook-schema.js: a rulebook's blocks (docs/PLAN-rulebooks-implementation.md section 3).
import type { MomentTag } from "./moment-tags";

export type RulebookKind = "competition" | "series" | "talk" | "sport";
export type BlockKey = "cast" | "season" | "segments" | "waysOut" | "twists" | "points";
export type Points = number | { exclusive: number; shared: number };

export interface RulebookPhase {
  id: string;
  name: string;
  starts: { type: "episode" | "remaining" | "announced"; n?: number };
  changes?: ("groupsEnd" | "groupsReshuffle" | "juryStarts" | "viewersVote" | "arrivals" | "segmentsChange")[];
  summary?: string;
}

export interface RulebookSegment {
  id: string;
  name: string;
  summary?: string;
  decidedBy: "result" | "judges" | "vote" | "pick" | "headToHead" | "nobody";
  voters?: "cast" | "viewers" | "jury" | "judges" | "secretGroup";
  pickers?: "onePerson" | "eachPerson" | "panel";
  takesPart?: "everyone" | "groups" | "groupsThenEach" | "atRisk";
  decides?: "winner" | "topThree" | "bestAndWorst" | "fullOrder" | "score";
  onTheLine?: "nothing" | "reward" | "advantage" | "safety" | "atRisk" | "goingHome" | "points";
  often: "everyEpisode" | "someEpisodes" | "onePhase";
  /** A phase id, or "finale", when `often` is onePhase. */
  phase?: string;
  momentsOff?: string[];
  /** When groups take part and someone wins it: "won" counts a group's win as winning it (one moment, either answer). */
  groupWin?: "own" | "won";
  /** For the top three: "place" asks one finishing place for 2nd and 3rd. */
  places?: "each" | "place";
  /** For a vote: the segment whose winning group doesn't take part in it (the tribe that wins immunity skips Tribal Council). */
  skippedBy?: string;
}

export interface RulebookWayOut {
  id: string;
  name: string;
  means: "out" | "finalist" | "winner" | "ending" | "outForOne";
  cause?: { segment: string } | "ownChoice" | "medical" | "removed" | "story";
  /** For a finalist way out: the winner reached the end too, so it scores for them as well. */
  winnerToo?: boolean;
}

export type RulebookTwist = { id: string; name: string; summary?: string; momentsOff?: string[] } & (
  | { type: "secretRole"; roles: string[]; revealed: "whenTheyLeave" | "atFinale" | "never"; canSwitch: "never" | "recruited" }
  | {
      type: "advantage";
      oneIsCalled: string;
      gotBy: "found" | "wonAt" | "given" | "chosenByShow";
      wonAt?: string;
      does: ("keepsSafe" | "cancelsVotes" | "savesSomeone" | "hurtsSomeone" | "extraVote" | "skipsATask")[];
      lasts: "untilPlayed" | "oneUse" | "oneEpisode";
      /** With cancelsVotes: "count" asks how many votes it cancelled, of whoever played one. */
      cancelled?: "yesNo" | "count";
    }
  | { type: "comeback"; who: "peopleWhoLeft" | "newPeople"; how: "winHeadToHead" | "viewersVote" | "theShow" }
  | {
      type: "sideTrip";
      oneIsCalled: string;
      who: "chosen" | "random" | "won";
      canGet: ("advantage" | "disadvantage" | "nothing")[];
      /** "yes": away from their group while still in the game (Exile Island), recorded as the episode's exile. */
      away?: "no" | "yes";
    }
);

export interface RulebookCustomMoment {
  id: string;
  label: string;
  question?: string;
  /** Scored from a question the rulebook already asks (its key) instead of one of its own (docs/PLAN-maker-scoring.md). */
  uses?: string;
  during?: { segment: string } | { twist: string } | null;
  counted: "yesNo" | "eachTime" | "perUnit";
  answeredBy: "research" | "league";
  reliability?: "reliable" | "usually" | "patchy";
  /** During a segment someone wins: whoever won it, alone or in the winning group, can't have it. */
  exceptWinners?: boolean;
}

/** How research asks one question: its own words, whether a yes needs a source, or (with a type) a question asked besides;
 *  and how its answer reads to a reviewer (a template of it, research-review.js), and when that's said. */
export interface RulebookQuestion {
  words?: string;
  needsSource?: boolean;
  type?: "answer" | "string" | "integer";
  of?: "person" | "episode";
  note?: string | false;
  sentence?: string | false;
  shown?: Record<string, unknown>;
}

/** One of research's checks, by its id (rulebook-compile.js): its own words or condition for one the compiler makes from the
 *  blocks, off, or one of the rulebook's own (a condition on one person's answers, and its words). */
export interface RulebookCheck {
  words?: string;
  when?: Record<string, unknown>;
  set?: Record<string, string | number | null>;
  off?: boolean;
}

export interface RulebookBlocks {
  schema: 1;
  kind: RulebookKind;
  /** A series' starting point. */
  start?: "reality" | "scripted";
  show?: string;
  tagline?: string;
  premise?: string;
  /** What one part of the season is called (a sport's race), and the rundown's own heading ("Each leg"). */
  parts?: { singular: string; plural: string; label?: string };
  /** The format id these blocks were read back from (rulebook-from-format.js). */
  derivedFrom?: string;
  cast: {
    unit: "people" | "pairs" | "panel";
    singular: string;
    plural: string;
    usualSize?: number;
    groups: null | { type: "sides" | "couples" | "coachTeams"; singular: string; change: "never" | "atPhases" | "often" };
  };
  season: {
    phases: RulebookPhase[];
    finale?: {
      decidedBy: "juryVote" | "judges" | "viewersVote" | "castVote" | "lastStanding" | "firstToFinish" | "mostPoints" | "groupWins" | "nobody";
      finalists?: number;
      summary?: string;
      momentsOff?: string[];
    } | null;
  };
  segments: RulebookSegment[];
  waysOut: RulebookWayOut[];
  twists?: RulebookTwist[];
  customMoments?: RulebookCustomMoment[];
  points?: Record<string, Points>;
  /** off: a couch's own copy doesn't count it (Make it ours). */
  momentNotes?: Record<string, { reliability?: "reliable" | "usually" | "patchy"; answeredBy?: "research" | "league"; off?: boolean; tags?: MomentTag[] }>;
  /** How research asks: the search hint's lines, and each question by the blocks' own key. */
  research?: { searchHint?: string[]; questions?: Record<string, RulebookQuestion>; checks?: Record<string, RulebookCheck> };
  leftOut?: string[];
}

/**
 * Ties a rulebook's moments to what leagues have recorded: moment id -> legacy event id, way out id -> exit method, and a
 * question the blocks build -> the key stored research answers use.
 */
export interface RulebookAliases {
  events: Record<string, string>;
  exits: Record<string, string>;
  questions?: Record<string, string>;
}

/** [stored value, label people see, help]. */
export type Option = [string, string, string];

export interface KindInfo {
  name: string;
  blurb: string;
  like: string;
  /** Each block's heading; null where the kind hides it. */
  labels: Record<BlockKey, string | null>;
  part: [string, string];
  /** Where results come from by default, in a sentence. */
  results: string;
  /** The season games that fit, as GAME_LABELS keys. */
  games: string[];
}

export interface BlocksProblem {
  /** The row and field: "segments[tribalCouncil].voters". */
  at: string;
  message: string;
}

export const SCHEMA_VERSION: 1;
export const OPT: Record<string, Option[]>;
export const KINDS: Record<RulebookKind, KindInfo>;
export const BLOCKS: BlockKey[];
export const GAME_LABELS: Record<string, string>;
export const DECIDED_TAG: Record<RulebookSegment["decidedBy"], string>;
export const QUESTIONS: Record<string, Record<string, string>>;
export const TWIST_FIELDS: Record<string, Record<string, string | [string]>>;
export function labelOf(key: string, value: unknown): string;
export function helpOf(key: string, value: unknown): string;
export function valuesOf(key: string): string[];
export function optionsFor(key: string, blocks: RulebookBlocks): Option[];
export function partWord(blocks: Partial<RulebookBlocks> | null | undefined): { singular: string; plural: string };
export function blockLabel(blocks: Partial<RulebookBlocks> | null | undefined, block: BlockKey): string | null;
export function blocksProblems(blocks: unknown): BlocksProblem[];
export function kindOf(blocks: Partial<RulebookBlocks> | null | undefined): RulebookKind;
export function camelId(label: string): string;
export function cap(s: string): string;
export function pluralOf(word: string): string;
/** Whether groups take part in a segment decided by a result: it builds a group's win. */
export function hasGroupWin(segment: Partial<RulebookSegment> | null | undefined, blocks: Partial<RulebookBlocks> | null | undefined): boolean;
/** Whether a segment has a winner: it builds "Won the <segment>". */
export function winsOf(segment: Partial<RulebookSegment> | null | undefined): boolean;
/** The optional refinements an item can carry (groupWin, places, skippedBy, winnerToo, cancelled, away, exceptWinners). */
export const REFINEMENTS: string[];
/** Takes out, in place, each refinement that doesn't go with its item; the item stays. */
export function dropMisfitRefinements(blocks: unknown): { dropped: BlocksProblem[]; problems: BlocksProblem[] };
