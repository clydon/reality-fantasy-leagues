import type { PoolClient } from "pg";
import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import type { GameUndo } from "./change-log";
import { setWhoFills } from "./community-results";
import { ensureOwner } from "./couches";
import { likeOf, pool, tx, HttpError } from "./db";
import { byNewest, deskLines, logDesk, STRANDED, type DeskLine } from "./desk";
import { plural } from "./desk-dates";
import { deleteLeagueIn, purgeDeleted, RESTORE_DAYS, restoreGame } from "./end-game";
import { gameName, LEAGUE_SEASON_NAME } from "./league-season";
import { notifyCouchDeleted } from "./push-events";
import { artAutomatic, chooseArt, deskArt, findArtForShow, findArtLater, setArtOff, type DeskArt } from "./show-art";

// Couches, people and shows on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminEntity):
// a couch's people, its games and who runs each, who fills in its results (Override), and the games nobody runs (its only
// Commissioner left or deleted their account: the Inbox's couch nobody runs), which its page hands on through Hand on
// (desk-seats.ts handOn, with no `from`: docs/PLAN-desk-parity.md step 2). (A person is desk-people.ts's.) A show's seasons, to go to, who added it (step 10 part 3: a show added by
// name waits in the Inbox until the desk says Looks fine or archives it), and New season.
//
// Find › Couches and a couch's Delete (docs/PLAN-desk-parity.md part 6d; the mock's desk.js DK_LIST.couches and
// desk-pages.js dkCouchPage): every couch by its name or who runs it (All · Nobody runs it · New this month · Deleted;
// newest, most people, name; 25 at a time), and its Delete, last (decision 4; neither app had one): its games go too, each
// the new design's soft delete with its line (end-game.ts deleteLeagueIn, in the same transaction); its people come off
// it (their rows kept in the delete's line, `after.members`) and hear once; its chat and history go with it (nothing reads
// a deleted couch: couches.ts requireCouch). Restorable for 30 days from Couches › Deleted: Restore puts its people back and
// brings back the games it took (each one's delete line undone), with Undo (deleted again, nobody told twice); then it goes
// for good on its own (end-game.ts purgeDeleted). A test couch (Settings › Test couch) isn't deleted from here.

const nameOf = (user: SessionUser) => (user as { username?: string | null }).username || user.name;
const TEST_OFF = "A test couch goes from Settings › Test couch";

// ---------- Find › Couches ----------

export const COUCH_FILTERS = ["all", "nobody", "new", "deleted"] as const;
export type CouchFilter = (typeof COUCH_FILTERS)[number];
export const COUCH_SORTS = ["new", "big", "name"] as const;
export type CouchSort = (typeof COUCH_SORTS)[number];
export const COUCHES_PAGE = 25;

export interface CouchRow {
  id: string;
  name: string;
  /** On it now (a deleted one: on it when it went). */
  people: number;
  /** Its games, ended and archived ones too (a deleted one: the games it took with it). */
  games: number;
  /** Who runs its games (their Commissioners); with no games, whoever has the couch. */
  runBy: string[];
  /** Its games people play that nobody runs (the Inbox's couch nobody runs). */
  stranded: number;
  startedAt: string;
  /** Deleted: when, by whom, and the day it goes for good on its own. */
  deleted: { at: string; by: string | null; until: string } | null;
}

export interface CouchesList {
  couches: CouchRow[];
  total: number;
  counts?: Record<CouchFilter, number>;
}

const LIVE_GAME = `l.couch_id = c.id AND l.deleted_at IS NULL`;
/** Every couch but one deleted more than 30 days ago (it goes for good the next time anyone deletes a game). */
const ALIVE = `(c.deleted_at IS NULL OR c.deleted_at > now() - make_interval(days => ${RESTORE_DAYS}))`;
/** A deleted couch's line on the desk: who was on it and the games it took (Restore reads it). */
const DELETE_LINE = `SELECT a.after FROM admin_changes a WHERE a.entity = 'couch' AND a.entity_id = c.id::text AND a.action = 'delete' AND a.undone_at IS NULL
  ORDER BY a.created_at DESC LIMIT 1`;
/** The first of this month, as the couches' clock has it (Eastern, as the shows air). */
const THIS_MONTH = `(date_trunc('month', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York')`;
const FACTS = `CROSS JOIN LATERAL (SELECT
    CASE WHEN c.deleted_at IS NULL THEN (SELECT count(*)::int FROM couch_members m WHERE m.couch_id = c.id)
         ELSE (SELECT count(*)::int FROM jsonb_populate_recordset(NULL::couch_members, (${DELETE_LINE})->'members') r
                WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = r.user_id)) END AS people,
    CASE WHEN c.deleted_at IS NULL THEN (SELECT count(*)::int FROM leagues l WHERE ${LIVE_GAME})
         ELSE (SELECT count(*)::int FROM leagues l WHERE l.couch_id = c.id AND l.deleted_at = c.deleted_at) END AS games,
    CASE WHEN c.deleted_at IS NULL THEN (SELECT count(*)::int FROM leagues l WHERE ${LIVE_GAME} AND l.solo IS DISTINCT FROM 'public' AND ${STRANDED}) ELSE 0 END AS stranded) k`;
const RUNNERS = `ARRAY(SELECT DISTINCT COALESCE(u.username, u.name) FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.role = 'commissioner'
    JOIN "user" u ON u.id = m.user_id WHERE ${LIVE_GAME} ORDER BY 1) AS runners,
  (SELECT COALESCE(u.username, u.name) FROM couch_members m JOIN "user" u ON u.id = m.user_id WHERE m.couch_id = c.id AND m.role = 'owner' LIMIT 1) AS owner`;
const COLUMNS = `c.id, c.name, c.created_at, c.deleted_at, COALESCE(db.username, db.name) AS deleted_by, k.people, k.games, k.stranded, ${RUNNERS}`;
const FROM = `couches c ${FACTS} LEFT JOIN "user" db ON db.id = c.deleted_by`;

const WHERE_FILTER: Record<CouchFilter, string> = {
  all: `c.deleted_at IS NULL`,
  nobody: `c.deleted_at IS NULL AND k.stranded > 0`,
  new: `c.deleted_at IS NULL AND c.created_at >= ${THIS_MONTH}`,
  deleted: `c.deleted_at IS NOT NULL`,
};

const ORDER: Record<CouchSort, string> = {
  new: `c.created_at DESC, c.id`,
  big: `k.people DESC, c.created_at DESC, c.id`,
  name: `lower(c.name), c.id`,
};

const untilOf = (at: Date) => new Date(at.getTime() + RESTORE_DAYS * 864e5).toISOString();

const rowOf = (r: Record<string, unknown>): CouchRow => ({
  id: r.id as string,
  name: r.name as string,
  people: r.people as number,
  games: r.games as number,
  runBy: (r.runners as string[]).length ? (r.runners as string[]) : !r.games && r.owner ? [r.owner as string] : [],
  stranded: r.stranded as number,
  startedAt: (r.created_at as Date).toISOString(),
  deleted: r.deleted_at ? { at: (r.deleted_at as Date).toISOString(), by: (r.deleted_by as string | null) ?? null, until: untilOf(r.deleted_at as Date) } : null,
});

/** Matches $n against a couch's name, whoever has it, and the Commissioners of its games (a deleted one's, from its line and
 *  the lines of the games it took: their rows went with them). */
function searchOf(term: string, params: unknown[]): string {
  params.push(likeOf(term));
  const n = params.length;
  const who = `(u.username ILIKE $${n} OR u.name ILIKE $${n})`;
  return `(c.name ILIKE $${n}
    OR EXISTS (SELECT 1 FROM couch_members m JOIN "user" u ON u.id = m.user_id WHERE m.couch_id = c.id AND m.role = 'owner' AND ${who})
    OR EXISTS (SELECT 1 FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.role = 'commissioner' JOIN "user" u ON u.id = m.user_id WHERE ${LIVE_GAME} AND ${who})
    OR (c.deleted_at IS NOT NULL AND (
      EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::couch_members, (${DELETE_LINE})->'members') r JOIN "user" u ON u.id = r.user_id WHERE r.role = 'owner' AND ${who})
      OR EXISTS (SELECT 1 FROM leagues l JOIN league_changes ch ON ch.league_id = l.id AND ch.kind = 'game.delete' AND ch.undone_at IS NULL
                   CROSS JOIN LATERAL jsonb_populate_recordset(NULL::league_memberships, ch.undo->'memberships') r JOIN "user" u ON u.id = r.user_id
                  WHERE l.couch_id = c.id AND l.deleted_at = c.deleted_at AND r.role = 'commissioner' AND ${who}))))`;
}

/** Each filter's size, unsearched (the chips' counts). */
export async function couchCounts(): Promise<Record<CouchFilter, number>> {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE ${WHERE_FILTER.all})::int AS "all", count(*) FILTER (WHERE ${WHERE_FILTER.nobody})::int AS nobody,
            count(*) FILTER (WHERE ${WHERE_FILTER.new})::int AS "new", count(*) FILTER (WHERE ${WHERE_FILTER.deleted})::int AS deleted
       FROM couches c ${FACTS} WHERE ${ALIVE}`
  );
  return rows[0];
}

/** One page of Find › Couches: filtered, sorted, searched by its name or who runs it. */
export async function deskCouches(opts: { q?: string | null; f?: string | null; sort?: string | null; offset?: unknown; limit?: unknown; counts?: boolean }): Promise<CouchesList> {
  const f: CouchFilter = COUCH_FILTERS.includes(opts.f as CouchFilter) ? (opts.f as CouchFilter) : "all";
  const sort: CouchSort = COUCH_SORTS.includes(opts.sort as CouchSort) ? (opts.sort as CouchSort) : "new";
  const offset = Math.min(1_000_000, Math.max(0, Math.floor(Number(opts.offset) || 0)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || COUCHES_PAGE)));
  const term = (opts.q ?? "").trim();
  const params: unknown[] = [];
  let where = WHERE_FILTER[f];
  if (term) where = `${where} AND ${searchOf(term, params)}`;
  const sql = `FROM ${FROM} WHERE ${ALIVE} AND ${where}`;
  const [{ rows: total }, { rows }, counts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n ${sql}`, params),
    pool.query(`SELECT ${COLUMNS} ${sql} ORDER BY ${ORDER[sort]} LIMIT ${limit} OFFSET ${offset}`, params),
    opts.counts === false ? null : couchCounts(),
  ]);
  return { couches: rows.map(rowOf), total: total[0].n, ...(counts ? { counts } : {}) };
}

/** Find's couches: the first few that match, and how many do (Find links the rest to Couches). */
export async function findCouches(term: string, n = 3): Promise<{ couches: CouchRow[]; total: number }> {
  const { couches, total } = await deskCouches({ q: term, f: "all", sort: "new", limit: n, counts: false });
  return { couches, total };
}

/** Browse's line for Couches: how many, how many nobody runs, and how many deleted ones can still come back. */
export async function browseCouches(): Promise<{ all: number; nobody: number; deleted: number }> {
  const c = await couchCounts();
  return { all: c.all, nobody: c.nobody, deleted: c.deleted };
}

// ---------- a couch ----------

export interface DeskCouch {
  id: string;
  name: string;
  startedAt: string;
  /** On it now (a deleted one: who was on it when it went, who still has an account). `colour`: the one they chose for
   *  their face (null: their id picks one). */
  members: { userId: string; name: string; role: string; colour: string | null }[];
  /** Its games, not deleted (a deleted couch: the games it took with it, `deleted`). */
  games: { leagueId: string; name: string; season: string; gameName: string; runners: string[]; players: { userId: string; name: string }[]; deleted: boolean }[];
  anyone: boolean;
  rulings: number;
  /** Games nobody runs, and who could take each on (people who play it). */
  stranded: { leagueId: string; name: string }[];
  /** Who runs its games (their Commissioners); with no games, whoever has the couch. */
  runBy: string[];
  /** Deleted: when, by whom, the day it goes for good on its own, and whether its delete line can still bring it back. */
  deleted: { at: string; by: string | null; until: string; restorable: boolean } | null;
  /** Why it has no Delete here (a test couch), else null. */
  off: string | null;
  history: DeskLine[];
}

type Gone = { members?: Record<string, unknown>[]; games?: { id: string; batch: string }[] } | null;

export async function deskCouch(id: string): Promise<DeskCouch> {
  if (!isUuid(id)) throw new HttpError(404, "Couch not found");
  const { rows: c } = await pool.query(
    `SELECT c.id, c.name, c.results_by_anyone, c.created_at, c.deleted_at, COALESCE(cb.username, cb.name) AS started_by, COALESCE(db.username, db.name) AS deleted_by,
            EXISTS (SELECT 1 FROM test_couches t WHERE t.couch_id = c.id) AS test, (${DELETE_LINE}) AS gone
       FROM couches c LEFT JOIN "user" cb ON cb.id = c.created_by LEFT JOIN "user" db ON db.id = c.deleted_by WHERE c.id = $1 AND ${ALIVE}`,
    [id]
  );
  if (!c.length) throw new HttpError(404, "Couch not found");
  const deleted = !!c[0].deleted_at;
  const gone = c[0].gone as Gone;
  // A deleted couch's people are in its delete line (they came off it); its games are the ones it took with it.
  const { rows: members } = deleted
    ? await pool.query(
        `SELECT r.user_id, COALESCE(u.username, u.name) AS name, r.role, st.colour FROM jsonb_populate_recordset(NULL::couch_members, $1::jsonb) r
           JOIN "user" u ON u.id = r.user_id LEFT JOIN user_settings st ON st.user_id = r.user_id ORDER BY r.role DESC, u.username`,
        [JSON.stringify(gone?.members ?? [])]
      )
    : await pool.query(
        `SELECT m.user_id, COALESCE(u.username, u.name) AS name, m.role, st.colour FROM couch_members m JOIN "user" u ON u.id = m.user_id
           LEFT JOIN user_settings st ON st.user_id = m.user_id WHERE m.couch_id = $1 ORDER BY m.role DESC, u.username`,
        [id]
      );
  const { rows: leagues } = await pool.query(
    `SELECT l.id, l.name, l.state->'settings'->>'leagueTypeId' AS type, l.state->'settings'->>'showId' AS show, l.state->'settings'->>'wikiSeason' AS season,
            ${LEAGUE_SEASON_NAME} AS season_name
       FROM leagues l JOIN couches c ON c.id = l.couch_id
      WHERE l.couch_id = $1 AND (CASE WHEN c.deleted_at IS NULL THEN l.deleted_at IS NULL ELSE l.deleted_at = c.deleted_at END) ORDER BY l.name`,
    [id]
  );
  const ids = leagues.map((l) => l.id as string);
  // A deleted game's seats are in its delete line's undo (they went with it).
  const { rows: seats } = deleted
    ? await pool.query(
        `SELECT DISTINCT ON (ch.league_id, r.user_id) ch.league_id, r.user_id, r.role, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS site
           FROM league_changes ch CROSS JOIN LATERAL jsonb_populate_recordset(NULL::league_memberships, ch.undo->'memberships') r JOIN "user" u ON u.id = r.user_id
          WHERE ch.league_id = ANY($1::uuid[]) AND ch.kind = 'game.delete' AND ch.undone_at IS NULL ORDER BY ch.league_id, r.user_id, ch.created_at DESC`,
        [ids]
      )
    : await pool.query(
        `SELECT m.league_id, m.user_id, m.role, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS site FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = ANY($1::uuid[])`,
        [ids]
      );
  const { rows: rulings } = await pool.query("SELECT count(DISTINCT decision_id)::int AS n FROM league_rulings WHERE league_id = ANY($1::uuid[])", [ids]);
  const games = leagues.map((l) => ({
    leagueId: l.id,
    name: l.name,
    // By its name ("Survivor 51"), else as its state has it (a season that isn't in the catalog).
    season: l.season_name ?? [l.show, l.season].filter(Boolean).join(" "),
    gameName: gameName(l.type),
    runners: seats
      .filter((s) => s.league_id === l.id && (s.role === "commissioner" || s.role === "admin" || s.site))
      .map((s) => `${s.name}${s.role === "admin" ? " (Game admin)" : s.role !== "commissioner" ? " (site admin)" : ""}`),
    players: seats.filter((s) => s.league_id === l.id).map((s) => ({ userId: s.user_id, name: s.name })),
    deleted,
  }));
  const { rows: lines } = await pool.query(
    `SELECT ch.text, ch.created_at, COALESCE(u.username, u.name) AS who FROM league_changes ch LEFT JOIN "user" u ON u.id = ch.user_id
      WHERE ch.league_id = ANY($1::uuid[]) AND ch.kind IN ('role', 'settings.fill', 'member') ORDER BY ch.created_at DESC LIMIT 15`,
    [ids]
  );
  const runners = [...new Set(seats.filter((s) => s.role === "commissioner").map((s) => s.name as string))].sort();
  // Delete and Restore each change how the couch stands, so only the newest of them can be undone (as a game's page has it).
  const { rows: turns } = await pool.query(
    "SELECT id FROM admin_changes WHERE entity = 'couch' AND entity_id = $1 AND action IN ('delete', 'restore') ORDER BY created_at DESC, id",
    [id]
  );
  const older = new Set(turns.slice(1).map((t) => t.id as string));
  const desk = (await deskLines("couch", id)).map((l) => (l.id && older.has(l.id) ? { ...l, undoable: false } : l));
  const owner = members.find((m) => m.role === "owner");
  const startedAt = (c[0].created_at as Date).toISOString();
  return {
    id,
    name: c[0].name,
    startedAt,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, role: m.role, colour: m.colour ?? null })),
    games,
    anyone: c[0].results_by_anyone,
    rulings: rulings[0].n,
    stranded: deleted
      ? []
      : games
          .filter((g) => g.players.length && !seats.some((s) => s.league_id === g.leagueId && (s.role === "commissioner" || s.site)))
          .map((g) => ({ leagueId: g.leagueId, name: g.name })),
    runBy: runners.length ? runners : !games.length && owner ? [owner.name] : [],
    deleted: deleted
      ? { at: (c[0].deleted_at as Date).toISOString(), by: c[0].deleted_by ?? null, until: untilOf(c[0].deleted_at as Date), restorable: !!gone }
      : null,
    off: c[0].test ? TEST_OFF : null,
    history: byNewest([
      ...lines.map((r) => ({ id: null, text: `${r.who ? `${r.who}: ` : ""}${r.text}`, at: r.created_at.toISOString(), who: null, undoable: false, undone: false })),
      ...desk,
      { id: null, text: c[0].started_by ? `Started by ${c[0].started_by}` : "Started", at: startedAt, who: null, undoable: false, undone: false },
    ]),
  };
}

/** Override who can fill in the couch's results. */
export async function couchFill(user: SessionUser, couchId: string, anyone: unknown): Promise<DeskCouch> {
  if (typeof anyone !== "boolean") throw new HttpError(400, "anyone is true or false");
  const couch = await deskCouch(couchId);
  if (couch.deleted) throw new HttpError(409, "It's deleted: restore it first");
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

// ---------- its Delete and Restore ----------

/**
 * Deletes a couch in one transaction: its games (each the new design's soft delete, its line in Recent changes and the
 * desk's), its people off it (kept in the couch's line for Restore), then the couch. -> who to tell, and the line.
 */
async function remove(user: SessionUser, id: string): Promise<{ name: string; games: number; told: string[]; changeId: string }> {
  await purgeDeleted();
  const who = nameOf(user);
  return tx(async (client) => {
    const { rows } = await client.query(
      "SELECT c.name, EXISTS (SELECT 1 FROM test_couches t WHERE t.couch_id = c.id) AS test FROM couches c WHERE c.id = $1 AND c.deleted_at IS NULL FOR UPDATE",
      [id]
    );
    if (!rows.length) throw new HttpError(409, "It's deleted already");
    if (rows[0].test) throw new HttpError(409, TEST_OFF);
    const name = rows[0].name as string;
    // Who's on it, as they are, before its games go (a game's delete moves its people onto the couch in their own right).
    const { rows: members } = await client.query("SELECT row_to_json(m) AS row, m.user_id FROM couch_members m WHERE m.couch_id = $1", [id]);
    const told = new Set(members.map((m) => m.user_id as string));
    const { rows: leagues } = await client.query("SELECT id, name FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL ORDER BY created_at, id", [id]);
    const games: { id: string; batch: string }[] = [];
    for (const l of leagues) {
      // Its chat stays on it (no couch or season to move it to): it comes back with it.
      const out = await deleteLeagueIn(client, user, {
        leagueId: l.id,
        gameName: l.name,
        couchId: null,
        seasonId: null,
        text: `${who} deleted ${l.name} with ${name} (restorable for ${RESTORE_DAYS} days)`,
      });
      await logDesk(client, { entity: "game", entityId: l.id, action: "delete", text: `Deleted with ${name}: restorable for ${RESTORE_DAYS} days`, after: { batch: out.batch, couch: id }, userId: user.id });
      games.push({ id: l.id, batch: out.batch });
      for (const u of out.userIds) told.add(u);
    }
    await client.query("DELETE FROM couch_members WHERE couch_id = $1", [id]);
    await client.query("UPDATE couches SET deleted_at = now(), deleted_by = $2 WHERE id = $1", [id, user.id]);
    const changeId = await logDesk(client, {
      entity: "couch",
      entityId: id,
      action: "delete",
      text: `Deleted${games.length ? `, with ${plural(games.length, "game")}` : ""}: restorable for ${RESTORE_DAYS} days`,
      after: { members: members.map((m) => m.row), games },
      userId: user.id,
    });
    return { name, games: games.length, told: [...told], changeId };
  });
}

/** What an action needs to know first: the couch (within its 30 days), whether it's deleted, and why it can't be. */
async function couchHead(id: string): Promise<{ id: string; name: string; deleted: boolean; off: string | null }> {
  if (!isUuid(id)) throw new HttpError(404, "Couch not found");
  const { rows } = await pool.query(
    `SELECT c.name, c.deleted_at IS NOT NULL AS deleted, EXISTS (SELECT 1 FROM test_couches t WHERE t.couch_id = c.id) AS test FROM couches c WHERE c.id = $1 AND ${ALIVE}`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Couch not found");
  return { id, name: rows[0].name, deleted: rows[0].deleted, off: rows[0].test ? TEST_OFF : null };
}

async function deleteIt(user: SessionUser, c: { id: string; deleted: boolean; off: string | null }): Promise<{ text: string }> {
  if (c.deleted) throw new HttpError(409, "It's deleted already");
  if (c.off) throw new HttpError(409, c.off);
  const out = await remove(user, c.id);
  notifyCouchDeleted({ userIds: out.told.filter((x) => x !== user.id), couchId: c.id, name: out.name, games: out.games, key: out.changeId });
  return { text: `Deleted ${out.name}${out.games ? ` and its ${plural(out.games, "game")}` : ""} · restore from here for ${RESTORE_DAYS} days` };
}

/** Puts a deleted couch back: the couch, its people as they were, and the games it took (each one's delete line undone). */
async function bringBack(client: PoolClient, user: SessionUser, id: string): Promise<{ name: string; back: number }> {
  const { rows } = await client.query("SELECT name FROM couches WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE", [id]);
  if (!rows.length) throw new HttpError(409, "It's back already");
  const name = rows[0].name as string;
  const { rows: line } = await client.query(
    `SELECT id, after FROM admin_changes WHERE entity = 'couch' AND entity_id = $1 AND action = 'delete' AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [id]
  );
  if (!line.length) throw new HttpError(409, "It can't be restored from here");
  const after = (line[0].after ?? {}) as NonNullable<Gone>;
  await client.query("UPDATE couches SET deleted_at = NULL, deleted_by = NULL WHERE id = $1", [id]);
  // Someone whose account went meanwhile doesn't come back.
  await client.query(
    `INSERT INTO couch_members SELECT r.* FROM jsonb_populate_recordset(NULL::couch_members, $1::jsonb) r
      WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = r.user_id) ON CONFLICT DO NOTHING`,
    [JSON.stringify(after.members ?? [])]
  );
  let back = 0;
  for (const g of after.games ?? []) {
    // A game deleted for good meanwhile stays gone.
    const { rows: del } = await client.query(
      `SELECT ch.id, ch.undo FROM league_changes ch JOIN leagues l ON l.id = ch.league_id
        WHERE ch.league_id = $1 AND ch.batch = $2 AND ch.kind = 'game.delete' AND ch.undone_at IS NULL AND ch.undo IS NOT NULL AND l.deleted_at IS NOT NULL FOR UPDATE OF ch`,
      [g.id, g.batch]
    );
    if (!del.length) continue;
    await restoreGame(client, g.id, del[0].undo as GameUndo);
    await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [del[0].id, user.id]);
    await logDesk(client, { entity: "game", entityId: g.id, action: "restore", text: `Restored with ${name}: everyone's teams, picks and scores as they were`, userId: user.id });
    back++;
  }
  await ensureOwner(client, id);
  await client.query("UPDATE admin_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [line[0].id, user.id]);
  return { name, back };
}

/** Restore a deleted couch (from its row or its page). Undo deletes it again. */
async function restore(user: SessionUser, c: { id: string; deleted: boolean }): Promise<{ changeId: string; text: string }> {
  if (!c.deleted) throw new HttpError(409, "It's back already");
  const { changeId, back, name } = await tx(async (client) => {
    const out = await bringBack(client, user, c.id);
    const changeId = await logDesk(client, {
      entity: "couch",
      entityId: c.id,
      action: "restore",
      text: `Restored${out.back ? `, with ${plural(out.back, "game")}` : ""}: its people, games and chat as they were`,
      undo: { type: "couchRestore", id: c.id },
      userId: user.id,
    });
    return { changeId, ...out };
  });
  return { changeId, text: `${name} is back, with ${plural(back, "game")}` };
}

/**
 * Restore's Undo: deleted again, restorable for another 30 days (nobody's told twice); refused once anything's changed since
 * (a game started, archived, deleted or brought back on it, someone joined it, or another change on its page).
 */
export async function restoreCouchRestored(user: SessionUser, changeId: string, u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  if (!isUuid(id)) throw new HttpError(404, "Couch not found");
  const { rows } = await pool.query(
    `WITH t AS (SELECT created_at AS at FROM admin_changes WHERE id = $2)
     SELECT 1 FROM admin_changes a, t WHERE a.entity = 'couch' AND a.entity_id = $3 AND a.id <> $2 AND (a.created_at > t.at OR a.undone_at > t.at)
      UNION ALL SELECT 1 FROM leagues l, t WHERE l.couch_id = $1 AND (l.created_at > t.at OR l.deleted_at > t.at)
      UNION ALL SELECT 1 FROM league_changes ch JOIN leagues l ON l.id = ch.league_id, t
                 WHERE l.couch_id = $1 AND ch.kind IN ('game.archive', 'game.delete') AND (ch.created_at > t.at OR ch.undone_at > t.at)
      UNION ALL SELECT 1 FROM couch_members m, t WHERE m.couch_id = $1 AND m.joined_at > t.at LIMIT 1`,
    [id, changeId, id]
  );
  if (rows.length) throw new HttpError(409, "It's changed since: undo the later change first");
  await remove(user, id);
}

/** A couch's actions on the desk: `{ anyone }` (Override who fills in), `{ delete: true }` or `{ restore: true }`. */
export async function deskCouchAction(user: SessionUser, id: string, body: { anyone?: unknown; delete?: unknown; restore?: unknown }): Promise<DeskCouch | { changeId?: string; text: string }> {
  if ("anyone" in body) return couchFill(user, id, body.anyone);
  const c = await couchHead(id);
  if (body.delete === true) return deleteIt(user, c);
  if (body.restore === true) return restore(user, c);
  throw new HttpError(400, "anyone, delete or restore");
}

export interface DeskShow {
  id: string;
  name: string;
  format: string | null;
  kind: string | null;
  /** A game for every couch (Make it a game, or set up by the desk); else "Not a game yet". */
  setUp: boolean;
  archived: boolean;
  /** Someone added it (Add a show): who, when, and whether it came from a TV listing (else by name, with no schedule). */
  added: { by: string | null; at: string; listing: boolean } | null;
  /** The desk looked at it (a show added by name waits in the Inbox until then). */
  reviewed: { by: string | null; at: string } | null;
  seasons: { id: string; name: string; status: string | null; number: number; rulebookId: string | null }[];
  /** Its art and the finder's state (show-art.ts): Choose art, Find art and photos, No art or photos. */
  art: DeskArt;
  history: DeskLine[];
}

export async function deskShow(id: string): Promise<DeskShow> {
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.format, s.kind, s.set_up_at, s.archived, s.created_at, s.created_by, s.tvmaze_id, s.reviewed_at,
            COALESCE(a.username, a.name) AS added_by, COALESCE(r.username, r.name) AS reviewed_by
       FROM shows s LEFT JOIN "user" a ON a.id = s.created_by LEFT JOIN "user" r ON r.id = s.reviewed_by WHERE s.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Show not found");
  const s = rows[0];
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.status, ss.season_number AS number,
            (SELECT r.id FROM rulebooks r WHERE r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived') AS "rulebookId"
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1 ORDER BY ss.season_number DESC`,
    [id]
  );
  return {
    id,
    name: s.name,
    format: s.format,
    kind: s.kind,
    setUp: !!s.set_up_at,
    archived: !!s.archived,
    added: s.created_by ? { by: s.added_by, at: s.created_at.toISOString(), listing: s.tvmaze_id != null } : null,
    reviewed: s.reviewed_at ? { by: s.reviewed_by, at: s.reviewed_at.toISOString() } : null,
    seasons,
    art: await deskArt(id),
    history: byNewest(await deskLines("show", id)),
  };
}

/**
 * The desk on a show: Looks fine (a show added by name, looked at), archived (out of everyone's search; its follows and
 * games stay), or a new season (the next number, nothing known about it yet). A set-up show's new season starts as the
 * last season's rulebook (db/rulebooks.js sameAsLastSeason) and plays by it; its cast comes from Backstage as any season's.
 */
export async function deskShowAction(user: SessionUser, id: string, body: { action?: unknown }): Promise<DeskShow & { seasonId?: string }> {
  const show = await deskShow(id);
  if (body.action === "reviewed" || body.action === "archive") {
    const archive = body.action === "archive";
    if (!archive && show.reviewed) throw new HttpError(409, "Looked at already");
    await pool.query("UPDATE shows SET reviewed_at = now(), reviewed_by = $2, archived = CASE WHEN $3 THEN true ELSE archived END, updated_at = now() WHERE id = $1", [id, user.id, archive]);
    await logDesk(pool, {
      entity: "show",
      entityId: id,
      action: String(body.action),
      text: archive ? "Archived: out of everyone's search" : "Looks fine",
      undo: { type: "showReviewed", id, archived: show.archived },
      userId: user.id,
    });
    return deskShow(id);
  }
  if (body.action === "season") {
    const next = Math.max(0, ...show.seasons.map((s) => s.number)) + 1;
    const { rows } = await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, $2, 'upcoming') ON CONFLICT (show_id, season_number) DO NOTHING RETURNING id`,
      [id, next]
    );
    if (!rows.length) throw new HttpError(409, "That season was added a moment ago");
    const seasonId = rows[0].id as string;
    if (show.setUp) await ensureSeasonRulebook(pool, seasonId);
    await logDesk(pool, { entity: "show", entityId: id, action: "season", text: `Added season ${next}${show.setUp ? ", playing by last season's rulebook" : ""}`, userId: user.id });
    findArtLater({ seasonId });
    return { ...(await deskShow(id)), seasonId };
  }
  // Art (show-art.ts): look now, choose one by hand, back to automatic, or the off switch.
  if (body.action === "findArt") {
    const found = await findArtForShow(id);
    const text = `Looked for art and photos: ${found.art ? "the show's art" : "no show art"}, ${found.seasons} season poster${found.seasons === 1 ? "" : "s"}, ${found.photos} photo${found.photos === 1 ? "" : "s"}`;
    await logDesk(pool, { entity: "show", entityId: id, action: "findArt", text, userId: user.id });
    return deskShow(id);
  }
  if (body.action === "chooseArt") {
    const what = await chooseArt(id, body as Record<string, unknown>).catch((e) => {
      throw new HttpError(400, (e as Error).message);
    });
    await logDesk(pool, { entity: "show", entityId: id, action: "chooseArt", text: `Chose ${what}`, userId: user.id });
    return deskShow(id);
  }
  if (body.action === "artAutomatic") {
    await artAutomatic(id);
    await logDesk(pool, { entity: "show", entityId: id, action: "artAutomatic", text: "Art back to automatic", userId: user.id });
    return deskShow(id);
  }
  if (body.action === "artOff") {
    const off = (body as { off?: unknown }).off === true;
    const { photos } = await setArtOff(id, off);
    const text = off ? `No art or photos: took down the art and ${photos} found photo${photos === 1 ? "" : "s"}` : "Art and photos back on";
    await logDesk(pool, { entity: "show", entityId: id, action: "artOff", text, userId: user.id });
    return deskShow(id);
  }
  throw new HttpError(400, "action is reviewed, archive, season, findArt, chooseArt, artAutomatic or artOff");
}
