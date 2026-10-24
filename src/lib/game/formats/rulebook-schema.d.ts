// Types for formats/rulebook-schema.js: a rulebook's blocks (docs/PLAN-rulebooks-implementation.md section 3).

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
}

export interface RulebookWayOut {
  id: string;
  name: string;
  means: "out" | "finalist" | "winner" | "ending" | "outForOne";
  cause?: { segment: string } | "ownChoice" | "medical" | "removed" | "story";
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
    }
  | { type: "comeback"; who: "peopleWhoLeft" | "newPeople"; how: "winHeadToHead" | "viewersVote" | "theShow" }
  | { type: "sideTrip"; oneIsCalled: string; who: "chosen" | "random" | "won"; canGet: ("advantage" | "disadvantage" | "nothing")[] }
);

export interface RulebookCustomMoment {
  id: string;
  label: string;
  question?: string;
  during?: { segment: string } | { twist: string } | null;
  counted: "yesNo" | "eachTime" | "perUnit";
  answeredBy: "research" | "league";
  reliability?: "reliable" | "usually" | "patchy";
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
  momentNotes?: Record<string, { reliability?: "reliable" | "usually" | "patchy"; answeredBy?: "research" | "league" }>;
  leftOut?: string[];
}

/** Ties a rulebook's moments to what leagues have recorded: moment id -> legacy event id, way out id -> exit method. */
export interface RulebookAliases {
  events: Record<string, string>;
  exits: Record<string, string>;
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
