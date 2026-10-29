import type { PoolClient } from "pg";
import { isUuid, type SessionUser } from "./auth-helpers";
import type { GameUndo } from "./change-log";
import { gameOver, normalizeCode } from "./couch-joins";
import { likeOf, pool, tx, withLeagueLock, HttpError } from "./db";
import { byNewest, deskLines, logDesk, STRANDED, type DeskLine } from "./desk";
import { archiveLeague, deleteLeague, purgeDeleted, RESTORE_DAYS, restoreGame } from "./end-game";
import { GAME_NAMES, gameName } from "./league-season";
import type { LeagueState } from "@/lib/game/types";
import { notifyGameDeleted } from "./push-events";
import { seasonSchedules } from "./schedule";
import { syncLeagueDecisions } from "./season-decisions";

// Games on the desk (docs/PLAN-desk-parity.md step 6, part 6a; the mock's desk.js DK_LIST.games and desk-games.js):
// Find › Games, every game by name, its season, its couch or its join code (Playing · Nobody runs it · Ended · Archived ·
// Deleted; newest, most players, name; 25 at a time), where a code-shaped search (three characters or more, any case)
// matches from the start of a code and finds its game whatever the filter, deleted ones within 30 days too; and a game's
// page: its lower third and facts, Part of (its couch, its season, its rulebook), its Join code, Hand it on when nobody runs
// it, History, and its Delete last (decision 4): Archive offered first (tier 1, Undo), then the new design's soft delete
// (end-game.ts deleteLeague: restorable for 30 days, its players told), Restore (Undo deletes it again), and for a deleted
// one, Delete for good, now. Classic's league delete was a hard DELETE FROM leagues with no way back, and its leagueDeleted
// also deleted a couch left with no games (Noticed m): the desk never does either until the 30 days are up or it's asked
// to delete for good, and a couch stays. Seats are part 6b's; Open it read-only is 6c's.

export const GAME_FILTERS = ["all", "nobody", "ended", "archived", "deleted"] as const;
export type GameFilter = (typeof GAME_FILTERS)[number];
export const GAME_SORTS = ["new", "big", "name"] as const;
export type GameSort = (typeof GAME_SORTS)[number];
export const GAMES_PAGE = 25;

export type GameState = "playing" | "nobody" | "ended" | "archived" | "deleted";

export interface GameRow {
  id: string;
  /** The league's own name ("Last Survivor Standing"). */
  name: string;
  /** Its kind in the new design ("Outlast"). */
  game: string;
  /** Its season by name, or null when it isn't on one in the catalog. */
  season: string | null;
  couch: { id: string; name: string } | null;
  /** A practice game or a season's public pool (no couch). */
  solo: "practice" | "public" | null;
  code: string;
  state: GameState;
  /** Seats someone plays (not automated, not out). */
  players: number;
  startedAt: string;
  archived: { at: string; by: string | null } | null;
  /** Deleted: when, by whom, and the day it goes for good on its own. */
  deleted: { at: string; by: string | null; until: string } | null;
  /** The search was a code and this game's code starts with it (the row leads with it, marked). */
  codeHit: boolean;
}

export interface GamesList {
  games: GameRow[];
  /** How many match (the pinned code matches with the filter's). */
  total: number;
  /** The search as a join code (upper case), when it's shaped like one: the row marks it, the empty list says why. */
  code: string | null;
  counts?: Record<GameFilter, number>;
}

/**
 * A search shaped like a join code: three to six letters and numbers, any case, a dash anywhere or one space after the
 * first three (a code read out as "7VM AEC"), as the join flow reads it (couch-joins.ts normalizeCode); else null. Two
 * words ("zt dg", "race night") aren't one; a word may be (the list's no-match tells a word from a code).
 */
export function codeQuery(q: string | null | undefined): string | null {
  const t = String(q ?? "").trim().replace(/-/g, "");
  if (!/^[a-z0-9]{3,6}$/i.test(t) && !/^[a-z0-9]{3} [a-z0-9]{1,3}$/i.test(t)) return null;
  return normalizeCode(t);
}

const SEASON = `COALESCE(ss.name, s.name || ' ' || ss.season_number)`;
const FROM = `leagues l LEFT JOIN couches c ON c.id = l.couch_id
  LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
  LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'`;
/** Every game but one deleted more than 30 days ago (it goes for good the next time anyone deletes a game). */
const ALIVE = `(l.deleted_at IS NULL OR l.deleted_at > now() - make_interval(days => ${RESTORE_DAYS}))`;
const ARCHIVED = `COALESCE(l.state->'settings'->>'archivedAt', '') <> ''`;
/** Its state, deleted before archived before ended (its season's completed) before nobody runs it (a public pool has no
 *  Commissioner: the season runs it). */
const STATE = `CASE WHEN l.deleted_at IS NOT NULL THEN 'deleted' WHEN ${ARCHIVED} THEN 'archived' WHEN ss.status = 'completed' THEN 'ended'
  WHEN l.solo IS DISTINCT FROM 'public' AND ${STRANDED} THEN 'nobody' ELSE 'playing' END`;
const PLAYERS = `(SELECT count(*)::int FROM jsonb_array_elements(COALESCE(l.state->'players', '[]'::jsonb)) p
  WHERE COALESCE(p->>'disabled', 'false') <> 'true' AND COALESCE(p->>'automated', 'false') <> 'true')`;

const WHERE_FILTER: Record<GameFilter, string> = {
  all: `st.state IN ('playing', 'nobody')`,
  nobody: `st.state = 'nobody'`,
  ended: `st.state = 'ended'`,
  archived: `st.state = 'archived'`,
  deleted: `st.state = 'deleted'`,
};

const ORDER: Record<GameSort, string> = {
  new: `l.created_at DESC, l.id`,
  big: `players DESC, l.created_at DESC, l.id`,
  name: `lower(l.name), lower(COALESCE(c.name, '')), l.id`,
};

const COLUMNS = `l.id, l.name, l.join_code, l.solo, l.created_at, l.deleted_at, c.id AS couch_id, c.name AS couch, ${SEASON} AS season,
  l.state->'settings'->>'leagueTypeId' AS type, st.state, ${PLAYERS} AS players,
  l.state->'settings'->>'archivedAt' AS archived_at, COALESCE(ab.username, ab.name) AS archived_by, COALESCE(db.username, db.name) AS deleted_by`;
const JOINS = `CROSS JOIN LATERAL (SELECT ${STATE} AS state) st
  LEFT JOIN "user" ab ON ab.id = l.state->'settings'->>'archivedBy' LEFT JOIN "user" db ON db.id = l.deleted_by`;

const rowOf = (r: Record<string, unknown>, code: string | null): GameRow => ({
  id: r.id as string,
  name: r.name as string,
  game: gameName(r.type as string | null),
  season: (r.season as string | null) ?? null,
  couch: r.couch_id ? { id: r.couch_id as string, name: r.couch as string } : null,
  solo: (r.solo as GameRow["solo"]) ?? null,
  code: r.join_code as string,
  state: r.state as GameState,
  players: r.players as number,
  startedAt: (r.created_at as Date).toISOString(),
  archived: r.state === "archived" && r.archived_at ? { at: new Date(r.archived_at as string).toISOString(), by: (r.archived_by as string | null) ?? null } : null,
  deleted: r.deleted_at
    ? {
        at: (r.deleted_at as Date).toISOString(),
        by: (r.deleted_by as string | null) ?? null,
        until: new Date((r.deleted_at as Date).getTime() + RESTORE_DAYS * 864e5).toISOString(),
      }
    : null,
  codeHit: !!code && String(r.join_code).startsWith(code),
});

/** Matches $n against a game's name, its season, its show, its couch, and its kind ("Outlast"); a whole code too. */
function searchOf(term: string, params: unknown[]): string {
  params.push(likeOf(term));
  const n = params.length;
  const t = term.toLowerCase();
  const kinds = Object.entries(GAME_NAMES)
    .filter(([, name]) => name.toLowerCase().includes(t))
    .map(([id]) => id);
  params.push(kinds);
  const k = params.length;
  params.push(normalizeCode(term));
  return `(l.name ILIKE $${n} OR c.name ILIKE $${n} OR ${SEASON} ILIKE $${n} OR s.name ILIKE $${n}
    OR COALESCE(l.state->'settings'->>'leagueTypeId', 'classic-draft') = ANY($${k}::text[]) OR l.join_code = $${params.length})`;
}

/** Each filter's size, unsearched (the chips' counts). */
export async function gameCounts(): Promise<Record<GameFilter, number>> {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE ${WHERE_FILTER.all})::int AS "all", count(*) FILTER (WHERE ${WHERE_FILTER.nobody})::int AS nobody,
            count(*) FILTER (WHERE ${WHERE_FILTER.ended})::int AS ended, count(*) FILTER (WHERE ${WHERE_FILTER.archived})::int AS archived,
            count(*) FILTER (WHERE ${WHERE_FILTER.deleted})::int AS deleted
       FROM ${FROM} CROSS JOIN LATERAL (SELECT ${STATE} AS state) st WHERE ${ALIVE}`
  );
  return rows[0];
}

/**
 * One page of Find › Games. A code-shaped search (codeQuery) also finds every game whose code starts with it, whatever the
 * filter (a deleted one within its 30 days too); the rest is the filter's, searched.
 */
export async function deskGames(opts: { q?: string | null; f?: string | null; sort?: string | null; offset?: unknown; limit?: unknown; counts?: boolean }): Promise<GamesList> {
  const f: GameFilter = GAME_FILTERS.includes(opts.f as GameFilter) ? (opts.f as GameFilter) : "all";
  const sort: GameSort = GAME_SORTS.includes(opts.sort as GameSort) ? (opts.sort as GameSort) : "new";
  const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || GAMES_PAGE)));
  const term = (opts.q ?? "").trim();
  const code = codeQuery(term);
  const params: unknown[] = [];
  let where = WHERE_FILTER[f];
  if (term) where = `${where} AND ${searchOf(term, params)}`;
  if (code) {
    params.push(`${code}%`);
    where = `(${where}) OR l.join_code LIKE $${params.length}`;
  }
  const sql = `FROM ${FROM} ${JOINS} WHERE ${ALIVE} AND (${where})`;
  const [{ rows: total }, { rows }, counts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n ${sql}`, params),
    pool.query(`SELECT ${COLUMNS} ${sql} ORDER BY ${ORDER[sort]} LIMIT ${limit} OFFSET ${offset}`, params),
    opts.counts === false ? null : gameCounts(),
  ]);
  return { games: rows.map((r) => rowOf(r, code)), total: total[0].n, code, ...(counts ? { counts } : {}) };
}

/** Find's games: the first few that match (a code whatever its state), and how many do (Find links the rest to Games). */
export async function findGames(term: string, n = 3): Promise<{ games: GameRow[]; total: number; code: string | null }> {
  const { games, total, code } = await deskGames({ q: term, f: "all", sort: "new", limit: n, counts: false });
  return { games, total, code };
}

/** Browse's line for Games: how many play, and how many deleted ones can still come back. */
export async function browseGames(): Promise<{ playing: number; deleted: number }> {
  const c = await gameCounts();
  return { playing: c.all, deleted: c.deleted };
}

// ---------- a game ----------

export interface DeskGame extends GameRow {
  seasonId: string | null;
  /** Its season's poster, else its show's. */
  art: string | null;
  /** What it plays by: its own copy, else its season's rulebook. */
  rulebook: { id: string; own: boolean } | null;
  /** Its Commissioners by name (a deleted one: who ran it when it went). */
  runBy: string[];
  startedBy: string | null;
  /** Its couch's other games, not deleted (the delete's "untouched"). */
  others: number;
  /** A deleted one can come back (its delete line's Undo still stands). */
  restorable: boolean;
  /** Why it can't be archived or deleted from here (a season's public pool goes with its season), else null. */
  off: string | null;
  history: DeskLine[];
}

export async function deskGame(id: string): Promise<DeskGame> {
  if (!isUuid(id)) throw new HttpError(404, "No game by that id");
  const { rows } = await pool.query(
    `SELECT ${COLUMNS}, ss.id AS season_id, COALESCE(ss.art_url, s.art_url) AS art, l.created_by, COALESCE(cb.username, cb.name) AS started_by,
            (SELECT r.id FROM rulebooks r WHERE r.owner_kind = 'league' AND r.league_id = l.id AND r.status <> 'archived' LIMIT 1) AS own_book,
            (SELECT r.id FROM rulebooks r WHERE r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived' LIMIT 1) AS season_book,
            (SELECT count(*)::int FROM leagues o WHERE o.couch_id = l.couch_id AND o.id <> l.id AND o.deleted_at IS NULL) AS others
       FROM ${FROM} ${JOINS} LEFT JOIN "user" cb ON cb.id = l.created_by WHERE l.id = $1 AND ${ALIVE}`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "That game is gone for good");
  const r = rows[0];
  const [{ rows: runners }, { rows: del }, { rows: changes }, desk] = await Promise.all([
    pool.query(
      // A site admin in a seat runs it too (as Nobody runs it counts them: desk.ts STRANDED).
      `SELECT COALESCE(u.username, u.name) || CASE WHEN m.role = 'commissioner' THEN '' ELSE ' (site admin)' END AS name
         FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = $1 AND (m.role = 'commissioner' OR u.role = 'admin')
        ORDER BY m.role = 'commissioner' DESC, m.created_at`,
      [id]
    ),
    pool.query(
      `SELECT c.undo FROM league_changes c WHERE c.league_id = $1 AND c.kind = 'game.delete' AND c.undone_at IS NULL AND c.undo IS NOT NULL AND c.undo_until > now()
        ORDER BY c.created_at DESC LIMIT 1`,
      [id]
    ),
    pool.query(
      `SELECT c.batch, c.kind, c.text, c.created_at, c.undone_at, COALESCE(u.username, u.name) AS who FROM league_changes c LEFT JOIN "user" u ON u.id = c.user_id
        WHERE c.league_id = $1 ORDER BY c.created_at DESC LIMIT 40`,
      [id]
    ),
    deskLines("game", id),
  ]);
  // A deleted game's Commissioners are in its delete line's undo (their seats went with it).
  let runBy = runners.map((x) => x.name as string);
  if (r.deleted_at && del[0]) {
    const ids = (del[0].undo as GameUndo).commissioners;
    const { rows: names } = await pool.query(`SELECT COALESCE(username, name) AS name FROM "user" WHERE id = ANY($1::text[])`, [ids]);
    runBy = names.map((x) => x.name as string);
  }
  // The desk's own lines stand for the game's line they made (Archive, Delete), so each shows once; one undone from
  // Backstage's Recent changes shows undone here too.
  const { rows: mine } = await pool.query(`SELECT id, after->>'batch' AS batch FROM admin_changes WHERE entity = 'game' AND entity_id = $1 AND after ? 'batch'`, [id]);
  const made = new Set(mine.map((x) => x.batch as string));
  const batchOf = new Map(mine.map((x) => [x.id as string, x.batch as string]));
  const undoneThere = new Set(changes.filter((c) => c.undone_at).map((c) => c.batch as string));
  const lines = desk.map((l) => (l.id && undoneThere.has(batchOf.get(l.id) ?? "") ? { ...l, undone: true, undoable: false } : l));
  const row = rowOf(r, null);
  // Over as the app has it (couch-joins.ts gameOver): the list goes by its season's being completed, which a span that's
  // finished, or a winner before the finale, doesn't wait for.
  if (row.state === "playing" || row.state === "nobody") {
    const { rows: st } = await pool.query("SELECT state FROM leagues WHERE id = $1", [id]);
    const schedule = r.season_id ? (await seasonSchedules([r.season_id])).get(r.season_id) : undefined;
    if (st[0] && gameOver(st[0].state as LeagueState, schedule)) row.state = "ended";
  }
  // Archive, Delete and Restore each change how the game stands, so only the newest of them (the desk's, or one from
  // Backstage) can be undone: an older one's Undo would act on what's happened since.
  const newest = Math.max(0, ...lines.map((l) => Date.parse(l.at)), ...changes.filter((c) => GAME_KINDS.includes(c.kind)).map((c) => (c.created_at as Date).getTime()));
  return {
    ...row,
    seasonId: r.season_id ?? null,
    art: r.art ?? null,
    rulebook: r.own_book ? { id: r.own_book, own: true } : r.season_book ? { id: r.season_book, own: false } : null,
    runBy,
    startedBy: r.started_by ?? null,
    others: r.couch_id ? r.others : 0,
    restorable: !!r.deleted_at && !!del[0],
    off: r.solo === "public" ? "A season's public pool goes with its season" : null,
    history: byNewest([
      ...lines.map((l) => (l.undoable && Date.parse(l.at) < newest ? { ...l, undoable: false } : l)),
      ...changes
        .filter((c) => !made.has(c.batch))
        .map((c) => ({ id: null, text: c.text as string, at: (c.created_at as Date).toISOString(), who: (c.who as string | null) ?? null, undoable: false, undone: !!c.undone_at })),
      { id: null, text: r.started_by ? `Started by ${r.started_by}` : "Started", at: row.startedAt, who: null, undoable: false, undone: false },
    ]),
  };
}

const named = (g: { name: string; couch: { name: string } | null }) => (g.couch ? `${g.name} on ${g.couch.name}` : g.name);

/** The game's own lines that change how it stands (Archive, Delete), from the desk or Backstage. */
const GAME_KINDS = ["game.archive", "game.delete"];

/**
 * Refused once the game has been archived, deleted or restored since the desk's change `changeId` (by the desk or from
 * Backstage). Compared in SQL: a JavaScript date drops the microseconds, and the change's own lines share its moment.
 */
async function nothingSince(db: Pick<PoolClient, "query">, id: string, changeId: string): Promise<void> {
  const { rows } = await db.query(
    `WITH t AS (SELECT created_at AS at FROM admin_changes WHERE id = $3)
     SELECT 1 FROM league_changes, t WHERE league_id = $1::uuid AND kind = ANY($2) AND (created_at > t.at OR undone_at > t.at)
      UNION ALL SELECT 1 FROM admin_changes a, t WHERE a.entity = 'game' AND a.entity_id = $4 AND a.id <> $3 AND (a.created_at > t.at OR a.undone_at > t.at) LIMIT 1`,
    [id, GAME_KINDS, changeId, id]
  );
  if (rows.length) throw new HttpError(409, "It's changed since: undo the later change first");
}

/** Archive it (tier 1): on its couch and the trophy shelf as it stood, nothing scores it. Undo from the toast or History. */
async function archive(user: SessionUser, g: DeskGame): Promise<{ changeId: string; text: string }> {
  if (g.deleted) throw new HttpError(409, "It's deleted: restore it first");
  if (g.archived) throw new HttpError(409, `${g.name} is archived already`);
  let changeId = "";
  await archiveLeague(user, g.id, g.name, async (client, batch) => {
    changeId = await logDesk(client, {
      entity: "game",
      entityId: g.id,
      action: "archive",
      text: "Archived: on the trophy shelf as it stood, nothing scores it",
      after: { batch },
      undo: { type: "gameArchive", id: g.id, batch },
      userId: user.id,
    });
  });
  return { changeId, text: `${g.name} archived` };
}

/** Archive's Undo: it scores again, and whatever came in meanwhile reaches it; its line in Recent changes is undone too. */
export async function restoreArchive(user: SessionUser, changeId: string, u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  const { rows } = await pool.query("SELECT deleted_at FROM leagues WHERE id = $1", [id]);
  if (!rows.length) throw new HttpError(404, "That game is gone for good");
  if (rows[0].deleted_at) throw new HttpError(409, "It's been deleted since: restore it first");
  await withLeagueLock(id, async (s, client) => {
    if (!s.settings.archivedAt) throw new HttpError(409, "It's been brought back already");
    await nothingSince(client, id, changeId);
    delete s.settings.archivedAt;
    delete s.settings.archivedBy;
    await syncLeagueDecisions(client, id, s);
    const { rowCount } = await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE batch = $1 AND undone_at IS NULL", [String(u.batch), user.id]);
    if (!rowCount) throw new HttpError(409, "It's been brought back already");
  });
}

/** Delete it (tier 3): out of its couch's games, its players told, restorable for 30 days from Games › Deleted. */
async function remove(user: SessionUser, g: DeskGame): Promise<{ batch: string; userIds: string[] }> {
  if (g.off) throw new HttpError(409, g.off);
  if (g.deleted) throw new HttpError(409, "That game's deleted already");
  await purgeDeleted();
  return deleteLeague(user, { leagueId: g.id, gameName: g.name, couchId: g.couch?.id ?? null, seasonId: g.seasonId }, async (client, batch) => {
    await logDesk(client, { entity: "game", entityId: g.id, action: "delete", text: `Deleted: restorable for ${RESTORE_DAYS} days`, after: { batch }, userId: user.id });
  });
}

async function deleteIt(user: SessionUser, g: DeskGame): Promise<{ text: string }> {
  const { batch, userIds } = await remove(user, g);
  notifyGameDeleted({ userIds: userIds.filter((x) => x !== user.id), leagueId: g.id, name: g.name, couch: g.couch?.name ?? null, seasonId: g.seasonId, batch });
  return { text: `Deleted ${g.name} · restore it from here for ${RESTORE_DAYS} days` };
}

/** Restore a deleted game: everyone's teams, picks and scores as they were (its delete line is undone). Undo deletes it again. */
async function restore(user: SessionUser, g: DeskGame): Promise<{ changeId: string; text: string }> {
  if (!g.deleted) throw new HttpError(409, "It's back already");
  const changeId = await tx(async (client) => {
    const { rows } = await client.query(
      `SELECT id, undo FROM league_changes WHERE league_id = $1 AND kind = 'game.delete' AND undone_at IS NULL AND undo IS NOT NULL AND undo_until > now()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [g.id]
    );
    if (!rows.length) throw new HttpError(409, "It can't be restored from here");
    await restoreGame(client, g.id, rows[0].undo as GameUndo);
    await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [rows[0].id, user.id]);
    return logDesk(client, {
      entity: "game",
      entityId: g.id,
      action: "restore",
      text: "Restored: everyone's teams, picks and scores as they were",
      undo: { type: "gameRestore", id: g.id },
      userId: user.id,
    });
  });
  return { changeId, text: `${g.name} is back${g.couch ? ` on ${g.couch.name}` : ""}, with everyone's picks and scores` };
}

/** Restore's Undo: deleted again, restorable for another 30 days (nobody's told twice); refused once anything's changed since. */
export async function restoreRestored(user: SessionUser, changeId: string, u: Record<string, unknown>): Promise<void> {
  const g = await deskGame(String(u.id));
  if (g.deleted) throw new HttpError(409, "It's deleted already");
  await nothingSince(pool, g.id, changeId);
  await remove(user, g);
}

/** Delete it for good, now (a deleted one only): it can't come back, and its code stops finding it. A line on its couch. */
export async function deleteForGood(user: SessionUser, id: string): Promise<{ text: string }> {
  const g = await deskGame(id);
  if (!g.deleted) throw new HttpError(409, "Delete it first: for good is for a deleted game");
  await tx(async (client) => {
    const { rowCount } = await client.query("DELETE FROM leagues WHERE id = $1 AND deleted_at IS NOT NULL", [id]);
    if (!rowCount) throw new HttpError(409, "It was restored or went a moment ago");
    // A record of who did it, on the game (its id stays in History's table) and on its couch.
    await logDesk(client, { entity: "game", entityId: id, action: "gone", text: `Deleted for good (${[g.game, g.season].filter(Boolean).join(" on ")})`, userId: user.id });
    if (g.couch)
      await logDesk(client, {
        entity: "couch",
        entityId: g.couch.id,
        action: "game-gone",
        text: `Deleted ${g.name} for good (${[g.game, g.season].filter(Boolean).join(" on ")})`,
        userId: user.id,
      });
  });
  return { text: `${named(g)} is gone for good` };
}

/** A game's actions on the desk: `{ archive: true }`, `{ delete: true }` or `{ restore: true }`. */
export async function deskGameAction(user: SessionUser, id: string, body: { archive?: unknown; delete?: unknown; restore?: unknown }): Promise<{ changeId?: string; text: string }> {
  const g = await deskGame(id);
  if (body.archive === true) {
    if (g.off) throw new HttpError(409, g.off);
    return archive(user, g);
  }
  if (body.delete === true) return deleteIt(user, g);
  if (body.restore === true) return restore(user, g);
  throw new HttpError(400, "archive, delete or restore");
}
