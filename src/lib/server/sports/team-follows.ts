import type { PoolClient } from "pg";
import { HttpError, pool, tx } from "../db";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { listedLeague, listedTeam } from "./find";
import type { SportsProvider } from "./types";

// Following a team (docs/PLAN-start-a-game-gpt.md U1, "U1 sports on the couch's calls", 2026-11-09; migration 0307): a team's sheet's
// Follow. A follow adds no game by itself: it says whose games lead the guide's Sports. The couch's teams are those anyone on the
// couch follows, plus those in the games its leagues play (their seasons' linked events). A follow keeps the team's name and mark
// as its league's list has them when followed, so the guide draws them without reading a list.
//
// Following a league (docs/PLAN-sports-couch.md A3; migration 0313; docs/design-round/league-follow-spec.md): a league you follow
// has its card in Your shows, no team needed. Following a team follows its league too, so league_follows alone answers "is the
// NFL on my shows?"; unfollowing a league takes its card off and leaves its teams followed. Your team in a league (`myTeam`) is the
// first you followed there, changeable on the team's sheet; unfollowing it passes it to the next you followed there.

export interface FollowedTeam {
  league: string;
  id: string;
  name: string;
  short: string;
  abbreviation: string | null;
  color: string | null;
  /** Your team in its league (the first you followed there, or the one you made it). */
  myTeam: boolean;
}

/** Someone on a couch who follows a team or a league; `myTeam` when the team is theirs in its league. */
export type Follower = { id: string; name: string; myTeam?: boolean };

/** A couch's team: who follows it there (names), and whether the couch plays a game with it. */
export type CouchTeam = FollowedTeam & { followers: Follower[]; you: boolean; plays: boolean };

/** A league someone on a couch follows (directly, or by following a team in it), with who; `you` when you do. */
export type CouchLeague = { league: string; followers: Follower[]; you: boolean };

/** What you follow: your teams in the order you followed them, and your leagues. */
export type YourFollows = { teams: FollowedTeam[]; leagues: string[] };

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;

const rowOf = (r: Record<string, unknown>): FollowedTeam => ({
  league: r.league as string,
  id: r.team_id as string,
  name: r.name as string,
  short: r.short as string,
  abbreviation: (r.abbreviation as string | null) ?? null,
  color: (r.color as string | null) ?? null,
  myTeam: !!r.my_team,
});

/** The teams you follow, in the order you followed them. */
export async function yourTeams(userId: string): Promise<FollowedTeam[]> {
  const { rows } = await pool.query("SELECT * FROM team_follows WHERE user_id = $1 ORDER BY created_at", [userId]);
  return rows.map(rowOf);
}

/** Your teams and your leagues (each league in the order you followed it). */
export async function yourFollows(userId: string): Promise<YourFollows> {
  const [teams, { rows }] = await Promise.all([yourTeams(userId), pool.query("SELECT league FROM league_follows WHERE user_id = $1 ORDER BY created_at", [userId])]);
  return { teams, leagues: rows.map((r) => r.league as string) };
}

/** Your team in `league` goes to the first team you still follow there, when none is (after an unfollow, or a first follow). */
async function passMyTeam(db: PoolClient, userId: string, league: string) {
  await db.query(
    `UPDATE team_follows SET my_team = true
      WHERE user_id = $1 AND league = $2 AND NOT EXISTS (SELECT 1 FROM team_follows WHERE user_id = $1 AND league = $2 AND my_team)
        AND team_id = (SELECT team_id FROM team_follows WHERE user_id = $1 AND league = $2 ORDER BY created_at, team_id LIMIT 1)`,
    [userId, league]
  );
}

/**
 * Follow (or stop following) a team, by its league's list (404 when the list has no such team); following one follows its league
 * too, and the first you follow in a league is your team there. `myTeam: true` makes a team you follow your team in its league.
 * Answers what you follow.
 */
export async function setTeamFollow(
  userId: string,
  ask: { league?: unknown; team?: unknown; follow?: unknown; myTeam?: unknown },
  opts: { providers?: SportsProvider[] } = {}
): Promise<YourFollows> {
  const league = typeof ask.league === "string" ? ask.league.toLowerCase() : "";
  const team = typeof ask.team === "string" ? ask.team : "";
  if (!LEAGUE.test(league) || !team || team.length > 40) throw new HttpError(400, "Say which team: { league, team, follow }");
  if (ask.myTeam === true) {
    await tx(async (db) => {
      const on = await db.query("SELECT 1 FROM team_follows WHERE user_id = $1 AND league = $2 AND team_id = $3", [userId, league, team]);
      if (!on.rowCount) throw new HttpError(409, "Follow them first");
      // Two statements: the one-a-league index is checked row by row, so the old one goes first.
      await db.query("UPDATE team_follows SET my_team = false WHERE user_id = $1 AND league = $2 AND my_team", [userId, league]);
      await db.query("UPDATE team_follows SET my_team = true WHERE user_id = $1 AND league = $2 AND team_id = $3", [userId, league, team]);
    });
    return yourFollows(userId);
  }
  if (typeof ask.follow !== "boolean") throw new HttpError(400, "Say which team: { league, team, follow }");
  if (!ask.follow) {
    await tx(async (db) => {
      await db.query("DELETE FROM team_follows WHERE user_id = $1 AND league = $2 AND team_id = $3", [userId, league, team]);
      await passMyTeam(db, userId, league);
    });
    return yourFollows(userId);
  }
  const t = await listedTeam(league, team, opts);
  if (!t) throw new HttpError(404, "No such team");
  const color = t.color && /^[0-9a-fA-F]{6}$/.test(t.color) ? t.color : null;
  await tx(async (db) => {
    await db.query(
      // No logo (docs/PLAN-team-logos.md L0: the app never keeps or draws a league's logos; the column stays, always null).
      `INSERT INTO team_follows (user_id, league, team_id, name, short, abbreviation, color) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, league, team_id) DO UPDATE SET name = EXCLUDED.name, short = EXCLUDED.short, abbreviation = EXCLUDED.abbreviation,
         logo = NULL, color = EXCLUDED.color`,
      [userId, league, team, t.name.slice(0, 120), (t.short || t.name).slice(0, 80), t.abbreviation?.slice(0, 12) ?? null, color]
    );
    await db.query("INSERT INTO league_follows (user_id, league) VALUES ($1, $2) ON CONFLICT (user_id, league) DO NOTHING", [userId, league]);
    await passMyTeam(db, userId, league);
  });
  return yourFollows(userId);
}

/** Follow (or stop following) a league: a team sport's that its provider lists (404 otherwise). Its teams stay as they are. */
export async function setLeagueFollow(userId: string, ask: { league?: unknown; follow?: unknown }, opts: { providers?: SportsProvider[] } = {}): Promise<YourFollows> {
  const league = typeof ask.league === "string" ? ask.league.toLowerCase() : "";
  if (!LEAGUE.test(league) || typeof ask.follow !== "boolean") throw new HttpError(400, "Say which league: { league, follow }");
  if (!ask.follow) {
    await pool.query("DELETE FROM league_follows WHERE user_id = $1 AND league = $2", [userId, league]);
    return yourFollows(userId);
  }
  if (!(await listedLeague(league, opts))) throw new HttpError(404, "No such league");
  await pool.query("INSERT INTO league_follows (user_id, league) VALUES ($1, $2) ON CONFLICT (user_id, league) DO NOTHING", [userId, league]);
  return yourFollows(userId);

}

/**
 * A couch's teams (you must be on it): every team someone on it follows, with who, and every team in a game its leagues play
 * (a sports season's linked events), best known first: yours (your team in its league first), then the most followed, then those
 * it plays. And its leagues: each league someone on it follows, with who.
 */
export async function couchFollows(userId: string, couchId: string): Promise<{ teams: CouchTeam[]; leagues: CouchLeague[] }> {
  const on = await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, userId]);
  if (!on.rowCount) throw new HttpError(404, "No such couch");
  const [{ rows: follows }, { rows: played }, { rows: leagueRows }] = await Promise.all([
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
    pool.query(
      `SELECT f.league, f.user_id, COALESCE(u.username, u.name) AS who
         FROM league_follows f JOIN couch_members m ON m.user_id = f.user_id AND m.couch_id = $1 JOIN "user" u ON u.id = f.user_id
        ORDER BY f.created_at`,
      [couchId]
    ),
  ]);
  const byKey = new Map<string, CouchTeam>();
  for (const r of follows) {
    const k = `${r.league}|${r.team_id}`;
    // A couch team's own myTeam is yours (whether it's your team in its league); each follower says whether it's theirs.
    const t = byKey.get(k) ?? { ...rowOf({ ...r, my_team: false }), followers: [], you: false, plays: false };
    t.followers.push({ id: r.user_id as string, name: r.who as string, myTeam: !!r.my_team });
    if (r.mine) {
      t.you = true;
      t.myTeam = !!r.my_team;
    }
    byKey.set(k, t);
  }
  for (const r of played) {
    const k = `${r.league}|${r.team_id}`;
    const t = byKey.get(k);
    if (t) t.plays = true;
    else byKey.set(k, { ...rowOf(r), followers: [], you: false, plays: true });
  }
  const teams = [...byKey.values()].sort((a, b) => +b.you - +a.you || +b.myTeam - +a.myTeam || b.followers.length - a.followers.length || +b.plays - +a.plays);
  const leagues = new Map<string, CouchLeague>();
  for (const r of leagueRows) {
    const l = leagues.get(r.league) ?? { league: r.league as string, followers: [], you: false };
    l.followers.push({ id: r.user_id as string, name: r.who as string });
    if (r.user_id === userId) l.you = true;
    leagues.set(r.league, l);
  }
  return { teams, leagues: [...leagues.values()] };
}

/** A couch's teams alone (couchFollows' teams). */
export async function couchTeams(userId: string, couchId: string): Promise<CouchTeam[]> {
  return (await couchFollows(userId, couchId)).teams;
}
