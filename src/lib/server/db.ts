import { Pool } from "pg";
import type { LeagueState } from "@/lib/game/types";
import { HttpError } from "./http-error";

// Re-exported so route handlers can import { pool, withLeagueLock, HttpError } from one place,
// matching how SurvivorDraft's server/db.js bundles the same three together.
export { HttpError };

// This repo's own app-data database -- the same Postgres database Better Auth already uses
// (AUTH_DATABASE_URL), just a different set of tables (leagues/league_memberships/chat_*/
// issue_reports -- see db/migrations/0001_app_schema.sql). One pool, reused by every route.
export const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });

// Loads a league's state row FOR UPDATE inside a transaction, runs mutatorFn(state) against the
// in-memory object, writes the result back, and returns the updated state. Direct port of
// SurvivorDraft's server/db.js withLeagueLock -- a real row lock means two near-simultaneous
// writes (e.g. two clicks from the same commissioner screen) can't silently clobber each other.
export async function withLeagueLock(
  leagueId: string,
  mutatorFn: (state: LeagueState) => void | Promise<void>
): Promise<LeagueState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!rows.length) throw new HttpError(404, "League not found");
    const state: LeagueState = rows[0].state;
    await mutatorFn(state);
    await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), leagueId]);
    await client.query("COMMIT");
    return state;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// A subtle, non-editable feed entry (episode eliminations, resolved bets) attributed to no user.
// Direct port of SurvivorDraft's server/db.js insertSystemMessage.
export async function insertSystemMessage(leagueId: string, text: string) {
  await pool.query(
    `INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, NULL, 'System', 'system', $2)`,
    [leagueId, text]
  );
}
