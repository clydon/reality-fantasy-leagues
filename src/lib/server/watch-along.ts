import {
  isReactKind,
  LATE_MS,
  MAX_RUNTIME_MS,
  mayWatch,
  othersThrough,
  TEXT_MAX,
  watchEpisode,
  cleanText,
  type Gif,
  type ReactionKind,
} from "@/lib/game/watch-along";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { gifFrom, type GifSource } from "./gifs";
import { EVERYTHING, seenThrough } from "./guard";
import { DEFAULT_RUNTIME_MIN, latestAired, seasonSchedules, upNext, type SeasonSchedule } from "./schedule";

// Watch along (docs/PLAN-new-design.md step 13 part 1; migration 0131 watch_reactions; the pure rules are watch-along.ts):
//   GET    /api/seasons/[id]/watch?couch=                 Tonight's card: which episode you'd watch along, and who on the couch
//          left reactions on it (how many, never what)
//   GET    /api/seasons/[id]/watch/[n]?couch=&at=&since=&open=1
//          what's been said on episode n between two moments: the couch's reactions from just after `since` through 30 s
//          before `at` (where your clock is, in ms), and your own through `at`; with `open`, also the pins (the moments of the
//          comments and GIFs you've passed) and the couch's count
//   POST   /api/seasons/[id]/watch/[n]?couch=             { at, kind, text?, gif? } say something at a moment
//   DELETE /api/seasons/[id]/watch/[n]/[reactionId]       take back something you said
//
// Spoiler-safe on the server: you watch along an episode you've seen or your next one (guard.ts seenThrough), once it's aired
// (the next to air opens as "soon", with nothing in it); the couch's reactions reach you only once your clock is 30 s past their
// moment (never early, and never past what has aired since its airtime), from people on the couch who follow the show openly
// (guard.ts visibleFollows: a private watcher's stay theirs), said to this couch. Alone (no couch, or a couch of one) it's just
// yours. A reaction is a moment of an episode, so it says what that person was watching, as a rating says they've seen it. The
// screen polls the read while its clock runs (docs/HOSTING.md), so a season's air times are kept a little while per server.

export interface WatchFace {
  userId: string;
  name: string;
}

export interface Reaction {
  id: string;
  runtimeMs: number;
  userId: string;
  name: string;
  mine: boolean;
  kind: ReactionKind;
  text: string | null;
  gif: Gif | null;
}

export type WatchStatus = "aired" | "live" | "soon";

export interface WatchCard {
  seasonId: string;
  /** The episode you'd watch along (your next, or the next to air when you're caught up); null when there's none. */
  episode: number | null;
  status: WatchStatus | null;
  airAt: string | null;
  runtimeMin: number;
  /** The couch's reactions on it (not yours): how many, and who, most first. */
  count: number;
  people: WatchFace[];
}

export interface WatchRead {
  seasonId: string;
  episode: number;
  status: WatchStatus;
  airAt: string | null;
  runtimeMin: number;
  /** Where your clock was read at (ms), and how far into the episode the couch's reactions were sent (-1: none yet). */
  at: number;
  through: number;
  reactions: Reaction[];
  /** With `open`: the moments of the comments and GIFs you've passed (the couch's through `through`, yours through `at`). */
  pins: number[] | null;
  /** With `open`: the couch's reactions on the episode, how many and who (never what, nor when). */
  count: number | null;
  people: WatchFace[] | null;
  /** couch: the couch's people's reactions come too; solo: on no couch or a couch of one, just yours. */
  scope: "couch" | "solo";
  you: { following: boolean; private: boolean; seen: boolean };
  gifs: boolean;
}

/** At most this many a read, and on an episode from one person. */
const READ_MAX = 300;
const PINS_MAX = 600;
const PER_EPISODE_MAX = 1500;
/** Quick taps are fine, a flood isn't: this many in ten seconds. */
const BURST_MAX = 12;
/** A moment can't be said before it's aired: this much slack for a clock a little ahead. */
const AHEAD_SLACK_MS = 5000;

function episodeNumber(n: unknown): number {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(400, "Which episode?");
  return e;
}

function msParam(v: unknown, name: string): number {
  const ms = Number(v);
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_RUNTIME_MS) throw new HttpError(400, `${name} must be a moment of the episode, in ms`);
  return Math.floor(ms);
}

// A season's air times change only when research or an admin moves them: the poll reads them from here for half a minute
// (each watch along's first read and every write ask again, and keep what they read).
const SCHEDULE_TTL_MS = 30_000;
const kept = new Map<string, { at: number; schedule: SeasonSchedule }>();

async function scheduleOf(seasonId: string, fresh: boolean): Promise<SeasonSchedule> {
  const have = kept.get(seasonId);
  if (!fresh && have && Date.now() - have.at < SCHEDULE_TTL_MS) return have.schedule;
  const schedule = (await seasonSchedules([seasonId])).get(seasonId);
  if (!schedule) throw new HttpError(404, "Season not found");
  kept.set(seasonId, { at: Date.now(), schedule });
  if (kept.size > 500) kept.delete(kept.keys().next().value as string);
  return schedule;
}

interface Context {
  schedule: SeasonSchedule;
  mark: number;
  latest: number;
  next: number | null;
  live: number | null;
  /** The couch said to (validated), and whether its other people's reactions come (a couch of one: no). */
  couch: string | null;
  others: boolean;
}

async function context(user: SessionUser, seasonId: string, couchId: string | null, now: Date, fresh: boolean): Promise<Context> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const [schedule, seen, couch] = await Promise.all([scheduleOf(seasonId, fresh), seenThrough(user.id, seasonId), couchOf(user, couchId)]);
  const up = upNext(schedule, now);
  const next = schedule.episodes.find((e) => e.airAt && Date.parse(e.airAt) > now.getTime())?.number ?? null;
  return {
    schedule,
    mark: seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen,
    latest: latestAired(schedule, now),
    next,
    live: up?.live ? up.number : null,
    couch: couch.id,
    others: couch.others,
  };
}

async function couchOf(user: SessionUser, couchId: string | null): Promise<{ id: string | null; others: boolean }> {
  if (!couchId) return { id: null, others: false };
  await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE couch_id = $1", [couchId]);
  return { id: couchId, others: rows[0].n > 1 };
}

const runtimeOf = (schedule: SeasonSchedule, n: number) => schedule.episodes.find((e) => e.number === n)?.runtimeMin ?? DEFAULT_RUNTIME_MIN;
const airAtOf = (schedule: SeasonSchedule, n: number) => schedule.episodes.find((e) => e.number === n)?.airAt ?? null;

/** How long ago episode n first aired, in ms (null before then). */
function airedFor(schedule: SeasonSchedule, n: number, now: Date): number | null {
  const at = airAtOf(schedule, n);
  if (!at) return null;
  const ms = now.getTime() - Date.parse(at);
  return ms >= 0 ? ms : null;
}

/** The couch's people (not you) who follow the season openly, as a condition on `r` with $season (1), $couch and $me. */
const FROM_COUCH = (couch: string, me: string) => `r.couch_id = ${couch} AND r.user_id <> ${me}
  AND r.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = ${couch})
  AND EXISTS (SELECT 1 FROM show_follows f WHERE f.user_id = r.user_id AND f.season_id = r.season_id AND f.following AND NOT f.private)`;

/** The couch's reactions on an episode: how many, and who (most first). */
async function couchCount(seasonId: string, n: number, ctx: Context, me: string): Promise<{ count: number; people: WatchFace[] }> {
  if (!ctx.couch || !ctx.others) return { count: 0, people: [] };
  const { rows } = await pool.query(
    `SELECT r.user_id, COALESCE(u.username, u.name) AS name, count(*)::int AS n
       FROM watch_reactions r JOIN "user" u ON u.id = r.user_id
      WHERE r.season_id = $1 AND r.episode = $2 AND ${FROM_COUCH("$3", "$4")}
      GROUP BY r.user_id, u.username, u.name ORDER BY n DESC, name`,
    [seasonId, n, ctx.couch, me]
  );
  return { count: rows.reduce((t, r) => t + (r.n as number), 0), people: rows.map((r) => ({ userId: r.user_id as string, name: r.name as string })) };
}

/** Tonight's card: the episode you'd watch along, and what the couch left on it. */
export async function watchCard(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<WatchCard> {
  const ctx = await context(user, seasonId, couchId, now, true);
  const pick = watchEpisode({ mark: ctx.mark, latestAired: ctx.latest, next: ctx.next, live: ctx.live });
  if (!pick) return { seasonId, episode: null, status: null, airAt: null, runtimeMin: DEFAULT_RUNTIME_MIN, count: 0, people: [] };
  const left = pick.status === "soon" ? { count: 0, people: [] } : await couchCount(seasonId, pick.episode, ctx, user.id);
  return {
    seasonId,
    episode: pick.episode,
    status: pick.status,
    airAt: airAtOf(ctx.schedule, pick.episode),
    runtimeMin: runtimeOf(ctx.schedule, pick.episode),
    ...left,
  };
}

type Row = { id: string; runtime_ms: number; user_id: string; name: string; kind: ReactionKind; text: string | null; gif: Gif | null };
const asReaction = (r: Row, me: string): Reaction => ({
  id: r.id,
  runtimeMs: r.runtime_ms,
  userId: r.user_id,
  name: r.name,
  mine: r.user_id === me,
  kind: r.kind,
  text: r.text,
  gif: r.gif,
});

/** What's been said on an episode between two moments, as this viewer may be sent it (above). */
export async function watchRead(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  nIn: unknown,
  q: { at?: unknown; since?: unknown; open?: boolean },
  gifs: boolean,
  now = new Date()
): Promise<WatchRead> {
  const n = episodeNumber(nIn);
  const at = q.at === undefined || q.at === null || q.at === "" ? 0 : msParam(q.at, "at");
  // Exclusive: what's after `since` (-1, or nothing: from the start).
  const since = q.since === undefined || q.since === null || q.since === "" ? -1 : Number(q.since) === -1 ? -1 : msParam(q.since, "since");
  const ctx = await context(user, seasonId, couchId, now, !!q.open);
  const may = mayWatch(n, { mark: ctx.mark, latestAired: ctx.latest, next: ctx.next, live: ctx.live });
  if (!may.ok) throw new HttpError(may.status, may.error);
  const aired = airedFor(ctx.schedule, n, now);
  const through = ctx.others ? othersThrough(at, aired) : -1;
  // Your own come back through where you are, without the wait (you said them); never past what's aired either.
  const mineThrough = aired === null ? -1 : Math.min(at, aired);
  const { rows: follow } = await pool.query("SELECT following, private FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]);
  const you = { following: !!follow[0]?.following, private: !!follow[0]?.private, seen: n <= ctx.mark };
  const base = {
    seasonId,
    episode: n,
    status: may.status,
    airAt: airAtOf(ctx.schedule, n),
    runtimeMin: runtimeOf(ctx.schedule, n),
    at,
    scope: (ctx.others ? "couch" : "solo") as "couch" | "solo",
    you,
    gifs,
  };
  if (mineThrough < 0) return { ...base, through: -1, reactions: [], pins: q.open ? [] : null, count: q.open ? 0 : null, people: q.open ? [] : null };

  // Yours on this couch (or on none, alone), and the couch's people's; each through its own moment.
  const params: unknown[] = [seasonId, n, user.id, ctx.couch, since, mineThrough, through];
  const scope = `r.season_id = $1 AND r.episode = $2 AND (
      (r.user_id = $3 AND r.couch_id IS NOT DISTINCT FROM $4::uuid AND r.runtime_ms <= $6)
      OR (${FROM_COUCH("$4::uuid", "$3")} AND r.runtime_ms <= $7)) AND r.runtime_ms > $5`;
  const [{ rows }, pins, left] = await Promise.all([
    pool.query(
      `SELECT * FROM (
         SELECT r.id, r.runtime_ms, r.user_id, COALESCE(u.username, u.name) AS name, r.kind, r.text, r.gif, r.created_at
           FROM watch_reactions r JOIN "user" u ON u.id = r.user_id
          WHERE ${scope}
          ORDER BY r.runtime_ms DESC, r.created_at DESC LIMIT ${READ_MAX}
       ) x ORDER BY x.runtime_ms, x.created_at`,
      params
    ),
    q.open
      ? pool
          .query(`SELECT r.runtime_ms FROM watch_reactions r WHERE ${scope} AND r.kind IN ('text', 'gif') ORDER BY r.runtime_ms DESC LIMIT ${PINS_MAX}`, [
            seasonId,
            n,
            user.id,
            ctx.couch,
            -1,
            mineThrough,
            through,
          ])
          .then((r) => r.rows.map((x) => x.runtime_ms as number).reverse())
      : Promise.resolve(null),
    q.open ? couchCount(seasonId, n, ctx, user.id) : Promise.resolve(null),
  ]);
  return {
    ...base,
    through,
    reactions: rows.map((r) => asReaction(r as Row, user.id)),
    pins,
    count: left?.count ?? null,
    people: left?.people ?? null,
  };
}

/** Say something at a moment of an episode you're watching along: a comment, a quick reaction or a GIF. */
export async function sayAt(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  nIn: unknown,
  body: { at?: unknown; kind?: unknown; text?: unknown; gif?: unknown },
  src: GifSource | null,
  now = new Date()
): Promise<Reaction> {
  const n = episodeNumber(nIn);
  const at = msParam(body.at, "at");
  let text: string | null = null;
  let gif: Gif | null = null;
  const kind = body.kind;
  if (kind === "text") {
    text = cleanText(body.text);
    if (!text) throw new HttpError(400, "Say something");
    if (text.length > TEXT_MAX) throw new HttpError(400, `Keep it to ${TEXT_MAX} characters`);
  } else if (kind === "gif") {
    if (!src) throw new HttpError(409, "GIFs aren't on here");
    gif = gifFrom(src, body.gif);
    if (!gif) throw new HttpError(400, "That GIF isn't one of GIPHY's");
  } else if (!isReactKind(kind)) {
    throw new HttpError(400, "kind must be text, gif, fire, laugh, eye or crown");
  }
  const ctx = await context(user, seasonId, couchId, now, true);
  const may = mayWatch(n, { mark: ctx.mark, latestAired: ctx.latest, next: ctx.next, live: ctx.live });
  if (!may.ok) throw new HttpError(may.status, may.error);
  const aired = airedFor(ctx.schedule, n, now);
  if (may.status === "soon" || aired === null) throw new HttpError(409, `Episode ${n} hasn't aired yet`);
  if (at > aired + AHEAD_SLACK_MS) throw new HttpError(409, "That moment hasn't aired yet");
  const { rows: counts } = await pool.query(
    `SELECT count(*) FILTER (WHERE created_at > now() - interval '10 seconds')::int AS burst, count(*)::int AS total
       FROM watch_reactions WHERE user_id = $1 AND season_id = $2 AND episode = $3`,
    [user.id, seasonId, n]
  );
  if (counts[0].burst >= BURST_MAX) throw new HttpError(429, "Slow down a little");
  if (counts[0].total >= PER_EPISODE_MAX) throw new HttpError(429, "That's a lot for one episode");
  const { rows } = await pool.query(
    `INSERT INTO watch_reactions (season_id, episode, runtime_ms, user_id, couch_id, kind, text, gif)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, runtime_ms, user_id, kind, text, gif`,
    [seasonId, n, Math.min(at, aired), user.id, ctx.couch, kind, text, gif ? JSON.stringify(gif) : null]
  );
  const name = (user as SessionUser & { username?: string | null }).username || user.name;
  return asReaction({ ...(rows[0] as Row), name }, user.id);
}

/** Take back something you said at a moment. */
export async function unsay(user: SessionUser, seasonId: string, nIn: unknown, reactionId: string): Promise<{ ok: true }> {
  const n = episodeNumber(nIn);
  if (!isUuid(seasonId) || !isUuid(reactionId)) throw new HttpError(404, "Not found");
  const { rowCount } = await pool.query("DELETE FROM watch_reactions WHERE id = $1 AND user_id = $2 AND season_id = $3 AND episode = $4", [reactionId, user.id, seasonId, n]);
  if (!rowCount) throw new HttpError(404, "Not found");
  return { ok: true };
}

export { LATE_MS };
