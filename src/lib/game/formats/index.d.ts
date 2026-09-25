// Types for formats/index.js (plain CommonJS so db/*.js can require it under bare node). Only the parts
// TypeScript callers use; the wiki and research halves are read by the connectors in db/.

export interface ScoringEventDef {
  id: string;
  label: string;
  defaultPoints: number;
}

export interface GameFormat {
  id: string;
  name: string;
  exitMethods: string[];
  /** The exit method that crowns the winner and ends the season. */
  winnerExitMethod: string;
  /** The Active Roster scoring catalog. */
  events: ScoringEventDef[];
  /** Whether episodes carry a post-merge flag. */
  hasMerge: boolean;
}

export const FORMATS: Record<string, GameFormat>;
export const DEFAULT_FORMAT: string;
export function formatFor(id: string | null | undefined): GameFormat;
export function formatOptions(): { id: string; name: string }[];
