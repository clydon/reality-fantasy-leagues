// Types for formats/index.js (plain CommonJS so db/*.js can require it under bare node). Only the parts
// TypeScript callers use; the wiki and research halves are otherwise read by the connectors in db/.

export interface ScoringEventDef {
  id: string;
  label: string;
  defaultPoints: number;
  /** Follows from an exit or a role (impliedEvents), so it's never added or reviewed on its own. */
  implied?: boolean;
}

export interface FormatRoles {
  /** What everyone is until a role decision says otherwise ("Faithful"). */
  default: string;
  /** The values a role decision can record ("Traitor", "Recruited Traitor"). */
  values: string[];
  /** The role a recorded value makes someone ("Traitor"). */
  roleFor(value: string): string;
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
  /** Whether players are in tribes/teams that can change during the season. */
  hasGroups: boolean;
  /** Secret roles (The Traitors). Absent for shows without them. */
  roles?: FormatRoles;
  research: {
    /** One research answer as short phrases for a reviewer. */
    notes(entry: Record<string, unknown>): string[];
  };
}

export const FORMATS: Record<string, GameFormat>;
export const DEFAULT_FORMAT: string;
export function formatFor(id: string | null | undefined): GameFormat;
export function formatOptions(): { id: string; name: string }[];
