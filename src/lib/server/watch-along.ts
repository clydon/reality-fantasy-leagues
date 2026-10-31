import {
  isReactKind,
  LATE_MS,
  liveClock,
  MAX_RUNTIME_MS,
  mayWatch,
  type Watcher,
  othersThrough,
  START_EARLY_MS,
  TEXT_MAX,
  TOGETHER_CHANGES,
  watchEpisode,
  cleanText,
  type Gif,
  type ReactionKind,
  type TogetherChange,
  type WatchMode,
} from "@/lib/game/watch-along";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { gifFrom, type GifSource } from "./gifs";
import { EVERYTHING, seenThrough, sharesSql } from "./guard";
import { DEFAULT_RUNTIME_MIN, latestAired, seasonSchedules, upNext, type SeasonSchedule } from "./schedule";
import { seasonHeaders, type SeasonHeader } from "./show-space";
import { planById, inPlan, type PlanHow, type WatchPlan } from "./watch-plans";
import {
  asWatcher,
  beatOwnSession,
  beatTogether,
  joinTogether,
  leaveOwnSession,
  leaveTogether,
  moveTogether,
  togetherLook,
  togetherOf,
  togetherVersion,
  watchersOn,
  writeOwnSession,
  type TogetherRow,
} from "./watch-sessions";

// Watch along (docs/PLAN-new-design.md step 13 part 1; migration 0131 watch_reactions; the pure rules are watch-along.ts):
//   GET    /api/seasons/[id]/watch?couch=                 Tonight's card: which episode you'd watch along, and who on the couch
//          left reactions on it (how many, never what)
//   GET    /api/seasons/[id]/watch/[n]?couch=&at=&since=&open=1
//          what's been said on episode n between two moments: the couch's reactions from just after `since` through 30 s
//          before `at` (where your clock is, in ms), and your own through `at`; with `open`, also the pins (the moments of the
//          comments and GIFs you've passed) and the couch's count
//   POST   /api/seasons/[id]/watch/[n]?couch=             { at, kind, text?, gif? } say something at a moment
//   DELETE /api/seasons/[id]/watch/[n]/[reactionId]       take back something you said
//   POST   /api/seasons/[id]/watch/[n]/session?couch=     { at, mode, running, ad } your watch along's clock, when it starts, pauses
//          or moves; { beat: true } it's still open (paused); { at, leave: true } closed (step 13 part 2, watch-sessions.ts)
//
// Spoiler-safe on the server: you watch along an episode you've seen or your next one (guard.ts seenThrough), once it's aired
// (the next to air opens as "soon", with nothing in it); the couch's reactions reach you only once your clock is 30 s past their
// moment (never early, and never past what has aired since its airtime), from people on the couch who follow the show openly
// and share My watch along reactions (guard.ts sharesSql, step 15 part 3: a private watcher's stay theirs), said to this couch.
// Watching together, what the people in the session say in it reaches the rest of them whatever that switch says (they're in
// the room, as being in it shows them: When I'm watching doesn't change that either). Alone (no couch, or a couch of one) it's just
// yours. A reaction is a moment of an episode, so it says what that person was watching, as a rating says they've seen it. The
// screen polls the read while its clock runs (docs/HOSTING.md), so a season's air times are kept a little while per server.
//
// Who's on now (step 13 part 2): the card, the read and a session write each carry `now`, the rest of the couch's open watch alongs
// (the card's on the season, the read's on its episode): who, which episode, where their clock is and how it runs. As reactions are
// heard, only from people on the couch who follow the show openly, and only on the couch they opened it on (watch-sessions.ts); the
// poll (`beat`) is the running watch along's heartbeat. It says how far someone is, never what happens.
//
// Watching together (step 13 part 3): a planned night's watch along is one clock for everyone in it (watch-sessions.ts):
//   GET  /api/seasons/[id]/watch/[n]/together?couch=&plan=&v=&beat=1   the night's session: just its version when `v` is still it
//        (the open watch along asks every few seconds), else who's in it, its clock and its last change ("riley paused for everyone")
//   POST /api/seasons/[id]/watch/[n]/together?couch=   { plan, join: true } open it (making it if nobody has: the live airing's
//        clock, or a shared start waiting for someone to start it), which says you're in and leaves your own; { id, change, at, mode,
//        running, ad } anyone in it starts it ("3, 2, 1"), pauses, moves or starts an ad break for everyone; { id, beat: true };
//        { id, leave: true }
// and the read's `together=<id>&sv=<version>`: while it runs the one poll carries the session's version too, and what the people in
// it say while in it reaches the rest of them as they reach that moment (the same clock: no 30 s wait), everyone else's as before.
// A together session is on the plan's couch only, for whoever there may watch that episode along (mayWatch); who's in it is shown
// to the couch's people who open it (joining shows you there, as saying I'm in does), and on now to the couch as part 2 has it.

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
  /** Who else on the couch has a watch along of this season open right now (any episode), and where their clock is. */
  now: Watcher[];
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
  /** Who else on the couch is watching this episode along right now, and where their clock is (read at `at`'s moment). */
  now: Watcher[];
  /** With `together`: your together session's version, and the session when it's moved on from `sv` (step 13 part 3). */
  together?: { version: number | null; state: Together | null };
}

/** Someone on the couch watching along right now, for the hub's On now (any of the couch's shows). */
export interface OnNow extends Watcher {
  seasonId: string;
  header: SeasonHeader;
  /** Their episode is on air right now (the live airing). */
  live: boolean;
}

export interface SessionWrite {
  /** Your watch along's session (null alone: nobody else would see it, so nothing's kept). */
  session: { id: string; version: number } | null;
  now: Watcher[];
}

/** A planned night's together session as its people see it (step 13 part 3). */
export interface Together {
  id: string;
  planId: string;
  version: number;
  /** The plan's: the live airing, or a shared start; and when (the live airing's time as the schedule has it now). */
  how: PlanHow;
  startsAt: string;
  mode: WatchMode;
  /** Its clock where it is now (ms); while a "3, 2, 1" counts, where it starts, `startsInMs` from now. */
  at: number;
  running: boolean;
  ad: boolean;
  startsInMs: number;
  /** Someone has started it (a shared start waits for a tap; the live airing starts as it's opened). */
  started: boolean;
  /** Who last did what to the clock (by null: it stopped when everyone left). */
  change: { what: TogetherChange; by: string | null; userId: string | null; at: string } | null;
  /** Who's opened it, first in first, and whether they're here now. */
  people: { userId: string; name: string; here: boolean }[];
  /** You're in it (opened and not left). */
  you: boolean;
  /** Bingo squares its people have ticked since it began. */
  ticks: number;
}

/** The night's session: its version, and the session itself when it's moved on from the version you have (or you asked without one). */
export interface TogetherAnswer {
  version: number | null;
  together: Together | null;
  /** The night itself (with the session, or before anyone's opened it): how, when, and who's said they're in. */
  night: { how: PlanHow; startsAt: string; in: { userId: string; name: string }[] } | null;
  /** Who else on the couch is watching the episode along now (with the session, when it's sent). */
  now: Watcher[] | null;
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
  /** On the couch (not a site admin looking in): who's on now is only for its own people. */
  member: boolean;
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
    member: couch.member,
  };
}

async function couchOf(user: SessionUser, couchId: string | null): Promise<{ id: string | null; others: boolean; member: boolean }> {
  if (!couchId) return { id: null, others: false, member: false };
  const role = await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE couch_id = $1", [couchId]);
  return { id: couchId, others: rows[0].n > 1, member: role !== "viewer" };
}

/** Who else on the couch is watching along right now (on the season, or one episode of it), as this viewer may be told. */
async function nowOn(user: SessionUser, seasonId: string, ctx: Context, episode?: number): Promise<Watcher[]> {
  if (!ctx.couch || !ctx.others || !ctx.member) return [];
  return (await watchersOn(user.id, ctx.couch, { seasonId, episode })).map(asWatcher);
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

/** Said to this couch by someone else on it, as a condition on `r` with $couch and $me. */
const COUCH_MATE = (couch: string, me: string) => `r.couch_id = ${couch} AND r.user_id <> ${me}
  AND r.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = ${couch})`;

/** The couch's people (not you) who share their reactions on the season (guard.ts sharesSql), as a condition on `r`. */
const FROM_COUCH = (couch: string, me: string) => `${COUCH_MATE(couch, me)} AND ${sharesSql("reactions", "r.user_id", "r.season_id")}`;

/** Said in together session $s by someone in it now, since it began (a condition on `r`). */
const SAID_TOGETHER = (s: string) => `${s} IS NOT NULL AND r.created_at >= (SELECT created_at FROM watch_sessions WHERE id = ${s})
  AND EXISTS (SELECT 1 FROM watch_session_people p WHERE p.session_id = ${s} AND p.user_id = r.user_id AND p.left_at IS NULL)`;

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
  const [watching, left] = await Promise.all([
    nowOn(user, seasonId, ctx),
    !pick || pick.status === "soon" ? { count: 0, people: [] } : couchCount(seasonId, pick.episode, ctx, user.id),
  ]);
  if (!pick) return { seasonId, episode: null, status: null, airAt: null, runtimeMin: DEFAULT_RUNTIME_MIN, count: 0, people: [], now: watching };
  return {
    seasonId,
    episode: pick.episode,
    status: pick.status,
    airAt: airAtOf(ctx.schedule, pick.episode),
    runtimeMin: runtimeOf(ctx.schedule, pick.episode),
    ...left,
    now: watching,
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
  q: { at?: unknown; since?: unknown; open?: boolean; beat?: boolean; together?: string | null; sv?: unknown },
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
  // Watching together: the session must be this episode's on this couch, with you in it; else the read is your own watch along's.
  const mate = q.together ? await sessionYoureIn(user, q.together, seasonId, n, ctx) : null;
  // The running watch along's poll is its heartbeat (written now and then: watch-sessions.ts), then who else is on it.
  if (q.beat && ctx.couch) await (mate ? beatTogether(user.id, mate.id, false) : beatOwnSession(user.id, seasonId, n, ctx.couch, false));
  const others = nowOn(user, seasonId, ctx, n);
  const together = q.together ? togetherFor(user, mate, q.sv) : undefined;
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
    now: await others,
    ...(together ? { together: await together } : {}),
  };
  if (mineThrough < 0) return { ...base, through: -1, reactions: [], pins: q.open ? [] : null, count: q.open ? 0 : null, people: q.open ? [] : null };

  // Yours on this couch (or on none, alone), and the couch's people's; each through its own moment. Watching together, what the
  // session's people said in it (since it began, while they're in it) comes through your clock, as yours does: the same clock.
  const params: unknown[] = [seasonId, n, user.id, ctx.couch, since, mineThrough, through, mate?.id ?? null];
  const scope = `r.season_id = $1 AND r.episode = $2 AND (
      (r.user_id = $3 AND r.couch_id IS NOT DISTINCT FROM $4::uuid AND r.runtime_ms <= $6)
      OR (${COUCH_MATE("$4::uuid", "$3")} AND ((${sharesSql("reactions", "r.user_id", "r.season_id")} AND r.runtime_ms <= $7)
        OR (${sharesSql("play", "r.user_id", "r.season_id")} AND r.runtime_ms <= $6 AND ${SAID_TOGETHER("$8::uuid")})))) AND r.runtime_ms > $5`;
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
            mate?.id ?? null,
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
    if (!gif) throw new HttpError(400, "That GIF isn't one of KLIPY's");
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

/**
 * Your watch along's clock, kept for the couch (who's on now): written when it starts, pauses or moves (`at`, `mode`, `running`,
 * `ad`), a beat while it's open and paused (`beat`), and closing it (`leave`, with where it stopped). Only on an episode you may watch
 * along that has aired; alone (no couch) nothing's kept. Answers with who else on the couch is on that episode now.
 */
export async function sessionWrite(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  nIn: unknown,
  body: { at?: unknown; mode?: unknown; running?: unknown; ad?: unknown; beat?: unknown; leave?: unknown },
  now = new Date()
): Promise<SessionWrite> {
  const n = episodeNumber(nIn);
  const at = body.at === undefined || body.at === null ? null : msParam(body.at, "at");
  // A beat (every 20 s while paused) may use the schedule kept for half a minute; a clock write reads it afresh, as saying something does.
  const ctx = await context(user, seasonId, couchId, now, body.beat !== true);
  const may = mayWatch(n, { mark: ctx.mark, latestAired: ctx.latest, next: ctx.next, live: ctx.live });
  if (!may.ok) throw new HttpError(may.status, may.error);
  if (may.status === "soon" || airedFor(ctx.schedule, n, now) === null) throw new HttpError(409, `Episode ${n} hasn't aired yet`);
  if (!ctx.couch) return { session: null, now: [] };
  if (body.leave === true) {
    await leaveOwnSession(user.id, seasonId, n, ctx.couch, at);
    return { session: null, now: await nowOn(user, seasonId, ctx, n) };
  }
  let session: SessionWrite["session"] = null;
  if (body.beat === true) await beatOwnSession(user.id, seasonId, n, ctx.couch, true);
  else {
    if (at === null) throw new HttpError(400, "at must be a moment of the episode, in ms");
    if (body.mode !== "stream" && body.mode !== "live") throw new HttpError(400, "mode must be stream or live");
    session = await writeOwnSession(user.id, seasonId, n, ctx.couch, { at, mode: body.mode, running: body.running === true, ad: body.ad === true });
  }
  return { session, now: await nowOn(user, seasonId, ctx, n) };
}

// ---------- watching together (step 13 part 3) ----------

/** A together session of this episode on this couch with you in it (not left): its id, version and night (one small query), or null. */
async function sessionYoureIn(user: SessionUser, id: string, seasonId: string, n: number, ctx: Context): Promise<{ id: string; version: number; planId: string } | null> {
  if (!isUuid(id) || !ctx.couch) return null;
  return togetherLook(user.id, { id }, { seasonId, episode: n, couchId: ctx.couch });
}

const sameVersion = (v: unknown, version: number) => v !== undefined && v !== null && v !== "" && Number(v) === version;

/** The read's `together`: the session's version, and the session when it's moved on from `sv` (a number, or nothing for it all). */
async function togetherFor(user: SessionUser, mate: { id: string; version: number; planId: string } | null, sv: unknown): Promise<{ version: number | null; state: Together | null }> {
  if (!mate) return { version: null, state: null };
  if (sameVersion(sv, mate.version)) return { version: mate.version, state: null };
  const [s, { plan }] = await Promise.all([togetherOf({ id: mate.id }), planById(user, mate.planId, new Date())]);
  return s ? { version: s.version, state: asTogether(s, plan, user.id) } : { version: null, state: null };
}

function asTogether(s: TogetherRow, plan: { how: PlanHow; startsAt: string }, me: string): Together {
  return {
    id: s.id,
    planId: s.planId,
    version: s.version,
    how: plan.how,
    startsAt: plan.startsAt,
    mode: s.mode,
    at: s.at,
    running: s.running,
    ad: s.ad,
    startsInMs: s.startsInMs,
    started: s.change !== null,
    change: s.change && s.changedAt ? { what: s.change, by: s.changedBy?.name ?? null, userId: s.changedBy?.userId ?? null, at: s.changedAt } : null,
    people: s.people,
    you: s.people.some((p) => p.userId === me && p.here),
    ticks: s.ticks,
  };
}

/** The night (a plan on this couch, for this episode, not called off) and what this viewer may do with it. */
async function nightOf(user: SessionUser, seasonId: string, couchId: string | null, n: number, planId: unknown, now: Date) {
  if (typeof planId !== "string" || !isUuid(planId)) throw new HttpError(400, "Which watch along?");
  const ctx = await context(user, seasonId, couchId, now, true);
  if (!ctx.couch || !ctx.member) throw new HttpError(403, "Watching together is the couch's: join it first");
  const { row, plan } = await planById(user, planId, now);
  if (row.couch_id !== ctx.couch || row.season_id !== seasonId || row.episode !== n) throw new HttpError(404, "Watch along not found");
  if (row.cancelled_at) throw new HttpError(409, "That watch along was called off");
  const may = mayWatch(n, { mark: ctx.mark, latestAired: ctx.latest, next: ctx.next, live: ctx.live });
  if (!may.ok) throw new HttpError(may.status, may.error);
  return { ctx, plan, aired: airedFor(ctx.schedule, n, now) };
}

const togetherAnswer = async (user: SessionUser, s: TogetherRow | null, plan: WatchPlan, now: Promise<Watcher[]>): Promise<TogetherAnswer> => ({
  version: s?.version ?? null,
  together: s ? asTogether(s, plan, user.id) : null,
  night: { how: plan.how, startsAt: plan.startsAt, in: plan.people.filter((x) => x.answer === "in").map((x) => ({ userId: x.userId, name: x.name })) },
  now: await now,
});

/**
 * A planned night's together session (GET .../watch/[n]/together?plan=&v=&beat=1): only its version when `v` is still it, else the
 * session (null before anyone's opened it) and who else on the couch is on the episode. `beat`: the open watch along's heartbeat.
 */
export async function togetherRead(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, q: { plan?: unknown; v?: unknown; beat?: boolean }, now = new Date()): Promise<TogetherAnswer> {
  const n = episodeNumber(nIn);
  // The poll's look: you're in it and it hasn't moved, in one small query (and the heartbeat now and then). Anything else, in full.
  if (q.v !== undefined && q.v !== null && q.v !== "" && typeof q.plan === "string" && isUuid(q.plan) && isUuid(seasonId) && couchId && isUuid(couchId)) {
    const look = await togetherLook(user.id, { planId: q.plan }, { seasonId, episode: n, couchId });
    if (look && sameVersion(q.v, look.version)) {
      if (q.beat) await beatTogether(user.id, look.id, false);
      return { version: look.version, together: null, night: null, now: null };
    }
  }
  const { ctx, plan } = await nightOf(user, seasonId, couchId, n, q.plan, now);
  let s = await togetherOf({ planId: plan.id });
  if (s && q.beat && (await beatTogether(user.id, s.id, false))) s = await togetherOf({ id: s.id });
  if (s && sameVersion(q.v, s.version)) return { version: s.version, together: null, night: null, now: null };
  return togetherAnswer(user, s, plan, nowOn(user, seasonId, ctx, n));
}

/**
 * Watching together (POST .../watch/[n]/together): `{ plan, join: true }` opens the night's session (making it if nobody has),
 * `{ id, change, at, mode, running, ad }` moves its clock for everyone in it, `{ id, beat: true }` says you're still here, `{ id,
 * leave: true }` you've closed it. Answers with the session and who else is on the episode.
 */
export async function togetherWrite(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  nIn: unknown,
  body: { plan?: unknown; join?: unknown; id?: unknown; change?: unknown; at?: unknown; mode?: unknown; running?: unknown; ad?: unknown; beat?: unknown; leave?: unknown },
  now = new Date()
): Promise<TogetherAnswer> {
  const n = episodeNumber(nIn);
  if (body.join === true) {
    const { ctx, plan, aired } = await nightOf(user, seasonId, couchId, n, body.plan, now);
    if (aired === null) throw new HttpError(409, `Episode ${n} hasn't aired yet: open it at airtime`);
    // The live airing starts as it's opened, in step with someone on the couch watching it live (else from airtime, a touch
    // behind); a shared start waits for someone in it to start it.
    let first: Parameters<typeof joinTogether>[2] = { at: 0, mode: "stream", running: false, ad: false, change: null };
    if (plan.how === "live" && !(await togetherOf({ planId: plan.id }))) {
      const live = liveClock(aired, await nowOn(user, seasonId, ctx, n));
      if (live) first = { at: live.at, mode: "live", running: !live.ad, ad: live.ad, change: "start" };
    }
    const id = await joinTogether(user.id, { id: plan.id, couchId: ctx.couch!, seasonId, episode: n }, first);
    await inPlan(plan.id, user.id);
    return togetherAnswer(user, await togetherOf({ id }), plan, nowOn(user, seasonId, ctx, n));
  }
  if (typeof body.id !== "string" || !isUuid(body.id)) throw new HttpError(400, "Which watch along?");
  const was = await togetherOf({ id: body.id });
  if (!was || was.seasonId !== seasonId || was.episode !== n || was.couchId !== couchId) throw new HttpError(404, "Watch along not found");
  // Leaving always works (a night called off while you watch too); the rest is for whoever may still watch it along.
  if (body.leave === true) {
    await leaveTogether(user.id, was.id);
    return { version: await togetherVersion(was.id), together: null, night: null, now: null };
  }
  const { ctx, plan } = await nightOf(user, seasonId, couchId, n, was.planId, now);
  if (body.beat === true) {
    await beatTogether(user.id, was.id, true);
  } else {
    const change = body.change as TogetherChange;
    if (!TOGETHER_CHANGES.includes(change)) throw new HttpError(400, `change must be one of ${TOGETHER_CHANGES.join(", ")}`);
    const at = body.at === undefined || body.at === null ? null : msParam(body.at, "at");
    if (at === null) throw new HttpError(400, "at must be a moment of the episode, in ms");
    if (body.mode !== "stream" && body.mode !== "live") throw new HttpError(400, "mode must be stream or live");
    if (change === "start" && Date.parse(plan.startsAt) - now.getTime() > START_EARLY_MS) {
      throw new HttpError(409, "Not yet: it can be started from 15 minutes before its time");
    }
    const moved = await moveTogether(user.id, was.id, { at, mode: body.mode, running: body.running === true, ad: body.ad === true }, change);
    if (!moved) throw new HttpError(409, "You've left this watch along: open it again to join in");
  }
  return togetherAnswer(user, await togetherOf({ id: was.id }), plan, nowOn(user, seasonId, ctx, n));
}

/**
 * The hub's On now: who else on the couch has a watch along open right now, on which show and episode (never what happens in it).
 * Only for the couch's own people; as everywhere, only someone who follows the show openly, on the couch they opened it on.
 */
export async function couchOnNow(user: SessionUser, couchId: string, now = new Date()): Promise<{ now: OnNow[] }> {
  if ((await requireCouch(user, couchId)) === "viewer") return { now: [] };
  const rows = await watchersOn(user.id, couchId);
  if (!rows.length) return { now: [] };
  const seasons = [...new Set(rows.map((r) => r.seasonId))];
  const [headers, schedules] = await Promise.all([seasonHeaders(seasons), Promise.all(seasons.map((id) => scheduleOf(id, false)))]);
  const onAir = new Map(seasons.map((id, i) => [id, upNext(schedules[i], now)]));
  return {
    now: rows
      .filter((r) => headers.has(r.seasonId))
      .map((r) => {
        const up = onAir.get(r.seasonId);
        return { ...asWatcher(r), seasonId: r.seasonId, header: headers.get(r.seasonId)!, live: !!up?.live && up.number === r.episode };
      }),
  };
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
