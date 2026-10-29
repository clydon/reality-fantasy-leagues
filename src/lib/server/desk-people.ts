import { NO_EMAIL_DOMAIN, realEmail } from "@/lib/no-email";
import { LAST_ACTIVE } from "./last-active";
import type { SessionUser } from "./auth-helpers";
import { likeOf, pool, HttpError } from "./db";
import { byNewest, deskLines, type DeskLine } from "./desk";
import { reportsBy, type ReportRow } from "./desk-reports";
import { gameName, LEAGUE_SEASON_NAME } from "./league-season";
import { WAITING } from "./way-in";

// People on the desk (docs/PLAN-desk-parity.md step 1; the mock's desk.js): Find › People, everyone, searched by name,
// username or email, filtered (Everyone · Waiting · Site admins, and Can't sign in while anyone can't), sorted (newest,
// last active, name) and read 25 at a time; and a person's page: who they are as a lower third, when they joined and
// were last active, their couches with their games and each seat's role, and their History. Classic's Users page read
// every account at once and searched in the browser; this reads a page at a time, and a username-only account's
// stand-in email (no-email.ts) is never shown or searched.

export const PEOPLE_FILTERS = ["all", "waiting", "admins", "stopped"] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number];
export const PEOPLE_SORTS = ["new", "active", "name"] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];
export const PEOPLE_PAGE = 25;

export interface PersonRow {
  id: string;
  /** Their username, else their name. */
  name: string;
  /** Their real email; null for a username-only account. */
  email: string | null;
  you: boolean;
  admin: boolean;
  /** Made an account and not let in yet (Who gets in). */
  waiting: boolean;
  /** Stopped from signing in (Better Auth's ban). */
  stopped: boolean;
  joinedAt: string;
  /** Their last authenticated request or sign-in, never one made while someone acted as them. */
  activeAt: string | null;
  /** Games they have a seat in (deleted ones not counted). */
  games: number;
  /** The colour they chose for their face (null: their id picks one). */
  colour: string | null;
}

export interface PeopleList {
  people: PersonRow[];
  /** How many match the filter and search (the list's "N people"). */
  total: number;
  /** Each filter's size, unsearched (the chips); left out when not asked for. */
  counts?: Record<PeopleFilter, number>;
}

const PERSON = `u.id, COALESCE(u.username, u.name) AS name, u.email, u.role = 'admin' AS admin,
  (${WAITING}) AS waiting, u.banned IS TRUE AS stopped, u."createdAt" AS joined, ${LAST_ACTIVE} AS active,
  (SELECT count(*)::int FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = u.id AND l.deleted_at IS NULL) AS games,
  st.colour`;

const WHERE_FILTER: Record<PeopleFilter, string> = {
  all: "true",
  waiting: WAITING,
  admins: "u.role = 'admin'",
  stopped: "u.banned IS TRUE",
};

const ORDER: Record<PeopleSort, string> = {
  new: `u."createdAt" DESC, u.id`,
  active: `active DESC NULLS LAST, u."createdAt" DESC, u.id`,
  name: `lower(COALESCE(u.username, u.name)), u.id`,
};


/** Matches $n against a person's username, name, or real email (Link an account's search too: desk-seat-moves.ts). */
export const SEARCH = (n: number) => `(u.username ILIKE $${n} OR u.name ILIKE $${n} OR (u.email ILIKE $${n} AND u.email NOT ILIKE '%@${NO_EMAIL_DOMAIN}'))`;

const rowOf = (r: Record<string, unknown>, me: string): PersonRow => ({
  id: r.id as string,
  name: r.name as string,
  email: realEmail(r.email as string),
  you: r.id === me,
  admin: !!r.admin,
  waiting: !!r.waiting,
  stopped: !!r.stopped,
  joinedAt: (r.joined as Date).toISOString(),
  activeAt: r.active ? new Date(r.active as string).toISOString() : null,
  games: r.games as number,
  colour: (r.colour as string | null) ?? null,
});

/** Each filter's size, unsearched (the chips' counts). */
async function peopleFilterCounts(): Promise<Record<PeopleFilter, number>> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS "all", count(*) FILTER (WHERE ${WHERE_FILTER.waiting})::int AS waiting,
            count(*) FILTER (WHERE ${WHERE_FILTER.admins})::int AS admins, count(*) FILTER (WHERE ${WHERE_FILTER.stopped})::int AS stopped
       FROM "user" u`
  );
  return rows[0];
}

/** One page of Find › People (`counts`: false leaves the chips' counts out). */
export async function deskPeople(
  user: SessionUser,
  opts: { q?: string | null; f?: string | null; sort?: string | null; offset?: unknown; limit?: unknown; counts?: boolean }
): Promise<PeopleList> {
  const f: PeopleFilter = PEOPLE_FILTERS.includes(opts.f as PeopleFilter) ? (opts.f as PeopleFilter) : "all";
  const sort: PeopleSort = PEOPLE_SORTS.includes(opts.sort as PeopleSort) ? (opts.sort as PeopleSort) : "new";
  const offset = Math.min(1_000_000, Math.max(0, Math.floor(Number(opts.offset) || 0)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || PEOPLE_PAGE)));
  const term = (opts.q ?? "").trim();
  const params: unknown[] = [];
  const where = [WHERE_FILTER[f]];
  if (term) {
    params.push(likeOf(term));
    where.push(SEARCH(params.length));
  }
  const [{ rows: total }, { rows }, counts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM "user" u WHERE ${where.join(" AND ")}`, params),
    pool.query(`SELECT ${PERSON} FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id WHERE ${where.join(" AND ")} ORDER BY ${ORDER[sort]} LIMIT ${limit} OFFSET ${offset}`, params),
    opts.counts === false ? null : peopleFilterCounts(),
  ]);
  return { people: rows.map((r) => rowOf(r, user.id)), total: total[0].n, ...(counts ? { counts } : {}) };
}

/** Find's people: the first few who match, and how many do in all (Find links the rest to People, searched). */
export async function findPeople(user: SessionUser, term: string, n = 3): Promise<{ people: PersonRow[]; total: number }> {
  const { people, total } = await deskPeople(user, { q: term, f: "all", sort: "active", limit: n, counts: false });
  return { people, total };
}

/** Browse's line for People: how many accounts, and how many wait to get in. */
export async function peopleCounts(): Promise<{ all: number; waiting: number }> {
  const { all, waiting } = await peopleFilterCounts();
  return { all, waiting };
}

// ---------- a person ----------

/**
 * When they were stopped from signing in, and by whom, from the desk's lines: a stop (unless undone), a let back in (and,
 * undone, a stop again at the Undo). The latest says it, if it's a stop; else the stop came from elsewhere (null).
 */
function lastStop(rows: Record<string, unknown>[]): { at: Date; who: string | null; userId: string | null } | null {
  const turns: { at: Date; stop: boolean; who?: string | null; userId?: string | null }[] = [];
  for (const r of rows) {
    const at = r.created_at as Date;
    const undone = r.undone_at as Date | null;
    if (r.action === "stop") {
      turns.push({ at, stop: true, who: r.who as string | null, userId: r.user_id as string | null });
      if (undone) turns.push({ at: undone, stop: false });
    } else {
      turns.push({ at, stop: false });
      if (undone) turns.push({ at: undone, stop: true, who: r.undoer as string | null, userId: r.undone_by as string | null });
    }
  }
  const last = turns.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  return last?.stop ? { at: last.at, who: last.who ?? null, userId: last.userId ?? null } : null;
}

export type SeatRole = "commissioner" | "admin" | "member";

/** A game someone has a seat in, as their page shows it (and its seat's sheet and the Delete read it). */
export interface DeskSeatGame {
  leagueId: string;
  name: string;
  season: string | null;
  game: string;
  role: SeatRole;
  /** Its only Commissioner: their role and Unlink wait until it's handed on. */
  alone: boolean;
  /** How many others are signed in to its seats (who it could be handed to). */
  others: number;
  /** It has drafted: a seat that's let go stays in the standings, unplayed (before a draft, or with none, it goes). */
  drafted: boolean;
  /** A practice game or a public pool (no couch). */
  solo: "practice" | "public" | null;
}

export interface DeskPerson extends PersonRow {
  /** Their username, if they have one (the name they sign in with). */
  username: string | null;
  /** Phones and computers they're signed in on now. */
  devices: number;
  /** Invites they sent that nobody's used yet (their Delete takes them). */
  invites: number;
  /** Stopped from signing in: since when and by whom (the desk's line; null for a stop made elsewhere), and why. */
  stop: { since: string | null; by: string | null; byYou: boolean; why: string | null } | null;
  /**
   * Their couches, each with the games they have a seat in there: started it, on it, or only a seat there (a couch they
   * aren't on, which a join that didn't finish can leave); games on no couch last, as one with no id.
   */
  couches: {
    id: string | null;
    name: string;
    role: "owner" | "member" | "seat";
    people: number;
    games: DeskSeatGame[];
  }[];
  /** The reports they sent, newest first (docs/PLAN-desk-parity.md step 2: Reports they sent, each a link). */
  reports: ReportRow[];
  history: DeskLine[];
}

export async function deskPerson(user: SessionUser, id: string): Promise<DeskPerson> {
  const [{ rows }, { rows: couches }, { rows: seats }, { rows: stops }, { rows: hours }] = await Promise.all([
    pool.query(
      `SELECT ${PERSON}, u.username, u."banReason" AS why,
              (SELECT count(*)::int FROM session x WHERE x."userId" = u.id AND x."impersonatedBy" IS NULL AND x."expiresAt" > now()) AS devices,
              (SELECT count(*)::int FROM league_invites i WHERE i.invited_by = u.id AND i.status = 'pending') AS invites
         FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id WHERE u.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT c.id, c.name, m.role, m.joined_at, (SELECT count(*)::int FROM couch_members x WHERE x.couch_id = c.id) AS people
         FROM couch_members m JOIN couches c ON c.id = m.couch_id WHERE m.user_id = $1 AND c.deleted_at IS NULL ORDER BY m.joined_at`,
      [id]
    ),
    pool.query(
      `SELECT l.id, l.name, l.couch_id, c.name AS couch, m.role, l.solo, l.state->'settings'->>'leagueTypeId' AS type,
              (SELECT count(*)::int FROM couch_members x WHERE x.couch_id = l.couch_id) AS people, ${LEAGUE_SEASON_NAME} AS season,
              COALESCE((l.state->>'draftPicksMade')::int, 0) > 0 AS drafted,
              (SELECT count(*)::int FROM league_memberships o WHERE o.league_id = l.id AND o.user_id <> m.user_id) AS others,
              m.role = 'commissioner' AND NOT EXISTS (SELECT 1 FROM league_memberships o WHERE o.league_id = l.id AND o.user_id <> m.user_id AND o.role = 'commissioner') AS alone
         FROM league_memberships m JOIN leagues l ON l.id = m.league_id LEFT JOIN couches c ON c.id = l.couch_id
        WHERE m.user_id = $1 AND l.deleted_at IS NULL ORDER BY l.created_at`,
      [id]
    ),
    pool.query(
      `SELECT c.action, c.created_at, c.undone_at, c.user_id, c.undone_by, COALESCE(u.username, u.name) AS who, COALESCE(v.username, v.name) AS undoer
         FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id LEFT JOIN "user" v ON v.id = c.undone_by
        WHERE c.entity = 'person' AND c.entity_id = $1 AND c.action IN ('stop', 'back-in')`,
      [id]
    ),
    // An hour as them that ended without Return (the admin signed out, or it ran out): ended by the hour's end, at least.
    pool.query(
      `SELECT a.after->>'until' AS until, COALESCE(u.username, u.name) AS who FROM admin_changes a LEFT JOIN "user" u ON u.id = a.user_id
        WHERE a.entity = 'person' AND a.entity_id = $1 AND a.action = 'act' AND (a.after->>'until')::timestamptz < now()
          AND NOT EXISTS (SELECT 1 FROM admin_changes e WHERE e.entity = 'person' AND e.entity_id = $1 AND e.action = 'act-end' AND e.after->>'sessionId' = a.after->>'sessionId')`,
      [id]
    ),
  ]);
  if (!rows.length) throw new HttpError(404, "Nobody by that id");
  const gamesOn = (couchId: string | null) =>
    seats
      .filter((s) => s.couch_id === couchId)
      .map(
        (s): DeskSeatGame => ({
          leagueId: s.id,
          name: s.name,
          season: s.season,
          game: gameName(s.type),
          role: s.role as SeatRole,
          alone: s.alone,
          others: s.others,
          drafted: s.drafted,
          solo: s.solo ?? null,
        })
      );
  const on = new Set(couches.map((c) => c.id as string));
  // A seat on a couch they aren't on: the couch still shows, with the seat under it.
  const seatOnly = [...new Map(seats.filter((s) => s.couch_id && !on.has(s.couch_id)).map((s) => [s.couch_id as string, s])).values()];
  const onNoCouch = gamesOn(null);
  const p = rows[0];
  const stopLine = p.stopped ? lastStop(stops) : null;
  return {
    ...rowOf(p, user.id),
    username: p.username,
    devices: p.devices,
    invites: p.invites,
    stop: p.stopped ? { since: stopLine?.at.toISOString() ?? null, by: stopLine?.who ?? null, byYou: !!stopLine && stopLine.userId === user.id, why: (p.why as string | null) || null } : null,
    couches: [
      ...couches.map((c) => ({ id: c.id as string, name: c.name as string, role: (c.role === "owner" ? "owner" : "member") as "owner" | "member", people: c.people as number, games: gamesOn(c.id) })),
      ...seatOnly.map((s) => ({ id: s.couch_id as string, name: (s.couch as string) ?? "A couch", role: "seat" as const, people: s.people as number, games: gamesOn(s.couch_id) })),
      ...(onNoCouch.length ? [{ id: null, name: "On no couch", role: "member" as const, people: 0, games: onNoCouch }] : []),
    ],
    reports: await reportsBy(id),
    history: byNewest([
      ...(await deskLines("person", id)),
      ...couches.map((c) => ({ id: null, text: c.role === "owner" ? `Started ${c.name}` : `Joined ${c.name}`, at: c.joined_at.toISOString(), who: null, undoable: false, undone: false })),
      { id: null, text: "Made an account", at: (p.joined as Date).toISOString(), who: null, undoable: false, undone: false },
      ...hours.map((h) => ({ id: null, text: "Acting as them ended, by the end of the hour", at: new Date(h.until).toISOString(), who: h.who, undoable: false, undone: false })),
    ]),
  };
}
