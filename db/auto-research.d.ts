// Types for the part of auto-research.js the Next app calls (the research route's "has it aired?" check).
import type { Pool } from "pg";

/** When episode n of a season airs, or null when the season has no premiere date or wiki air dates. */
export function episodeAirsAt(pool: Pool, seasonId: string, n: number): Promise<Date | null>;
