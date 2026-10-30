// Types for format-timeline.js (F3: the format's state over time). Only what the TypeScript side reads; the shapes are
// described in the module's own comments.
import type { FormatGroups } from "../game-spec/index.js";
import type { EpisodeFormatGroups } from "../types";

export interface TimelineGroup {
  id: string;
  name: string | null;
  members: string[];
}
export interface TimelineEpisode {
  episode: number;
  reported: boolean;
  known: boolean;
  sure: boolean;
  why: string[];
  end: { groups: TimelineGroup[]; alone: string[] } | null;
  left: string[];
}
export interface Timeline {
  episodes: TimelineEpisode[];
  groups: unknown[];
  spells: unknown[];
  newcomers: { name: string; episode: number; replaces: string | null; group: string | null }[];
  cast: string[];
  from: number;
  last: number;
}

export function groupFacts(
  tl: Timeline,
  o?: { cast?: { id: string; name: string }[]; tribes?: string[]; resolve?: ((name: string) => string | null) | null; through?: number }
): Map<number, FormatGroups>;
export function groupLabel(g: { name?: string | null; members: string[] }): string;
export function newcomerCues(tl: Timeline, names?: string[]): { name: string; episode: number; replaces: string | null; group: string | null; leftIn: number | null }[];
/** A10 part 1: each episode's groups as a league with group slots reads them (its episode.formatGroups), members resolved to
 *  the league's castaway ids. */
export function slotRecords(tl: Timeline, o?: { resolve?: (name: string) => string | null }): Map<number, EpisodeFormatGroups>;
/** One episode of the timeline, or null. */
export function at(tl: Timeline, n: number): TimelineEpisode | null;
/** A12: "major" by default for a stage a change starts, and every kind a stage can start on. */
export const MAJOR: string[];
export const TRIGGER_KINDS: string[];
/** A12: the changes of `kinds` (MAJOR by default) a stage starts on: `act` the ones research is sure of, `held` the rest (flagged). */
export function stageTriggers(tl: Timeline, kinds?: string[]): { act: import("../state-logic.js").StageTrigger[]; held: import("../state-logic.js").StageTrigger[] };
/** A12 part 2b: where the groups are gone going into an episode (a 'next-stage' fallback's start of the next stage): `act` where
 *  research is sure of it, `held` the rest; each the change that ended them (else `<episode>:groups-gone`), `gone` true. */
export function groupsGone(tl: Timeline): { act: import("../state-logic.js").StageTrigger[]; held: import("../state-logic.js").StageTrigger[] };
/** A12 part 2b: a stage's triggers with where the groups are gone added (one per change, a sure one taking a held one's place). */
export function withGone(
  t: { act: import("../state-logic.js").StageTrigger[]; held: import("../state-logic.js").StageTrigger[] },
  gone: { act: import("../state-logic.js").StageTrigger[]; held: import("../state-logic.js").StageTrigger[] }
): { act: import("../state-logic.js").StageTrigger[]; held: import("../state-logic.js").StageTrigger[] };
