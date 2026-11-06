// Types for the part of card-research.js the Next app calls (C7 part 2: a card the bot chooses, stamped on a league's episodes).
import type { Pool, PoolClient } from "pg";
import type { LeagueState } from "../src/lib/game/types";

/** Stamps a league's episodes with its card's choices as they stood when each card came out (a game whose card the bot doesn't
 *  choose has its stamps taken off). True when anything changed. */
export function stampLeague(pool: Pool | PoolClient, state: LeagueState, now?: number): Promise<boolean>;
/** Files a season's episode's fallback (its card came out without a choice), unless it's decided already. */
export function markFallback(pool: Pool | PoolClient, seasonId: string, n: number): Promise<void>;
