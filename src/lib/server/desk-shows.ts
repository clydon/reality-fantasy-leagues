import type { PoolClient } from "pg";
import { ensureSeasonRulebook, inForceEdits, saveChain } from "@db/rulebooks.js";
import { applyOps, blocksAt, diffBlocks } from "@/lib/game/formats/rulebook-patch";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { siteOf, usualSites } from "@/lib/desk-show-sites";
import { pluralWord, showWords } from "@/lib/game/show-words";
import { isUuid, type SessionUser } from "./auth-helpers";
import { likeOf, pool, tx, HttpError } from "./db";
import { byNewest, deskLines, logDesk, SEASON_NAME, type DeskLine } from "./desk";
import { plural } from "./desk-dates";
import { pushRulebook } from "./desk-rulebooks";
import { RESTORE_DAYS } from "./end-game";
import { reachCopies } from "./ours";
import { hasSchedule, latestAired, seasonSchedules, upNext } from "./schedule";
import { deskArtAction } from "./desk-show-art";
import { deskArt, findArtLater, type DeskArt } from "./show-art";

// A show on the desk (docs/PLAN-desk-parity.md part 7a; the mock's desk-shows.js, with step 7's Changes at approval: no
// wiki). Find › Shows (All · Airing · Not a game yet · Added by name · Archived; name or most games; 25 at a time), and a
// show's page: its seasons, each with its status and games; Add a season (its number, Upcoming · Airing · Ended, and what
// comes with it: last season's rulebook, the schedule, the cast from our bot, art; tier 1, Undo while nothing's on it);
// Its words (one person and many, one group and many, the episode word: the show's, which every screen reads, written into
// its seasons' rulebooks too, so the two say the same); Research sites (the sites our bot's prompt starts from:
// shows.research_domains as hostnames, null = our usual, what episode-research.js domainsFor gives); Archive and Restore
// (tier 1, Undo); and its Delete, last (decision 4): refused while it has games (every league with the show, ended and
// deleted ones too, by season), else gone for good with its seasons, follows and couches' chat about it. Looks fine and
// Archive for a show added by name and New season's old action were step 6b/10's, moved here. Its Art and photos page's
// changes are desk-show-art.ts's (part 7b).

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
/** A word as the sheet shows it: "castaway", but an acronym ("MP") as it is. */
const low = (w: string) => (w.length > 1 && w[1] === w[1].toLowerCase() ? w[0].toLowerCase() + w.slice(1) : w);
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** "Season 51", a sport's "2026 season". */
export const seasonWord = (kind: string | null, n: number) => (kind === "sport" ? `${n} season` : `Season ${n}`);

/** Every league with the show (`s`): by its slug (any season, one not in the catalog too), or a public pool or practice game on
 *  one of its seasons (Noticed u: classic counted settings.showId only). */
const WITH_SHOW = `(l.state->'settings'->>'showId' = s.slug OR l.solo_season_id IN (SELECT x.id FROM show_seasons x WHERE x.show_id = s.id))`;
/** A game people play on it (a couch's, or from before couches), ended, archived and deleted ones too, until a deleted one is
 *  gone for good (30 days); its public pool and practice games are the season's own, and go with it. */
const IN_THE_WAY = `l.solo IS NULL AND (l.deleted_at IS NULL OR l.deleted_at > now() - make_interval(days => ${RESTORE_DAYS}))`;
const ARCHIVED_GAME = `COALESCE(l.state->'settings'->>'archivedAt', '') <> ''`;

// ---------- Find › Shows ----------

export const SHOW_FILTERS = ["all", "air", "none", "byname", "archived"] as const;
export type ShowFilter = (typeof SHOW_FILTERS)[number];
export const SHOW_SORTS = ["name", "games"] as const;
export type ShowSort = (typeof SHOW_SORTS)[number];
export const SHOWS_PAGE = 25;

export interface ShowRow {
  id: string;
  name: string;
  /** Its poster (null with none, or its art off). */
  art: string | null;
  /** Its kind once it's a game (competition, series, talk, sport); null: Not a game yet. */
  kind: string | null;
  /** The season the row names: one airing, else the newest ("Season 51", "2026 season"); null with none. */
  season: string | null;
  airing: boolean;
  /** Games people play on it, not deleted (its public pools aside). */
  games: number;
  /** People following any of its seasons. */
  watching: number;
  /** Added by name and nobody's looked at it yet (the Inbox's). */
  byName: boolean;
  archived: { at: string } | null;
}

export interface ShowsList {
  shows: ShowRow[];
  total: number;
  counts?: Record<ShowFilter, number>;
}

const BY_NAME = `s.created_by IS NOT NULL AND s.tvmaze_id IS NULL AND s.set_up_at IS NULL AND s.reviewed_at IS NULL`;
const FACTS = `CROSS JOIN LATERAL (SELECT
    (SELECT count(*)::int FROM leagues l WHERE l.deleted_at IS NULL AND l.solo IS NULL AND l.state->'settings'->>'showId' = s.slug) AS games,
    (SELECT count(DISTINCT f.user_id)::int FROM show_follows f JOIN show_seasons x ON x.id = f.season_id WHERE x.show_id = s.id AND f.following) AS watching,
    EXISTS (SELECT 1 FROM show_seasons x WHERE x.show_id = s.id AND x.status = 'airing') AS airing,
    (SELECT x.season_number FROM show_seasons x WHERE x.show_id = s.id ORDER BY x.status = 'airing' DESC, x.season_number DESC LIMIT 1) AS season,
    (SELECT max(a.created_at) FROM admin_changes a WHERE a.entity = 'show' AND a.entity_id = s.id::text AND a.action = 'archive' AND a.undone_at IS NULL) AS archived_at) k`;
const WHERE_FILTER: Record<ShowFilter, string> = {
  all: `NOT s.archived`,
  air: `NOT s.archived AND EXISTS (SELECT 1 FROM show_seasons x WHERE x.show_id = s.id AND x.status = 'airing')`,
  none: `NOT s.archived AND s.set_up_at IS NULL`,
  byname: `NOT s.archived AND ${BY_NAME}`,
  archived: `s.archived`,
};
const ORDER: Record<ShowSort, string> = {
  name: `lower(s.name), s.id`,
  games: `k.games DESC, k.watching DESC, lower(s.name), s.id`,
};
const COLUMNS = `s.id, s.name, s.kind, s.set_up_at, s.archived, s.updated_at, ${BY_NAME} AS by_name, CASE WHEN s.art_off THEN NULL ELSE s.art_url END AS art,
  k.games, k.watching, k.airing, k.season, k.archived_at`;

const rowOf = (r: Record<string, unknown>): ShowRow => ({
  id: r.id as string,
  name: r.name as string,
  art: (r.art as string | null) ?? null,
  kind: r.set_up_at ? (r.kind as string) : null,
  season: r.season != null ? seasonWord(r.set_up_at ? (r.kind as string) : null, r.season as number) : null,
  airing: !!r.airing,
  games: r.games as number,
  watching: r.watching as number,
  byName: !!r.by_name,
  archived: r.archived ? { at: ((r.archived_at as Date | null) ?? (r.updated_at as Date)).toISOString() } : null,
});

export async function showCounts(): Promise<Record<ShowFilter, number>> {
  const { rows } = await pool.query(
    `SELECT ${SHOW_FILTERS.map((f) => `count(*) FILTER (WHERE ${WHERE_FILTER[f]})::int AS "${f}"`).join(", ")} FROM shows s`
  );
  return rows[0];
}

/** One page of Find › Shows: filtered, sorted, searched by its name. */
export async function deskShows(opts: { q?: string | null; f?: string | null; sort?: string | null; offset?: unknown; limit?: unknown; counts?: boolean }): Promise<ShowsList> {
  const f: ShowFilter | "any" = opts.f === "any" || SHOW_FILTERS.includes(opts.f as ShowFilter) ? (opts.f as ShowFilter | "any") : "all";
  const sort: ShowSort = SHOW_SORTS.includes(opts.sort as ShowSort) ? (opts.sort as ShowSort) : "name";
  const offset = Math.min(1_000_000, Math.max(0, Math.floor(Number(opts.offset) || 0)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || SHOWS_PAGE)));
  const term = (opts.q ?? "").trim();
  const params: unknown[] = [];
  let where = f === "any" ? "true" : WHERE_FILTER[f];
  if (term) {
    params.push(likeOf(term));
    where = `${where} AND s.name ILIKE $${params.length}`;
  }
  const [{ rows: total }, { rows }, counts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM shows s WHERE ${where}`, params),
    pool.query(`SELECT ${COLUMNS} FROM shows s ${FACTS} WHERE ${where} ORDER BY ${ORDER[sort]} LIMIT ${limit} OFFSET ${offset}`, params),
    opts.counts === false ? null : showCounts(),
  ]);
  return { shows: rows.map(rowOf), total: total[0].n, ...(counts ? { counts } : {}) };
}

/** Find's shows: the first few that match, archived ones too (as find() did, and the mock's search), and how many do (Find
 *  links the rest to Shows). */
export async function findShows(term: string, n = 3): Promise<{ shows: ShowRow[]; total: number }> {
  const { shows, total } = await deskShows({ q: term, f: "any", sort: "name", limit: n, counts: false });
  return { shows, total };
}

/** Browse's line for Shows: how many, how many airing, and how many added by name wait for a look. */
export async function browseShows(): Promise<{ all: number; airing: number; byName: number }> {
  const c = await showCounts();
  return { all: c.all, airing: c.air, byName: c.byname };
}

// ---------- a show ----------

interface ShowHead {
  id: string;
  slug: string;
  name: string;
  format: string | null;
  kind: string;
  set_up_at: Date | null;
  archived: boolean;
  created_at: Date;
  created_by: string | null;
  tvmaze_id: number | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  added_by: string | null;
  reviewed_name: string | null;
  castaway_term: string;
  castaway_plural: string | null;
  tribe_term: string;
  tribe_plural: string | null;
  episode_term: string;
  research_domains: string[] | null;
  wiki_api_url: string | null;
  archived_at: Date | null;
}

async function head(id: string, db: Pick<PoolClient, "query"> = pool, lock = false): Promise<ShowHead> {
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const { rows } = await db.query(
    `SELECT s.id, s.slug, s.name, s.format, s.kind, s.set_up_at, s.archived, s.created_at, s.created_by, s.tvmaze_id, s.reviewed_at, s.reviewed_by,
            COALESCE(a.username, a.name) AS added_by, COALESCE(r.username, r.name) AS reviewed_name, s.castaway_term, s.castaway_plural,
            s.tribe_term, s.tribe_plural, s.episode_term, s.research_domains, s.wiki_api_url,
            (SELECT max(c.created_at) FROM admin_changes c WHERE c.entity = 'show' AND c.entity_id = s.id::text AND c.action = 'archive' AND c.undone_at IS NULL) AS archived_at
       FROM shows s LEFT JOIN "user" a ON a.id = s.created_by LEFT JOIN "user" r ON r.id = s.reviewed_by WHERE s.id = $1${lock ? " FOR UPDATE OF s" : ""}`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Show not found");
  return rows[0];
}

export interface ShowWords {
  person: string;
  people: string;
  group: string;
  groups: string;
  episode: string;
}

/** Its words as the sheet shows them ("castaway", "castaways", "tribe", "tribes", "Episode"), as the app says them
 *  (show-words.ts: The Traitors' "Cast" is a cast member and the cast). */
function wordsOf(s: Pick<ShowHead, "castaway_term" | "castaway_plural" | "tribe_term" | "tribe_plural" | "episode_term">): ShowWords {
  const w = showWords({ castaway: s.castaway_term, people: s.castaway_plural, episode: s.episode_term });
  return { person: low(w.person), people: low(w.people), group: low(s.tribe_term), groups: low(s.tribe_plural || pluralWord(cap(s.tribe_term))), episode: w.episode };
}

const wikiHostOf = (wikiApiUrl: string | null) => {
  const u = usualSites(wikiApiUrl);
  return u.length === 3 ? u[0] : null;
};

export interface ShowSites {
  /** The sites research looks at first, each with where it's from. */
  list: { host: string; from: "wiki" | "usual" | "added" }[];
  /** The show has its own list (else our usual). */
  own: boolean;
  usual: string[];
}

function sitesOf(s: Pick<ShowHead, "research_domains" | "wiki_api_url">): ShowSites {
  const usual = usualSites(s.wiki_api_url);
  const wiki = wikiHostOf(s.wiki_api_url);
  const own = !!s.research_domains?.length;
  const list = own ? s.research_domains! : usual;
  return { list: list.map((host) => ({ host, from: host === wiki ? "wiki" : host === "tvline.com" || host === "parade.com" ? "usual" : "added" })), own, usual };
}

export interface ShowSeasonRow {
  id: string;
  /** Its own name, when it has one (else the page says "Season 51"). */
  ownName: string | null;
  name: string;
  number: number;
  status: "upcoming" | "airing" | "completed";
  rulebookId: string | null;
  /** Games people play on it, not deleted (its pools aside). */
  games: number;
  scheduled: boolean;
}

export interface ShowDelete {
  name: string;
  /** What's in the way, by season, newest first: each season's games and their states (one game: the game itself). */
  blocked: { label: string; seasonId: string | null; count: number; states: Partial<Record<"playing" | "ended" | "archived" | "deleted", number>>; one: { id: string; name: string; couch: string | null; state: string } | null }[];
  games: number;
  seasons: number;
  followers: number;
  pools: number;
  practice: number;
  /** The Delete row's line. */
  line: string;
}

export interface DeskShow {
  id: string;
  name: string;
  format: string | null;
  /** Its kind as stored (a show that isn't a game yet has its listing's guess: New show starts from it). */
  kind: string | null;
  /** A game for every couch (Make it a game, or set up by the desk); else "Not a game yet". */
  setUp: boolean;
  archived: boolean;
  /** When it was archived on the desk (else when it last changed). */
  archivedAt: string | null;
  /** Someone added it (Add a show): who, when, and whether it came from a TV listing (else by name, with no schedule). */
  added: { by: string | null; at: string; listing: boolean } | null;
  /** The desk looked at it (a show added by name waits in the Inbox until then). */
  reviewed: { by: string | null; at: string } | null;
  seasons: ShowSeasonRow[];
  watching: number;
  /** Its art, each frame's source and framing, its cast photos and the finder's state (show-art.ts): its Art and photos page. */
  art: DeskArt;
  words: ShowWords;
  /** Its words' live sample: its newest season's cast and groups, and an episode. */
  sample: { people: number; groups: number; episode: number };
  /** Its newest season's rulebook, where its own words are (the words sheet links it). */
  rulebook: { id: string; season: string } | null;
  sites: ShowSites;
  delete: ShowDelete;
  history: DeskLine[];
}

const STATE = `CASE WHEN l.deleted_at IS NOT NULL THEN 'deleted' WHEN ${ARCHIVED_GAME} THEN 'archived' WHEN ss.status = 'completed' THEN 'ended' ELSE 'playing' END`;

async function deleteOf(s: ShowHead, seasons: number, db: Pick<PoolClient, "query"> = pool): Promise<ShowDelete> {
  const [{ rows: games }, { rows: solo }, { rows: follows }] = await Promise.all([
    db.query(
      `SELECT l.id, l.name, c.name AS couch, ${STATE} AS state, (l.state->'settings'->>'wikiSeason') AS number, ss.id AS season_id, ${SEASON_NAME} AS season
         FROM shows s JOIN leagues l ON ${WITH_SHOW} LEFT JOIN couches c ON c.id = l.couch_id
         LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE s.id = $1 AND ${IN_THE_WAY} ORDER BY l.name`,
      [s.id]
    ),
    db.query(
      `SELECT count(*) FILTER (WHERE l.solo = 'public')::int AS pools, count(*) FILTER (WHERE l.solo = 'practice')::int AS practice
         FROM shows s JOIN leagues l ON ${WITH_SHOW} WHERE s.id = $1 AND l.solo IS NOT NULL AND l.deleted_at IS NULL`,
      [s.id]
    ),
    db.query("SELECT count(DISTINCT f.user_id)::int AS n FROM show_follows f JOIN show_seasons x ON x.id = f.season_id WHERE x.show_id = $1 AND f.following", [s.id]),
  ]);
  type Blocked = ShowDelete["blocked"][number];
  const by = new Map<string, Blocked & { games: typeof games }>();
  for (const g of games) {
    const label: string = g.season ?? `${s.name} ${g.number ?? ""}`.trim();
    const row = by.get(label) ?? { label, seasonId: g.season_id ?? null, count: 0, states: {} as Blocked["states"], one: null, games: [] as typeof games };
    const state = g.state as keyof Blocked["states"];
    row.count++;
    row.states[state] = (row.states[state] ?? 0) + 1;
    row.games.push(g);
    by.set(label, row);
  }
  const blocked = [...by.values()]
    .map(({ games: gs, ...r }) => ({ ...r, one: gs.length === 1 ? { id: gs[0].id, name: gs[0].name, couch: gs[0].couch ?? null, state: gs[0].state } : null }))
    .sort((a, b) => (Number(b.label.match(/\d+$/)?.[0]) || 0) - (Number(a.label.match(/\d+$/)?.[0]) || 0) || a.label.localeCompare(b.label));
  return {
    name: s.name,
    blocked,
    games: games.length,
    seasons,
    followers: follows[0].n,
    pools: solo[0].pools,
    practice: solo[0].practice,
    line: games.length ? `Not while it has ${plural(games.length, "game")}${s.archived ? "" : " · archive it instead"}` : "Its seasons, episodes, cast and results go",
  };
}

export async function deskShow(id: string): Promise<DeskShow> {
  const s = await head(id);
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, ss.name AS own_name, ${SEASON_NAME} AS name, ss.status, ss.season_number AS number,
            (SELECT r.id FROM rulebooks r WHERE r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived') AS rulebook_id,
            (SELECT count(*)::int FROM leagues l WHERE l.deleted_at IS NULL AND l.solo IS NULL AND l.state->'settings'->>'showId' = s.slug
                AND l.state->'settings'->>'wikiSeason' = ss.season_number::text) AS games,
            (SELECT count(*)::int FROM season_cast sc WHERE sc.season_id = ss.id) AS cast_n,
            (SELECT count(DISTINCT sc.tribe_name)::int FROM season_cast sc WHERE sc.season_id = ss.id AND sc.tribe_name IS NOT NULL) AS groups_n
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1 ORDER BY ss.season_number DESC`,
    [id]
  );
  const [schedules, watching, art, del, lines] = await Promise.all([
    seasonSchedules(seasons.map((x) => x.id)),
    pool.query("SELECT count(DISTINCT f.user_id)::int AS n FROM show_follows f JOIN show_seasons x ON x.id = f.season_id WHERE x.show_id = $1 AND f.following", [id]),
    deskArt(id),
    deleteOf(s, seasons.length),
    deskLines("show", id),
  ]);
  const newest = seasons[0];
  const withCast = seasons.find((x) => x.cast_n > 0);
  const sch = newest ? schedules.get(newest.id) : undefined;
  const book = seasons.find((x) => x.rulebook_id);
  return {
    id,
    name: s.name,
    format: s.format,
    kind: s.kind,
    setUp: !!s.set_up_at,
    archived: s.archived,
    archivedAt: s.archived ? (s.archived_at ?? s.reviewed_at ?? s.created_at).toISOString() : null,
    added: s.created_by ? { by: s.added_by, at: s.created_at.toISOString(), listing: s.tvmaze_id != null } : null,
    reviewed: s.reviewed_at ? { by: s.reviewed_name, at: s.reviewed_at.toISOString() } : null,
    seasons: seasons.map((x) => ({
      id: x.id,
      ownName: x.own_name,
      name: x.name,
      number: x.number,
      status: x.status,
      rulebookId: x.rulebook_id,
      games: x.games,
      scheduled: hasSchedule(schedules.get(x.id)),
    })),
    watching: watching.rows[0].n,
    art,
    words: wordsOf(s),
    sample: { people: withCast?.cast_n || (s.kind === "sport" ? 20 : 18), groups: withCast ? withCast.groups_n : s.kind === "sport" ? 10 : 3, episode: upNext(sch)?.number ?? Math.max(1, latestAired(sch)) },
    rulebook: book ? { id: book.rulebook_id, season: book.name } : null,
    sites: sitesOf(s),
    delete: del,
    history: byNewest(lines),
  };
}

// ---------- its changes ----------

type Change = { changeId: string; text: string };

/** Looks fine (a show added by name, looked at): it stays in search. */
async function lookedAt(user: SessionUser, s: ShowHead): Promise<void> {
  if (s.reviewed_at) throw new HttpError(409, "Looked at already");
  await pool.query("UPDATE shows SET reviewed_at = now(), reviewed_by = $2, updated_at = now() WHERE id = $1", [s.id, user.id]);
  await logDesk(pool, { entity: "show", entityId: s.id, action: "reviewed", text: "Looks fine", undo: { type: "showReviewed", id: s.id }, userId: user.id });
}

/** Archive (out of everyone's search, Add a show and the TV listings; its follows and games stay) or Restore: tier 1, Undo. An
 *  archived show has been looked at, so it leaves the Inbox too. */
async function setArchived(user: SessionUser, id: string, archive: boolean): Promise<Change> {
  return tx(async (db) => {
    const s = await head(id, db, true);
    if (s.archived === archive) throw new HttpError(409, archive ? `${s.name} is archived already` : `${s.name} isn't archived`);
    await db.query(
      "UPDATE shows SET archived = $2, reviewed_at = CASE WHEN $2 THEN COALESCE(reviewed_at, now()) ELSE reviewed_at END, reviewed_by = CASE WHEN $2 THEN COALESCE(reviewed_by, $3) ELSE reviewed_by END, updated_at = now() WHERE id = $1",
      [id, archive, user.id]
    );
    const changeId = await logDesk(db, {
      entity: "show",
      entityId: id,
      action: archive ? "archive" : "restore",
      text: archive ? "Archived: out of everyone's search" : "Restored: back in everyone's search",
      undo: { type: "showArchive", id, archived: s.archived, reviewedAt: s.reviewed_at ? s.reviewed_at.toISOString() : null, reviewedBy: s.reviewed_by },
      userId: user.id,
    });
    return { changeId, text: archive ? `Archived ${s.name} · out of everyone's search` : `${s.name} is back in everyone's search` };
  });
}

/** History's Undo of Archive or Restore: as it was, refused once it has moved on since. */
export async function restoreShowArchive(u: Record<string, unknown>): Promise<void> {
  await tx(async (db) => {
    const s = await head(String(u.id), db, true).catch((e) => {
      throw e instanceof HttpError && e.status === 404 ? new HttpError(409, "That show was deleted") : e;
    });
    if (s.archived === !!u.archived) throw new HttpError(409, s.archived ? "It's archived again since" : "It's been restored since");
    await db.query("UPDATE shows SET archived = $2, reviewed_at = $3, reviewed_by = $4, updated_at = now() WHERE id = $1", [s.id, !!u.archived, u.reviewedAt ?? null, u.reviewedBy ?? null]);
  });
}

type SeasonStatus = "upcoming" | "airing" | "completed";
const STATUS_WORD: Record<SeasonStatus, string> = { upcoming: "Upcoming", airing: "Airing", completed: "Ended" };

/**
 * Add a season (tier 1): its number (the next by default; one that's here is refused) and its status (Upcoming by default;
 * anything else refused, never turned into Ended: Noticed s). Its results come from sources that agree ('leagues', the
 * column's own default: classic made the desk decide them, Noticed s), a set-up show's plays by last season's rulebook
 * (db/rulebooks.js sameAsLastSeason), and its art is looked for after the answer. A line on the show's History and the
 * season's, with Undo on the show's while nothing's on it.
 */
async function addSeason(user: SessionUser, id: string, body: { number?: unknown; status?: unknown }): Promise<Change & { seasonId: string }> {
  const status = body.status === undefined ? "upcoming" : body.status;
  if (status !== "upcoming" && status !== "airing" && status !== "completed") throw new HttpError(400, "status is upcoming, airing or completed");
  const out = await tx(async (db) => {
    const s = await head(id, db, true);
    const { rows: top } = await db.query("SELECT COALESCE(max(season_number), 0)::int AS n FROM show_seasons WHERE show_id = $1", [id]);
    const n = body.number === undefined ? top[0].n + 1 : Number(body.number);
    if (!Number.isInteger(n) || n < 1 || n > 9999) throw new HttpError(400, "A season's number is a whole number from 1");
    const word = seasonWord(s.set_up_at ? s.kind : null, n);
    const { rows } = await db.query(
      `INSERT INTO show_seasons (show_id, season_number, status, results_by) VALUES ($1, $2, $3, 'leagues') ON CONFLICT (show_id, season_number) DO NOTHING RETURNING id`,
      [id, n, status]
    );
    if (!rows.length) throw new HttpError(409, `${word} is here already`);
    const seasonId = rows[0].id as string;
    if (s.set_up_at) await ensureSeasonRulebook(db, seasonId);
    const label = `${s.name} ${n}`;
    const changeId = await logDesk(db, {
      entity: "show",
      entityId: id,
      action: "season",
      text: `Added ${label} (${STATUS_WORD[status]})${s.set_up_at ? ", playing by last season's rulebook" : ""}`,
      after: { seasonId, number: n, status },
      undo: { type: "showSeason", id, seasonId, label },
      userId: user.id,
    });
    await logDesk(db, { entity: "season", entityId: seasonId, action: "added", text: `Added to ${s.name} (${STATUS_WORD[status]})`, userId: user.id });
    return { changeId, seasonId, text: `Added ${label} · next: ${status === "airing" ? "its schedule" : "its cast"}` };
  });
  findArtLater({ seasonId: out.seasonId });
  return out;
}

/** History's Undo of Add a season: the season goes again, refused once anything's on it (a game, a follow, its cast, an answer). */
export async function restoreShowSeason(u: Record<string, unknown>): Promise<void> {
  await tx(async (db) => {
    const { rows } = await db.query(
      `SELECT ss.id, s.slug, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1 FOR UPDATE OF ss`,
      [String(u.seasonId)]
    );
    if (!rows.length) throw new HttpError(409, "That season was deleted since");
    const ss = rows[0];
    const { rows: used } = await db.query(
      `SELECT 1 FROM leagues l WHERE (l.state->'settings'->>'showId' = $2 AND l.state->'settings'->>'wikiSeason' = $3) OR l.solo_season_id = $1
       UNION ALL SELECT 1 FROM show_follows WHERE season_id = $1
       UNION ALL SELECT 1 FROM season_cast WHERE season_id = $1
       UNION ALL SELECT 1 FROM episode_research r JOIN show_seasons x ON x.show_id = r.show_id AND x.season_number = r.season_number WHERE x.id = $1 LIMIT 1`,
      [ss.id, ss.slug, String(ss.season_number)]
    );
    if (used.length) throw new HttpError(409, `${String(u.label ?? "It")} is in use since: delete it from its page instead`);
    await db.query("DELETE FROM show_seasons WHERE id = $1", [ss.id]);
  });
}

// ---- its words ----

const WORD_MAX = 40;

function wordIn(body: Record<string, unknown>, k: keyof ShowWords): string {
  const v = typeof body[k] === "string" ? (body[k] as string).trim().replace(/\s+/g, " ") : "";
  if (!v) throw new HttpError(400, "Every word needs saying");
  if (v.length > WORD_MAX) throw new HttpError(400, `A word is ${WORD_MAX} letters at most`);
  return v;
}

/** The words as the show keeps them: singulars capitalised, a plural only where it isn't the singular's own (null works it out). */
function columnsOf(w: ShowWords) {
  const person = cap(w.person);
  const group = cap(w.group);
  return {
    castaway_term: person,
    castaway_plural: same(w.people, pluralWord(person)) ? null : cap(w.people),
    tribe_term: group,
    tribe_plural: same(w.groups, pluralWord(group)) ? null : cap(w.groups),
    episode_term: cap(w.episode),
  };
}

/** The words onto the show: the singulars first (a new one clears its plural: 0429's trigger, for every path that writes
 *  them), then the plurals. */
async function writeWords(db: Pick<PoolClient, "query">, id: string, c: ReturnType<typeof columnsOf>) {
  await db.query("UPDATE shows SET castaway_term = $2, tribe_term = $3, episode_term = $4, updated_at = now() WHERE id = $1", [id, c.castaway_term, c.tribe_term, c.episode_term]);
  await db.query("UPDATE shows SET castaway_plural = $2, tribe_plural = $3 WHERE id = $1", [id, c.castaway_plural, c.tribe_plural]);
}

/**
 * Its words into each of its seasons' rulebooks, so the two say the same (Noticed y: neither wrote the other; only Make it a
 * game copied the rulebook's onto the show, once): a rulebook's cast word for one and many, its group's, and its episode word
 * (the rulebook's "parts", which says Episode when it has none). Saved as a fix to its words alone, which scores nothing
 * differently, so no answer is read again; the leagues following it and the couches' own copies get it as any fix.
 */
async function wordsIntoRulebooks(user: SessionUser, showId: string, w: ShowWords): Promise<{ wrote: string[]; missed: string[] }> {
  const { rows } = await pool.query(
    `SELECT r.id, r.blocks, ${SEASON_NAME} AS season FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id
      WHERE ss.show_id = $1 AND r.owner_kind = 'season' AND r.status <> 'archived' ORDER BY ss.season_number DESC`,
    [showId]
  );
  const wrote: string[] = [];
  const missed: string[] = [];
  // Each on its own: one that won't take them (or fails part way) is said, and the rest still get them.
  for (const r of rows) {
    try {
      if (await wordsInto(user, r, w)) wrote.push(r.season);
    } catch (e) {
      console.error(`[desk-shows] ${r.season}'s rulebook didn't take the show's words`, e);
      missed.push(r.season);
    }
  }
  return { wrote, missed };
}

/** One rulebook: its words as the show's, a fix to the words alone (true), or nothing to change (false). */
async function wordsInto(user: SessionUser, r: { id: string; blocks: unknown; season: string }, w: ShowWords): Promise<boolean> {
  const now = blocksAt(r.blocks as RulebookBlocks, await inForceEdits(pool, r.id), Infinity) as RulebookBlocks;
  const next = structuredClone(now) as RulebookBlocks & { parts?: { singular: string; plural: string; label?: string } };
  const cast = (next as { cast?: { singular?: string; plural?: string; groups?: { singular?: string } | null } }).cast;
  if (cast) {
    if (!same(cast.singular, w.person)) cast.singular = low(w.person);
    if (!same(cast.plural, w.people)) cast.plural = low(w.people);
    if (cast.groups && !same(cast.groups.singular, w.group)) cast.groups.singular = low(w.group);
  }
  const part = next.parts?.singular ?? "Episode";
  if (!same(part, w.episode)) next.parts = { ...(next.parts ?? {}), singular: low(w.episode), plural: low(pluralWord(w.episode)) };
  const ops = diffBlocks(now, next);
  if (!ops.length) return false;
  const saved = await saveChain(pool, r.id, { blocks: applyOps(r.blocks as RulebookBlocks, ops), userId: user.id });
  if (!saved || "refused" in saved) throw new Error(JSON.stringify(saved && "refused" in saved ? saved.refused : "not found"));
  await logDesk(pool, { entity: "rulebook", entityId: r.id, action: "words", text: `The show's words: ${low(w.people)}, ${low(w.groups)}, ${low(pluralWord(w.episode))}`, userId: user.id });
  await pushRulebook(r.id);
  await reachCopies(r.id, { kind: "fix", ops, before: now, after: next }, user.id);
  return true;
}

/** Its words (tier 1): the show's, which every screen reads, and its seasons' rulebooks'. Undo puts both back. */
async function setWords(user: SessionUser, id: string, body: Record<string, unknown>): Promise<Change> {
  const w: ShowWords = { person: wordIn(body, "person"), people: wordIn(body, "people"), group: wordIn(body, "group"), groups: wordIn(body, "groups"), episode: wordIn(body, "episode") };
  const c = columnsOf(w);
  const changeId = await tx(async (db) => {
    const s = await head(id, db, true);
    const was = wordsOf(s);
    if ((Object.keys(w) as (keyof ShowWords)[]).every((k) => w[k] === was[k])) throw new HttpError(409, "Those are its words already");
    await writeWords(db, id, c);
    return logDesk(db, {
      entity: "show",
      entityId: id,
      action: "words",
      text: `Words: ${w.people}, ${w.groups}, ${pluralWord(w.episode).toLowerCase()}`,
      before: was,
      after: w,
      undo: { type: "showWords", id, was, now: w },
      userId: user.id,
    });
  });
  const books = await wordsIntoRulebooks(user, id, w);
  const missed = books.missed.length ? ` · ${books.missed.join(", ")}'s rulebook didn't take them` : "";
  return { changeId, text: `Saved · ${w.people} in ${w.groups}, every ${w.episode}${books.wrote.length ? ` · ${plural(books.wrote.length, "rulebook")} too` : ""}${missed}` };
}

/** History's Undo of Its words: the show's words as they were, and its rulebooks', refused once they've changed again. */
export async function restoreShowWords(user: SessionUser, u: Record<string, unknown>): Promise<void> {
  const was = u.was as ShowWords;
  const now = u.now as ShowWords;
  const id = String(u.id);
  await tx(async (db) => {
    const s = await head(id, db, true).catch((e) => {
      throw e instanceof HttpError && e.status === 404 ? new HttpError(409, "That show was deleted") : e;
    });
    const cur = wordsOf(s);
    if ((Object.keys(now) as (keyof ShowWords)[]).some((k) => !same(cur[k], now[k]))) throw new HttpError(409, "Its words have changed since");
    await writeWords(db, id, columnsOf(was));
  });
  await wordsIntoRulebooks(user, id, was);
}

// ---- research sites ----

const SITES_MAX = 20;

/** Research sites (tier 1): add one (a pasted page kept as its hostname), take one off (none left is our usual), or back to
 *  our usual. What's in already stays; the next research run reads the new list (episode-research.js domainsFor). */
async function setSites(user: SessionUser, id: string, body: { add?: unknown; remove?: unknown; usual?: unknown }): Promise<Change> {
  return tx(async (db) => {
    const s = await head(id, db, true);
    const cur = sitesOf(s);
    const list = cur.list.map((x) => x.host);
    let next: string[] | null;
    let text: string;
    let line: string;
    if (body.usual === true) {
      if (!cur.own) throw new HttpError(409, "It's on our usual sites already");
      next = null;
      text = "Research sites back to our usual";
      line = `Research sites: our usual · ${cur.usual.join(", ")}`;
    } else if (body.add !== undefined) {
      const host = siteOf(body.add);
      if (!host) throw new HttpError(400, "That isn't a site's address. Paste any page from it, or type its name, like insidesurvivor.com");
      if (list.includes(host)) throw new HttpError(409, `${host} is on the list already`);
      if (list.length >= SITES_MAX) throw new HttpError(400, `${SITES_MAX} sites at most: take one off first`);
      next = [...list, host];
      text = `Added ${host} · from the next research run`;
      line = `Research site added: ${host}`;
    } else if (typeof body.remove === "string") {
      const host = body.remove;
      if (!list.includes(host)) throw new HttpError(409, `${host} isn't on the list`);
      const left = list.filter((h) => h !== host);
      next = left.length ? left : null;
      text = left.length ? `${host} is off its research sites` : `${host} is off · research reads our usual sites`;
      line = `Research site taken off: ${host}`;
    } else throw new HttpError(400, "add, remove or usual");
    // A list that is our usual, in order, is our usual (null), so a change to the wiki's host still reaches it.
    if (next && next.join() === cur.usual.join()) next = null;
    await db.query("UPDATE shows SET research_domains = $2, updated_at = now() WHERE id = $1", [id, next]);
    const changeId = await logDesk(db, { entity: "show", entityId: id, action: "sites", text: line, before: s.research_domains, after: next, undo: { type: "showSites", id, was: s.research_domains, now: next }, userId: user.id });
    return { changeId, text };
  });
}

export async function restoreShowSites(u: Record<string, unknown>): Promise<void> {
  await tx(async (db) => {
    const s = await head(String(u.id), db, true).catch((e) => {
      throw e instanceof HttpError && e.status === 404 ? new HttpError(409, "That show was deleted") : e;
    });
    if ((s.research_domains ?? []).join() !== ((u.now as string[] | null) ?? []).join()) throw new HttpError(409, "Its research sites have changed since");
    await db.query("UPDATE shows SET research_domains = $2, updated_at = now() WHERE id = $1", [s.id, (u.was as string[] | null) ?? null]);
  });
}

// ---- its Delete ----

/**
 * Delete a show (tier 3): refused while it has games (every league with it, ended, archived and deleted ones too, until a
 * deleted one is gone for good), else it goes for good with its seasons and everything kept for them (episodes, cast,
 * results, rulebooks, follows, couches' chat, watch plans: the cascades), what's kept by the show (research, its search
 * index, old wiki reads), its public pools and practice games, and a stored format only it played. A line stays in History.
 */
export async function deleteShow(user: SessionUser, id: string): Promise<{ text: string }> {
  return tx(async (db) => {
    const s = await head(id, db, true);
    const { rows: n } = await db.query("SELECT count(*)::int AS n FROM show_seasons WHERE show_id = $1", [id]);
    const del = await deleteOf(s, n[0].n, db);
    if (del.games) throw new HttpError(409, `${plural(del.games, "game")} ${del.games === 1 ? "is" : "are"} on ${s.name}: delete them first, or archive it`);
    // Its own: its pools and practice games, and a game deleted long enough ago to be gone for good.
    await db.query(`DELETE FROM leagues l USING shows s WHERE s.id = $1 AND ${WITH_SHOW} AND (l.solo IS NOT NULL OR l.deleted_at IS NOT NULL)`, [id]);
    await db.query("DELETE FROM shows WHERE id = $1", [id]);
    if (s.format?.startsWith("made-")) await db.query("DELETE FROM show_formats f WHERE f.id = $1 AND NOT EXISTS (SELECT 1 FROM shows x WHERE x.format = f.id)", [s.format]);
    const went = [del.pools ? plural(del.pools, "public pool") : null, del.practice ? plural(del.practice, "practice game") : null].filter(Boolean);
    await logDesk(db, {
      entity: "show",
      entityId: id,
      action: "delete",
      text: `Deleted ${s.name}, with ${plural(n[0].n, "season")}${went.length ? ` and ${went.join(" and ")}` : ""}`,
      before: { name: s.name, slug: s.slug, seasons: n[0].n, followers: del.followers },
      userId: user.id,
    });
    return { text: `Deleted ${s.name}` };
  });
}

// ---------- the actions ----------

/**
 * The desk on a show: `{ action: "reviewed" }` (Looks fine), `{ archive: true }` or `{ action: "archive" }`, `{ restore: true }`,
 * `{ action: "season", number?, status? }` (Add a season; with neither, the next one, Upcoming: New show's), `{ words }`,
 * `{ sites: { add } | { remove } | { usual: true } }`, and `{ art }` (its Art and photos page: desk-show-art.ts).
 */
export async function deskShowAction(user: SessionUser, id: string, body: Record<string, unknown>): Promise<DeskShow & { seasonId?: string; changeId?: string; text?: string }> {
  const done = async (c: Change & { seasonId?: string }) => ({ ...(await deskShow(id)), ...c });
  if (body.action === "reviewed") {
    await lookedAt(user, await head(id));
    return deskShow(id);
  }
  if (body.archive === true || body.action === "archive") return done(await setArchived(user, id, true));
  if (body.restore === true) return done(await setArchived(user, id, false));
  if (body.action === "season") return done(await addSeason(user, id, body));
  if (body.words && typeof body.words === "object") return done(await setWords(user, id, body.words as Record<string, unknown>));
  if (body.sites && typeof body.sites === "object") return done(await setSites(user, id, body.sites as Record<string, unknown>));
  if (body.art && typeof body.art === "object") {
    const out = await deskArtAction(user, id, body.art as Record<string, unknown>);
    return { ...(await deskShow(id)), ...out };
  }
  throw new HttpError(400, "action is reviewed, archive or season; or archive, restore, words, sites or art");
}

