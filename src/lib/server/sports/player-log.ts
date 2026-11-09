import { addUp, type LineTable, type StatItem } from "@/lib/game/sports-stats";
import { isUuid, type SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { seenThrough } from "../guard";

// A player's game log (docs/PLAN-start-a-game-gpt.md U1's sports slice; PLAN-sports-live's player sheet): a sport's person in a
// game's sheet shows their games where a castaway shows their story: each game's line (the box score's own columns, game_lines,
// 0150), newest first, with the opponent and the day, up to where the viewer may be told (guard.ts: everything while sports are
// live; with Sports scores too on, the games they've shown the score of). Matched by name, as the season's cast and lines are.

export interface LoggedGame {
  episode: number;
  at: string | null;
  /** The other side, as the game's link names it (null when the link didn't say). */
  opponent: string | null;
  /** Their team that game, as the box score said. */
  team: string | null;
  items: StatItem[];
}

export async function playerLog(user: SessionUser, seasonId: string, name: string): Promise<{ games: LoggedGame[]; newer: boolean }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const who = name.trim();
  if (!who || who.length > 120) throw new HttpError(400, "Say who: ?name=");
  const seen = await seenThrough(user.id, seasonId);
  const mark = Number.isFinite(seen) ? seen : 2_147_483_646;
  const [{ rows }, { rows: later }] = await Promise.all([
    pool.query(
      `SELECT g.episode, g.team, g.tables, e.starts_at, e.teams
         FROM game_lines g LEFT JOIN LATERAL (SELECT starts_at, teams FROM season_events x WHERE x.season_id = g.season_id AND x.episode = g.episode ORDER BY starts_at LIMIT 1) e ON true
        WHERE g.season_id = $1 AND lower(g.name) = lower($2) AND g.episode BETWEEN 1 AND $3
        ORDER BY g.episode DESC`,
      [seasonId, who, mark]
    ),
    // A later game's line, past where they are: it opens once they've seen that game.
    pool.query("SELECT 1 FROM game_lines WHERE season_id = $1 AND lower(name) = lower($2) AND episode > $3 LIMIT 1", [seasonId, who, mark]),
  ]);
  const games = rows.map((r) => {
    const sides = Array.isArray(r.teams) ? (r.teams as { id: string; name: string }[]) : [];
    const opponent = sides.find((t) => t.name !== r.team && t.id !== r.team)?.name ?? null;
    return { episode: r.episode as number, at: r.starts_at ? new Date(r.starts_at).toISOString() : null, opponent, team: (r.team as string | null) ?? null, items: addUp([r.tables as LineTable[]]) ?? [] };
  });
  return { games, newer: later.length > 0 };
}
