import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { catchUpBots } from "./bots";
import { LEAGUE_SEASON_JOIN } from "./league-season";

// A team sport's game at its own pace, never more than one game behind (docs/PLAN-sports-ready.md step 2.6; BACKLOG 218), the
// server's half. The floor (the last episode its seats have watched by now at the latest: sports/pace.ts) is stamped with the air
// times (air-times.ts stampPaceFloor), so every write (db.ts withLeagueLock, here) and a read with a seat behind it (league-read.ts
// readyLeague) moves them on, and the hourly sports job readies every such game (keepAllSportPace) so a mark moves within the hour
// when nobody looks. A seat's mark lives in three places, as a reveal writes it (reveal.ts markRevealed): the game's state
// (lateJoin.seenThrough), the membership's (results_seen_through) and the person's on the show (show_follows.seen_through, forward
// only), so the guard, the Games tab and the hub all agree. Computer players play the weeks they pass first (catchUpBots).

/**
 * Inside withLeagueLock (before its mutation and after it): every seat behind the floor moved to it, and its people's marks never
 * behind the floor nor the game's start (it starts with the game to come or the one just played: what came before counts as watched,
 * as it was shown them live). Answers how many seats moved. Nothing is asked of the database for any other game.
 */
export async function keepSportPace(client: PoolClient, leagueId: string, state: LeagueState): Promise<number> {
  const G = StateLogic.GhostLogic;
  const target = G.paceTarget(state);
  if (target === null) return 0;
  let moved = 0;
  if (G.paceDue(state)) {
    // Computer players play each week up to it on their own copies first, as a person's reveal has them (they'd skip it otherwise).
    await catchUpBots(client, leagueId, state, target);
    moved = G.keepPace(state).length;
  }
  // The people's seats with a mark of their own (settlePace gives one at the game's first results; before that they play live).
  const seats = state.players.filter((p) => !p.automated && !p.disabled && p.lateJoin && Number.isInteger(p.lateJoin.startEpisode)).map((p) => p.id);
  if (!seats.length) return moved;
  const mark = Math.max(target, (StateLogic.startEpisode(state) ?? 1) - 1);
  const { rowCount } = await client.query(
    `UPDATE league_memberships SET results_seen_through = $3
      WHERE league_id = $1 AND player_id = ANY($2::text[]) AND COALESCE(results_seen_through, -1) < $3`,
    [leagueId, seats, mark]
  );
  if (!rowCount) return moved;
  // The show's mark, forward only (follows.ts followLeagueProgress's rule, in this transaction): best effort, so a savepoint keeps a
  // failure from undoing the move.
  await client.query("SAVEPOINT keep_pace_follows");
  try {
    await client.query(
      `INSERT INTO show_follows (user_id, season_id, seen_through, finished_at)
       SELECT m.user_id, ss.id, m.results_seen_through,
              CASE WHEN ss.episode_count > 0 AND m.results_seen_through >= ss.episode_count THEN now() END
         FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
        WHERE m.league_id = $1 AND m.player_id = ANY($2::text[]) AND m.results_seen_through IS NOT NULL
       ON CONFLICT (user_id, season_id) DO UPDATE
          SET seen_through = EXCLUDED.seen_through, updated_at = now(), finished_at = COALESCE(show_follows.finished_at, EXCLUDED.finished_at)
        WHERE EXCLUDED.seen_through > show_follows.seen_through`,
      [leagueId, seats]
    );
    await client.query("RELEASE SAVEPOINT keep_pace_follows");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT keep_pace_follows");
    console.error(`[sport-pace] follows for league ${leagueId}:`, e);
  }
  return moved;
}
