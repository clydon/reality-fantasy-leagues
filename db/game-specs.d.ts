// Types for db/game-specs.js (plain CommonJS so the bare-node scripts can use it).
import type { Pool, PoolClient } from "pg";

/** A pool, or a client inside a transaction (withLeagueLock hands one in). */
type Db = Pool | PoolClient;

export const FLAG: "game-specs";
export function gameSpecsOn(db: Db): Promise<boolean>;
export function setGameSpecsOn(db: Db, on: boolean): Promise<void>;
/** Settings carrying the spec their fields play (on), or none (off); true when that changed them. */
export function carryGame(settings: object, on: boolean): boolean;
/** A league's settings brought into step with the flag, inside its write. */
export function syncLeagueGame(db: Db, settings: object): Promise<boolean>;
export function syncLeagueRow(pool: Pool, leagueId: string, on: boolean): Promise<{ saved: boolean } | null>;
