// Types for db/format-timeline.js (F3 part 2): the season's format state over time from its stored research. Only what the
// TypeScript side reads; the timeline itself is src/lib/game/formats/format-timeline.js's.
import type { Timeline } from "../src/lib/game/formats/format-timeline.js";
export type { Timeline };

export function seasonFormatTimeline(pool: unknown, o: { showId: string; season: number | string; cast?: string[]; before?: number | null }): Promise<Timeline>;
export function timelineForSeason(pool: unknown, seasonId: string): Promise<{ timeline: Timeline; cast: string[] } | null>;
export function timelineForShow(pool: unknown, showSlug: string | null | undefined, season: number | string | null | undefined, cast?: string[]): Promise<Timeline | null>;
export function seasonNewcomerCues(
  pool: unknown,
  seasonId: string
): Promise<{ name: string; episode: number; replaces: string | null; group: string | null; leftIn: number | null }[]>;
