// Watching a sports game as if live (the design round's step 7; migration 0438): the games someone is watching from a recording,
// whose scores and results stay hidden from them everywhere (src/new/sports/scores.tsx useGameScore) until they've watched it.
// A row a game while it's on; a few weeks' worth at most for anyone, so nothing to prune (docs/HOSTING.md).
import { HttpError, pool } from "@/lib/server/db";

export interface Recording {
  game: string;
  league: string;
}

export async function recordingsOf(userId: string): Promise<Recording[]> {
  const { rows } = await pool.query<{ game_id: string; league: string }>(
    "SELECT game_id, league FROM sports_recordings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200",
    [userId]
  );
  return rows.map((r) => ({ game: r.game_id, league: r.league }));
}

/** Start or stop watching a game as if live; answers the list as it now stands. */
export async function setRecording(userId: string, body: { game?: unknown; league?: unknown; on?: unknown }): Promise<Recording[]> {
  const game = typeof body.game === "string" ? body.game.trim() : "";
  const league = typeof body.league === "string" ? body.league.trim() : "";
  if (!game || game.length > 64 || !league || league.length > 64) throw new HttpError(400, "Which game?");
  if (body.on === false) await pool.query("DELETE FROM sports_recordings WHERE user_id = $1 AND game_id = $2", [userId, game]);
  else
    await pool.query("INSERT INTO sports_recordings (user_id, game_id, league) VALUES ($1, $2, $3) ON CONFLICT (user_id, game_id) DO NOTHING", [
      userId,
      game,
      league,
    ]);
  return recordingsOf(userId);
}
