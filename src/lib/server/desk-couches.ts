import { isUuid, type SessionUser } from "./auth-helpers";
import { roleChange } from "./change-log";
import { setWhoFills } from "./community-results";
import { pool, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { gameName } from "./league-season";
import { setLeagueRole } from "./roles";

// Couches, people and shows on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminEntity):
// a couch's people, its games and who runs each, who fills in its results (Override), and, when a game has nobody
// running it (its only commissioner left or deleted their account: the Inbox's stranded couch), Hand it to someone who
// plays it. A person's couches and games, to look up; a show's seasons, to go to.

export interface DeskCouch {
  id: string;
  name: string;
  members: { userId: string; name: string; role: string }[];
  games: { leagueId: string; name: string; season: string; gameName: string; runners: string[]; players: { userId: string; name: string }[] }[];
  anyone: boolean;
  rulings: number;
  /** Games nobody runs, and who could take each on (people who play it). */
  stranded: { leagueId: string; name: string }[];
  history: DeskLine[];
}

export async function deskCouch(id: string): Promise<DeskCouch> {
  if (!isUuid(id)) throw new HttpError(404, "Couch not found");
  const { rows: c } = await pool.query("SELECT id, name, results_by_anyone FROM couches WHERE id = $1", [id]);
  if (!c.length) throw new HttpError(404, "Couch not found");
  const { rows: members } = await pool.query(
    `SELECT m.user_id, COALESCE(u.username, u.name) AS name, m.role FROM couch_members m JOIN "user" u ON u.id = m.user_id WHERE m.couch_id = $1 ORDER BY m.role DESC, u.username`,
    [id]
  );
  const { rows: leagues } = await pool.query(
    `SELECT l.id, l.name, l.state->'settings'->>'leagueTypeId' AS type, l.state->'settings'->>'showId' AS show, l.state->'settings'->>'wikiSeason' AS season
       FROM leagues l WHERE l.couch_id = $1 ORDER BY l.name`,
    [id]
  );
  const { rows: seats } = await pool.query(
    `SELECT m.league_id, m.user_id, m.role, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS site FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = ANY($1::uuid[])`,
    [leagues.map((l) => l.id)]
  );
  const { rows: rulings } = await pool.query("SELECT count(DISTINCT decision_id)::int AS n FROM league_rulings WHERE league_id = ANY($1::uuid[])", [leagues.map((l) => l.id)]);
  const games = leagues.map((l) => ({
    leagueId: l.id,
    name: l.name,
    season: [l.show, l.season].filter(Boolean).join(" "),
    gameName: gameName(l.type),
    runners: seats
      .filter((s) => s.league_id === l.id && (s.role === "commissioner" || s.role === "admin" || s.site))
      .map((s) => `${s.name}${s.role === "admin" ? " (Game admin)" : s.role !== "commissioner" ? " (site admin)" : ""}`),
    players: seats.filter((s) => s.league_id === l.id).map((s) => ({ userId: s.user_id, name: s.name })),
  }));
  const { rows: lines } = await pool.query(
    `SELECT ch.text, ch.created_at, COALESCE(u.username, u.name) AS who FROM league_changes ch LEFT JOIN "user" u ON u.id = ch.user_id
      WHERE ch.league_id = ANY($1::uuid[]) AND ch.kind IN ('role', 'settings.fill', 'member') ORDER BY ch.created_at DESC LIMIT 15`,
    [leagues.map((l) => l.id)]
  );
  return {
    id,
    name: c[0].name,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, role: m.role })),
    games,
    anyone: c[0].results_by_anyone,
    rulings: rulings[0].n,
    stranded: games
      .filter((g) => g.players.length && !seats.some((s) => s.league_id === g.leagueId && (s.role === "commissioner" || s.site)))
      .map((g) => ({ leagueId: g.leagueId, name: g.name })),
    history: byNewest([
      ...lines.map((r) => ({ id: null, text: `${r.who ? `${r.who}: ` : ""}${r.text}`, at: r.created_at.toISOString(), who: null, undoable: false, undone: false })),
      ...(await deskLines("couch", id)),
    ]),
  };
}

/** Hand a game nobody runs to someone who plays it: they become its Commissioner (a line in its Recent changes). */
export async function handCouchGame(user: SessionUser, couchId: string, body: { leagueId?: unknown; userId?: unknown }): Promise<DeskCouch> {
  const couch = await deskCouch(couchId);
  const game = couch.stranded.find((g) => g.leagueId === body.leagueId);
  if (!game) throw new HttpError(404, "That game has someone running it");
  const to = couch.games.find((g) => g.leagueId === game.leagueId)?.players.find((p) => p.userId === body.userId);
  if (!to) throw new HttpError(400, "Hand it to someone who plays it");
  await setLeagueRole(game.leagueId, to.userId, "commissioner", (client, before) => roleChange(client, game.leagueId, user.id, to.userId, before, "commissioner"));
  await logDesk(pool, { entity: "couch", entityId: couchId, action: "hand", text: `Handed ${game.name} to ${to.name}`, userId: user.id });
  return deskCouch(couchId);
}

/** Override who can fill in the couch's results. */
export async function couchFill(user: SessionUser, couchId: string, anyone: unknown): Promise<DeskCouch> {
  if (typeof anyone !== "boolean") throw new HttpError(400, "anyone is true or false");
  const couch = await deskCouch(couchId);
  if (couch.anyone === anyone) return couch;
  await setWhoFills(user.id, couchId, couch.games.map((g) => g.leagueId), anyone);
  await logDesk(pool, {
    entity: "couch",
    entityId: couchId,
    action: "fill",
    text: anyone ? "Overrode who fills in results: anyone on the couch" : "Overrode who fills in results: only people who run games",
    undo: { type: "couchFill", id: couchId, anyone: couch.anyone },
    userId: user.id,
  });
  return deskCouch(couchId);
}

export interface DeskPerson {
  id: string;
  name: string;
  email: string | null;
  couches: { id: string; name: string; role: string }[];
  games: { leagueId: string; name: string; role: string }[];
}

export async function deskPerson(id: string): Promise<DeskPerson> {
  const { rows } = await pool.query(`SELECT id, COALESCE(username, name) AS name, email FROM "user" WHERE id = $1`, [id]);
  if (!rows.length) throw new HttpError(404, "Nobody by that id");
  const { rows: couches } = await pool.query("SELECT c.id, c.name, m.role FROM couch_members m JOIN couches c ON c.id = m.couch_id WHERE m.user_id = $1 ORDER BY c.name", [id]);
  const { rows: games } = await pool.query("SELECT l.id, l.name, m.role FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = $1 ORDER BY l.name", [id]);
  return { id, name: rows[0].name, email: rows[0].email, couches, games: games.map((g) => ({ leagueId: g.id, name: g.name, role: g.role })) };
}

export interface DeskShow {
  id: string;
  name: string;
  format: string | null;
  seasons: { id: string; name: string; status: string | null }[];
}

export async function deskShow(id: string): Promise<DeskShow> {
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const { rows } = await pool.query("SELECT id, name, format FROM shows WHERE id = $1", [id]);
  if (!rows.length) throw new HttpError(404, "Show not found");
  const { rows: seasons } = await pool.query(
    "SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.status FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1 ORDER BY ss.season_number DESC",
    [id]
  );
  return { id, name: rows[0].name, format: rows[0].format, seasons };
}
