import type { Pool, PoolClient } from "pg";
import { isNewDesignRoute } from "@/new/routes";
import { realEmail } from "@/lib/no-email";
import { LAST_ACTIVE } from "./admin-users";
import { isUuid, type SessionUser } from "./auth-helpers";
import { likeOf, pool, tx, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { LEAGUE_SEASON_NAME } from "./league-season";
import { WAITING } from "./way-in";

// Reports on the desk (docs/PLAN-desk-parity.md step 2; the mock's desk.js DK_LIST.reports and desk-pages.js dkReportPage):
// what people send from Settings › Report a problem (or classic's Report an issue), a problem or an idea in their words.
// Find › Reports lists them (Open · Done, searched by what it says or who sent it, newest first, 25 at a time); a report's
// page reads it, says where it was sent from, links the sender and the game, season or couch it came from, and has Mark
// done (tier 1, Undo), Act as the sender and, last, Delete this report (tier 3, gone for good). An open one is in the
// Inbox until it's marked done. Classic listed every report and deleted one once it was dealt with (so whatever was left
// was open), with no History; the desk keeps a dealt-with report as Done and logs each change (admin_changes 'report').

export const REPORT_FILTERS = ["open", "done"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];
export const REPORT_PAGE = 25;

export interface ReportRow {
  id: string;
  /** Its first sentence, as a title. */
  title: string;
  /** A problem, or an idea. */
  idea: boolean;
  /** What it's about, in a word or two: "an idea", the game it came from, else the screen. */
  about: string;
  /** Who sent it: their account (null once it's deleted), their name as it was sent, their colour. */
  who: { id: string | null; name: string; colour: string | null };
  at: string;
  done: boolean;
}

export interface ReportsList {
  reports: ReportRow[];
  /** How many match the filter and search. */
  total: number;
  /** Each filter's size, unsearched (the chips). */
  counts?: Record<ReportFilter, number>;
}

const REPORT_COLS = `r.id, r.user_id, r.username, r.league_id, r.league_name, r.type, r.message, r.route, r.created_at, r.done_at, r.done_by, r.sent_from, st.colour,
  rs.id AS route_season_id, rs.name AS route_season`;
// The season a show screen's route names (/show/<its id>/...): cast only once it's a whole uuid, inside a CASE, so a
// mistyped address someone reported from never breaks a read.
const REPORT_FROM = `issue_reports r LEFT JOIN user_settings st ON st.user_id = r.user_id
  LEFT JOIN LATERAL (SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
    WHERE ss.id = CASE WHEN r.route ~* '^/show/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}([/?#]|$)' THEN substring(r.route from 7 for 36)::uuid END) rs ON true`;

/** A report's title: its first line's first sentence (a trailing full stop dropped), cut on a word near 80 characters. */
export function reportTitle(message: string): string {
  const first = String(message || "").trim().split(/\r?\n/)[0].trim();
  const sentence = (first.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? first).replace(/\.$/, "");
  if (sentence.length <= 80) return sentence;
  const cut = sentence.slice(0, 79);
  return `${cut.includes(" ") ? cut.replace(/\s+\S*$/, "") : cut}…`;
}

const TABS: Record<string, string> = {
  tonight: "Tonight",
  games: "Games",
  episodes: "Episodes",
  cast: "Cast",
  players: "Players",
  chat: "Chat",
  backstage: "Backstage",
  draft: "the draft",
  blind: "the blind draft",
  waivers: "Waivers",
  scoring: "Scoring",
};

/** The screen a route is, in words ("Settings", "Survivor 51 · Cast"); a route it doesn't know, as it is. */
export function screenOf(route: string | null, season: string | null): string | null {
  if (!route) return null;
  const p = route.split(/[?#]/)[0].split("/").filter(Boolean);
  switch (p[0]) {
    case undefined:
      return "the front door";
    case "home":
      return "the hub";
    case "settings":
      return "Settings";
    case "show":
      return season ? `${season}${p[2] ? ` · ${TABS[p[2]] ?? p[2]}` : ""}` : "a show";
    case "desk":
      return "the desk";
    case "start":
      return "first run";
    case "join":
      return "an invite";
    case "welcome":
      return "the landing page";
    case "signin":
    case "sign-in":
      return "sign in";
    default:
      return route.split(/[?#]/)[0];
  }
}

/** "an iPhone", "an Android phone", "a computer": a device from its user agent (null when it can't be told). */
export function deviceOf(ua: string | null | undefined): string | null {
  const s = String(ua || "");
  if (/iPhone|iPod/.test(s)) return "an iPhone";
  if (/iPad/.test(s)) return "an iPad";
  if (/Android/.test(s)) return /Mobile/.test(s) ? "an Android phone" : "an Android tablet";
  if (/Macintosh|Windows|Linux|CrOS/.test(s)) return "a computer";
  return null;
}

/** Which design a route is on (null with no route). */
const designOf = (route: string | null) => (route ? (isNewDesignRoute(route.split(/[?#]/)[0]) ? "the new design" : "the classic design") : null);

/** "Sent from Settings on an iPhone · the installed app · the new design" (what's known of it). */
export function sentFromLine(r: { route: string | null; sent_from: { device?: string | null; installed?: boolean | null } | null }, season: string | null): string {
  const screen = screenOf(r.route, season);
  const device = r.sent_from?.device ?? null;
  const installed = r.sent_from?.installed;
  const how = [installed == null ? null : installed ? "the installed app" : "in the browser", designOf(r.route)].filter(Boolean);
  return `Sent from ${screen ?? "the app"}${device ? ` on ${device}` : ""}${how.length ? ` · ${how.join(" · ")}` : ""}`;
}

const rowOf = (r: Record<string, unknown>): ReportRow => {
  const idea = r.type === "feature";
  return {
    id: r.id as string,
    title: reportTitle(r.message as string),
    idea,
    about: idea ? "an idea" : ((r.league_name as string | null) ?? screenOf(r.route as string | null, r.route_season as string | null) ?? "a problem"),
    who: { id: (r.user_id as string | null) ?? null, name: r.username as string, colour: (r.colour as string | null) ?? null },
    at: (r.created_at as Date).toISOString(),
    done: !!r.done_at,
  };
};

const WHERE_FILTER: Record<ReportFilter, string> = { open: "r.done_at IS NULL", done: "r.done_at IS NOT NULL" };

/** Each filter's size, unsearched. */
export async function reportCounts(): Promise<Record<ReportFilter, number>> {
  const { rows } = await pool.query(`SELECT count(*) FILTER (WHERE done_at IS NULL)::int AS open, count(*) FILTER (WHERE done_at IS NOT NULL)::int AS done FROM issue_reports`);
  return rows[0];
}

/** One page of Find › Reports: open or done, searched by what it says or who sent it, newest first. */
export async function deskReports(opts: { q?: string | null; f?: string | null; offset?: unknown; limit?: unknown; counts?: boolean }): Promise<ReportsList> {
  const f: ReportFilter = REPORT_FILTERS.includes(opts.f as ReportFilter) ? (opts.f as ReportFilter) : "open";
  const offset = Math.min(1_000_000, Math.max(0, Math.floor(Number(opts.offset) || 0)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || REPORT_PAGE)));
  const term = (opts.q ?? "").trim();
  const params: unknown[] = [];
  const where = [WHERE_FILTER[f]];
  if (term) {
    params.push(likeOf(term));
    where.push(`(r.message ILIKE $${params.length} OR r.username ILIKE $${params.length})`);
  }
  const [{ rows: total }, { rows }, counts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM issue_reports r WHERE ${where.join(" AND ")}`, params),
    pool.query(`SELECT ${REPORT_COLS} FROM ${REPORT_FROM} WHERE ${where.join(" AND ")} ORDER BY r.created_at DESC, r.id LIMIT ${limit} OFFSET ${offset}`, params),
    opts.counts === false ? null : reportCounts(),
  ]);
  return { reports: rows.map(rowOf), total: total[0].n, ...(counts ? { counts } : {}) };
}

/** Find's search: the first three reports that say it or were sent by them, open or done, and how many do. */
export async function findReports(q: string): Promise<{ reports: ReportRow[]; total: number }> {
  const like = likeOf(q.trim());
  const [{ rows: total }, { rows }] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM issue_reports r WHERE r.message ILIKE $1 OR r.username ILIKE $1`, [like]),
    pool.query(`SELECT ${REPORT_COLS} FROM ${REPORT_FROM} WHERE r.message ILIKE $1 OR r.username ILIKE $1 ORDER BY (r.done_at IS NULL) DESC, r.created_at DESC LIMIT 3`, [like]),
  ]);
  return { reports: rows.map(rowOf), total: total[0].n };
}

/** The open reports, newest first: the Inbox's (at most `limit`). */
export async function openReports(limit = 20): Promise<ReportRow[]> {
  const { rows } = await pool.query(`SELECT ${REPORT_COLS} FROM ${REPORT_FROM} WHERE r.done_at IS NULL ORDER BY r.created_at DESC LIMIT $1`, [limit]);
  return rows.map(rowOf);
}

/** The reports someone sent, newest first (their page's Reports they sent). */
export async function reportsBy(userId: string): Promise<ReportRow[]> {
  const { rows } = await pool.query(`SELECT ${REPORT_COLS} FROM ${REPORT_FROM} WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 20`, [userId]);
  return rows.map(rowOf);
}

export interface DeskReport extends ReportRow {
  /** Their words, whole. */
  message: string;
  /** "Sent from Settings on an iPhone · the installed app · the new design". */
  sentFrom: string;
  /** The account that sent it (null: deleted since). */
  sender: { id: string; name: string; email: string | null; activeAt: string | null; colour: string | null } | null;
  /** Act as the sender: why it's off (null: it isn't). */
  actOff: string | null;
  /** Where it came from: the game it was sent from, else the show's season, else their couch. */
  game: { leagueId: string; name: string; season: string | null; couch: { id: string; name: string } | null; deleted: boolean } | null;
  season: { id: string; name: string; screen: string | null } | null;
  couch: { id: string; name: string } | null;
  doneBy: string | null;
  doneAt: string | null;
  history: DeskLine[];
}

async function reportRow(id: string, db: Pool | PoolClient = pool) {
  if (!isUuid(id)) throw new HttpError(404, "That report isn't here");
  const { rows } = await db.query(`SELECT ${REPORT_COLS} FROM ${REPORT_FROM} WHERE r.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "That report isn't here: it was deleted");
  return rows[0];
}

/** A report's page. */
export async function deskReport(user: SessionUser, id: string): Promise<DeskReport> {
  const r = await reportRow(id);
  const [{ rows: sender }, { rows: game }, { rows: couch }, { rows: doneBy }] = await Promise.all([
    r.user_id
      ? pool.query(`SELECT u.id, COALESCE(u.username, u.name) AS name, u.email, u.role = 'admin' AS admin, (${WAITING}) AS waiting, u.banned IS TRUE AS stopped, ${LAST_ACTIVE} AS active, st.colour
                      FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id WHERE u.id = $1`, [r.user_id])
      : { rows: [] },
    r.league_id
      ? pool.query(`SELECT l.id, l.name, l.deleted_at, ${LEAGUE_SEASON_NAME} AS season, c.id AS couch_id, c.name AS couch FROM leagues l LEFT JOIN couches c ON c.id = l.couch_id WHERE l.id = $1`, [r.league_id])
      : { rows: [] },
    r.user_id
      ? pool.query(`SELECT c.id, c.name FROM couch_members m JOIN couches c ON c.id = m.couch_id WHERE m.user_id = $1 ORDER BY m.joined_at LIMIT 1`, [r.user_id])
      : { rows: [] },
    r.done_by ? pool.query(`SELECT COALESCE(username, name) AS name FROM "user" WHERE id = $1`, [r.done_by]) : { rows: [] },
  ]);
  const s = sender[0];
  const g = game[0];
  const actOff = !s
    ? "Their account was deleted"
    : s.id === user.id
      ? "It's from you"
      : s.admin
        ? "Not another site admin"
        : s.waiting
          ? "They're waiting to get in: let them in first"
          : s.stopped
            ? "They can't sign in now"
            : null;
  const tab = typeof r.route === "string" ? r.route.split(/[?#]/)[0].split("/").filter(Boolean)[2] : undefined;
  return {
    ...rowOf(r),
    message: r.message,
    sentFrom: sentFromLine(r, r.route_season),
    sender: s ? { id: s.id, name: s.name, email: realEmail(s.email), activeAt: s.active ? new Date(s.active).toISOString() : null, colour: s.colour ?? null } : null,
    actOff,
    game: g ? { leagueId: g.id, name: g.name, season: g.season ?? null, couch: g.couch_id ? { id: g.couch_id, name: g.couch } : null, deleted: !!g.deleted_at } : null,
    season: r.route_season_id ? { id: r.route_season_id, name: r.route_season, screen: tab ? (TABS[tab] ?? null) : null } : null,
    couch: couch[0] ? { id: couch[0].id, name: couch[0].name } : null,
    doneBy: r.done_by === user.id ? "you" : (doneBy[0]?.name ?? null),
    doneAt: r.done_at ? new Date(r.done_at).toISOString() : null,
    history: byNewest([
      ...(await deskLines("report", id)),
      { id: null, text: `Sent by ${r.username}`, at: new Date(r.created_at).toISOString(), who: null, undoable: false, undone: false },
    ]),
  };
}

/** Mark done (it leaves the Inbox) or Reopen (back in it): tier 1, a line in its History with Undo. */
export async function setReportDone(user: SessionUser, id: string, done: unknown): Promise<{ changeId: string; text: string }> {
  if (typeof done !== "boolean") throw new HttpError(400, "done is true or false");
  const changeId = await tx(async (db) => {
    const { rows } = await db.query("SELECT done_at, done_by FROM issue_reports WHERE id = $1 FOR UPDATE", [isUuid(id) ? id : null]);
    if (!rows[0]) throw new HttpError(404, "That report isn't here: it was deleted");
    if (!!rows[0].done_at === done) throw new HttpError(409, done ? "It's done already" : "It's open already");
    await db.query("UPDATE issue_reports SET done_at = CASE WHEN $2 THEN now() END, done_by = CASE WHEN $2 THEN $3 END WHERE id = $1", [id, done, user.id]);
    return logDesk(db, {
      entity: "report",
      entityId: id,
      action: done ? "done" : "reopen",
      text: done ? "Marked done" : "Reopened",
      before: { doneAt: rows[0].done_at, doneBy: rows[0].done_by },
      after: { done },
      undo: { type: "report", id, done: !done, doneAt: rows[0].done_at ? new Date(rows[0].done_at).toISOString() : null, doneBy: rows[0].done_by },
      userId: user.id,
    });
  });
  return { changeId, text: done ? "Done · it leaves the Inbox" : "Reopened · it's in the Inbox" };
}

/** History's Undo for a report's line: open or done as it was, refused once it has moved on (or gone). */
export async function restoreReport(u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  const done = u.done === true;
  await tx(async (db) => {
    const { rows } = await db.query("SELECT done_at FROM issue_reports WHERE id = $1 FOR UPDATE", [isUuid(id) ? id : null]);
    if (!rows[0]) throw new HttpError(409, "That report was deleted");
    if (!!rows[0].done_at === done) throw new HttpError(409, done ? "It's done again since" : "It's open again since");
    // Whoever marked it done, while their account stands (a deleted one leaves it done by nobody named).
    await db.query(`UPDATE issue_reports SET done_at = $2, done_by = (SELECT id FROM "user" WHERE id = $3) WHERE id = $1`, [id, done ? (u.doneAt ?? new Date().toISOString()) : null, done ? (u.doneBy ?? null) : null]);
  });
}

/** Delete this report (tier 3): gone for good; the sender isn't told. Its line stays in the desk's log. */
export async function deleteReport(user: SessionUser, id: string): Promise<{ text: string }> {
  await tx(async (db) => {
    const r = await reportRow(id, db);
    await db.query("DELETE FROM issue_reports WHERE id = $1", [id]);
    await logDesk(db, { entity: "report", entityId: id, action: "delete", text: `Deleted "${reportTitle(r.message)}", from ${r.username}`, before: { message: r.message, username: r.username }, userId: user.id });
  });
  return { text: "Report deleted" };
}

/** What someone sends from Report a problem, with where it was sent from (the user agent's device; the app says if it's installed). */
export function sentFromOf(ua: string | null, installed: unknown): { device: string | null; installed: boolean | null } | null {
  const device = deviceOf(ua);
  const inst = typeof installed === "boolean" ? installed : null;
  return device || inst != null ? { device, installed: inst } : null;
}
