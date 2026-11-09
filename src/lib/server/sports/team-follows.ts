import { HttpError, pool } from "../db";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { listedTeam } from "./find";
import type { SportsProvider } from "./types";

// Following a team (docs/PLAN-start-a-game-gpt.md U1, "U1 sports on the couch's calls", 2026-11-09; migration 0307): a team's sheet's
// Follow. A follow adds no game by itself: it says whose games lead the guide's Sports. The couch's teams are those anyone on the
// couch follows, plus those in the games its leagues play (their seasons' linked events). A follow keeps the team's name and mark
// as its league's list has them when followed, so the guide draws them without reading a list.

export interface FollowedTeam {
  league: string;
  id: string;
  name: string;
  short: string;
  abbreviation: string | null;
  logo: string | null;
  color: string | null;
}

/** A couch's team: who follows it there (names), and whether the couch plays a game with it. */
export type CouchTeam = FollowedTeam & { followers: { id: string; name: string }[]; you: boolean; plays: boolean };

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;

const rowOf = (r: Record<string, unknown>): FollowedTeam => ({
  league: r.league as string,
  id: r.team_id as string,
  name: r.name as string,
  short: r.short as string,
  abbreviation: (r.abbreviation as string | null) ?? null,
  logo: (r.logo as string | null) ?? null,
  color: (r.color as string | null) ?? null,
});

/** The teams you follow, in the order you followed them. */
export async function yourTeams(userId: string): Promise<FollowedTeam[]> {
  const { rows } = await pool.query("SELECT * FROM team_follows WHERE user_id = $1 ORDER BY created_at", [userId]);
  return rows.map(rowOf);
}

/** Follow (or stop following) a team, by its league's list (404 when the list has no such team). Answers your teams. */
export async function setTeamFollow(userId: string, ask: { league?: unknown; team?: unknown; follow?: unknown }, opts: { providers?: SportsProvider[] } = {}): Promise<FollowedTeam[]> {
  const league = typeof ask.league === "string" ? ask.league.toLowerCase() : "";
  const team = typeof ask.team === "string" ? ask.team : "";
  if (!LEAGUE.test(league) || !team || team.length > 40 || typeof ask.follow !== "boolean") throw new HttpError(400, "Say which team: { league, team, follow }");
  if (!ask.follow) {
    await pool.query("DELETE FROM team_follows WHERE user_id = $1 AND league = $2 AND team_id = $3", [userId, league, team]);
    return yourTeams(userId);
  }
  const t = await listedTeam(league, team, opts);
  if (!t) throw new HttpError(404, "No such team");
  const color = t.color && /^[0-9a-fA-F]{6}$/.test(t.color) ? t.color : null;
  await pool.query(
    `INSERT INTO team_follows (user_id, league, team_id, name, short, abbreviation, logo, color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, league, team_id) DO UPDATE SET name = EXCLUDED.name, short = EXCLUDED.short, abbreviation = EXCLUDED.abbreviation,
       logo = EXCLUDED.logo, color = EXCLUDED.color`,
    [userId, league, team, t.name.slice(0, 120), (t.short || t.name).slice(0, 80), t.abbreviation?.slice(0, 12) ?? null, t.logo && t.logo.length <= 500 ? t.logo : null, color]
  );
  return yourTeams(userId);
}

/**
 * A couch's teams (you must be on it): every team someone on it follows, with who, and every team in a game its leagues play
 * (a sports season's linked events), best known first: yours, then the most followed, then those it plays.
 */
export async function couchTeams(userId: string, couchId: string): Promise<CouchTeam[]> {
  const on = await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, userId]);
  if (!on.rowCount) throw new HttpError(404, "No such couch");
  const [{ rows: follows }, { rows: played }] = await Promise.all([
    pool.query(
      `SELECT f.*, COALESCE(u.username, u.name) AS who, f.user_id = $2 AS mine
         FROM team_follows f JOIN couch_members m ON m.user_id = f.user_id AND m.couch_id = $1 JOIN "user" u ON u.id = f.user_id
        ORDER BY f.created_at`,
      [couchId, userId]
    ),
    pool.query(
      `SELECT DISTINCT e.league, t->>'id' AS team_id, t->>'name' AS name, t->>'name' AS short
         FROM leagues l ${LEAGUE_SEASON_JOIN} JOIN season_events e ON e.season_id = ss.id
              CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.teams) = 'array' THEN e.teams ELSE '[]'::jsonb END) AS c(t)
        WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND t ? 'id' AND e.starts_at > now() - interval '2 days'`,
      [couchId]
    ),
  ]);
  const byKey = new Map<string, CouchTeam>();
  for (const r of follows) {
    const k = `${r.league}|${r.team_id}`;
    const t = byKey.get(k) ?? { ...rowOf(r), followers: [], you: false, plays: false };
    t.followers.push({ id: r.user_id as string, name: r.who as string });
    if (r.mine) t.you = true;
    byKey.set(k, t);
  }
  for (const r of played) {
    const k = `${r.league}|${r.team_id}`;
    const t = byKey.get(k);
    if (t) t.plays = true;
    else byKey.set(k, { ...rowOf(r), followers: [], you: false, plays: true });
  }
  return [...byKey.values()].sort((a, b) => +b.you - +a.you || b.followers.length - a.followers.length || +b.plays - +a.plays);
}
