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
