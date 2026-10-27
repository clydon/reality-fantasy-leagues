import { HttpError, pool } from "./db";

// A test couch's players (test-couch.ts) mimic the real people's moves in the test games, and nothing they do may reach a real
// game: what's shared by every game on a season (its results, an answer's flags, bingo squares' flags) is refused them.
// Results reach the test games from the real ones.
export async function refuseTestPlayer(userId: string | null | undefined, what: string): Promise<void> {
  if (!userId) return;
  const { rowCount } = await pool.query("SELECT 1 FROM test_players WHERE user_id = $1", [userId]);
  if (rowCount) throw new HttpError(403, `Test players don't ${what}: it would reach the real games too`);
}
