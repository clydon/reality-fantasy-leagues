// Types for formats/rulebook-fits.js: which season games a rulebook can feed (docs/PLAN-rulebooks-implementation.md 4.8).
import type { RulebookBlocks } from "./rulebook-schema";

export type SeasonGameKey = "survivalPool" | "weeklyLineup" | "outlast" | "weeklyBingo" | "weeklyCalls";

export interface GameFit {
  key: SeasonGameKey;
  name: string;
  /** settings.leagueTypeId it plays as; null: not a league type yet (step 12's bingo and calls). */
  type: "pickem" | "active-roster" | "classic-draft" | null;
  fits: boolean;
  /** What it needs from a rulebook, for the doesn't-fit line. */
  needs: string;
  /** It fits, but can't be started until this step. */
  soon: string | null;
}

export const GAME_TYPES: Record<SeasonGameKey, GameFit["type"]>;
export function gamesFor(blocks: Partial<RulebookBlocks> | null | undefined, compiled?: { events?: unknown[]; winnerExitMethod?: string | null } | null): GameFit[];
export function noFitLine(games: GameFit[], blocks: Partial<RulebookBlocks> | null | undefined, show?: string | null): string | null;
export function gameLine(key: SeasonGameKey, blocks: Partial<RulebookBlocks> | null | undefined, slots?: { active?: number; bench?: number } | null): string;
