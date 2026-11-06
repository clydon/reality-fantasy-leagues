import StateLogic from "@/lib/game/state-logic.js";
import { callKeys, callQuestions, isRight, settleSays, verdictOf, type CallBook, type CallFace, type CallQuestion, type EpisodeFacts, type MadeCall, type Verdict } from "@/lib/game/calls";
import { poolCallOf, type GameCalls } from "@/lib/game/game-view";
import { pickWindow } from "@/lib/game/pool-view";
import type { LeagueState } from "@/lib/game/types";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { kindOf } from "@/lib/game/formats/rulebook-schema.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { publicMediaSrc } from "@/lib/game/selectors";
import { seasonRulebook } from "@db/rulebooks.js";
import { resolveFormat } from "@db/show-formats.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { seasonHeaders, type SeasonHeader } from "./show-space";

// Call it (docs/PLAN-new-design.md step 12 part 2; migration 0129 episode_calls, episode_call_says):
//   GET  /api/seasons/[id]/calls/[n]?couch=   an episode's two calls (calls.ts callQuestions, from the season's rulebook), yours,
//        how many on the couch have called it; once it's aired and you've seen it, how each call stands and the couch's calls
//   POST /api/seasons/[id]/calls/[n]?couch=   { calls: { [question]: answer | null } } before it airs (null takes one back);
//        { said: { [question]: "yes" | "no" | null } } after you've seen it, for a call the couch settles (a talk show's)
// plus the tallies the season games read: a public pool's Who goes home? (callRights with only 'out') and Weekly Calls' table.
//
// A call is a person's (one per episode and question, whichever couch they're on), made from the next episode to air until it
// starts. Private until airtime: before then nobody else's call leaves the server, only how many have called it; after it,
// the couch's calls and how they did only reach someone who has seen the episode (guard.ts seenThrough), as everything about
// an episode does. Calling needs you to have seen the episode before it (its cast pick names who's still in), except on a talk
// show, whose calls say nothing about what's happened. Only what people share: someone else's call counts for a couch only
// while they follow the show openly (guard.ts visibleFollows), as a rating does. Graded from the season's accepted results
// (season_decisions) every read; nothing polls (docs/HOSTING.md).

export interface CallPerson {
  userId: string;
  name: string;
  calls: Record<string, string>;
  /** How many of their calls this episode were right. */
  right: number;
}

export interface CallSay {
  mine: "yes" | "no" | null;
  yes: number;
  no: number;
  settled: "yes" | "no" | null;
}

export interface EpisodeCalls {
  seasonId: string;
  episode: number;
  airAt: string | null;
  /** open: before it airs, yours to make; behind: see Episode `catchUp` first; closed: it's started (or the season has moved on). */
  status: "open" | "behind" | "closed";
  /** The episode to have seen: before calling (behind), or before seeing how the calls did (closed). */
  catchUp: number | null;
  questions: CallQuestion[];
  /** Your calls, by question. */
  mine: Record<string, string>;
  /** Once it's aired and you've seen it: how each call stands. */
  verdicts: Record<string, Verdict> | null;
  /** The couch's people who called it, you first: only once it's aired and you've seen it. */
  people: CallPerson[];
  /** How many on the couch (alone on it: everyone on Game Your Show) have called it: a count, nobody named. */
  called: number;
  /** A call the couch settles (a talk show's): what's been said, once you've seen it. */
  says: Record<string, CallSay> | null;
  /** The couch's calls (with someone else on it who shares the show), or just yours. */
  scope: "couch" | "solo";
  /** Nobody else on the couch shares the show: your own say settles a talk show's call. */
  alone: boolean;
}

/** Someone who follows the call's season openly (guard.ts visibleFollows): a condition on `c`. */
export const OPEN = "EXISTS (SELECT 1 FROM show_follows f WHERE f.user_id = c.user_id AND f.season_id = c.season_id AND f.following AND NOT f.private)";

const QUESTION_RE = /^(out|m:[\w.-]{1,100})$/;

function episodeNumber(n: unknown): number {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(400, "Which episode?");
  return e;
}

/** The season's rulebook as its calls read it: its own, else its show's format read back as blocks. */
export async function seasonBook(seasonId: string): Promise<CallBook> {
  const row = await seasonRulebook(pool, seasonId);
  if (row?.blocks) return { blocks: row.blocks as RulebookBlocks, aliases: row.aliases ?? null };
  const { rows } = await pool.query("SELECT s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const format = await resolveFormat(pool, rows[0]?.format ?? null);
  const rb = rulebookFor(format.id, format.data);
  return { blocks: rb.blocks as RulebookBlocks, aliases: rb.aliases ?? null };
}

/** The exit methods that mean winning (the winner leaves by winning, never by going home). */
function winnerMethods(book: CallBook): Set<string> {
  return new Set((book.blocks.waysOut ?? []).filter((w) => w.means === "winner").map((w) => book.aliases?.exits?.[w.id] ?? w.name));
}

interface SeasonCastRow {
  id: string;
  name: string;
  photo: string | null;
}

async function castOf(seasonId: string): Promise<SeasonCastRow[]> {
  const { rows } = await pool.query("SELECT id, name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]);
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, photo: publicMediaSrc(r.photo_url) }));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * What the season's accepted results say of each episode through `through`: who went home (as season_cast ids, by name), and
 * once every result is in (an accepted moment, or someone's full answer covering it), which moments happened.
 */
export async function episodeFacts(seasonId: string, book: CallBook, through: number, cast?: SeasonCastRow[]): Promise<Map<number, EpisodeFacts>> {
  const upTo = Number.isFinite(through) ? through : 100000;
  const out = new Map<number, EpisodeFacts>();
  if (upTo < 1) return out;
  const [{ rows }, { rows: full }, people] = await Promise.all([
    pool.query(
      `SELECT episode_number AS n, kind, COALESCE(applied->>'castawayName', castaway_name) AS name, COALESCE(applied->>'method', method) AS method,
              COALESCE(applied->>'eventType', event_type) AS event, units
         FROM season_decisions
        WHERE season_id = $1 AND status = 'accepted' AND kind IN ('elimination', 'noexit', 'event') AND episode_number <= $2`,
      [seasonId, upTo]
    ),
    pool.query(
      `SELECT DISTINCT r.episode_number AS n FROM episode_research r JOIN show_seasons ss ON ss.show_id = r.show_id AND ss.season_number = r.season_number
        WHERE ss.id = $1 AND r.episode_number <= $2 AND r.source <> 'combined' AND r.withdrawn_at IS NULL
          AND r.covers IS NOT NULL AND NOT (r.covers ? 'only') AND jsonb_typeof(r.covers->'kinds') = 'null'`,
      [seasonId, upTo]
    ),
    cast ? Promise.resolve(cast) : castOf(seasonId),
  ]);
  const idOf = new Map(people.map((c) => [norm(c.name), c.id]));
  const wins = winnerMethods(book);
  const finals = new Set<number>(full.map((r) => r.n as number));
  const byEp = new Map<number, { out: string[]; noexit: boolean; events: Set<string> }>();
  for (const r of rows) {
    const e = byEp.get(r.n) ?? { out: [], noexit: false, events: new Set<string>() };
    if (r.kind === "elimination" && !wins.has(r.method)) e.out.push(idOf.get(norm(r.name ?? "")) ?? `name:${r.name}`);
    if (r.kind === "noexit") e.noexit = true;
    if (r.kind === "event" && r.event && (r.units == null || Number(r.units) > 0)) {
      e.events.add(r.event);
      finals.add(r.n);
    }
    byEp.set(r.n, e);
  }
  for (const n of new Set([...byEp.keys(), ...finals])) {
    const e = byEp.get(n);
    const final = finals.has(n);
    out.set(n, {
      out: e && e.out.length ? e.out : e?.noexit || final ? [] : null,
      events: final ? (e?.events ?? new Set()) : null,
    });
  }
  return out;
}

/** Who's still in going into episode `n`: the season's cast, less who went home before it. */
function stillInAt(cast: SeasonCastRow[], facts: Map<number, EpisodeFacts>, n: number): CallFace[] {
  const gone = new Set<string>();
  for (const [ep, f] of facts) if (ep < n) for (const id of f.out ?? []) gone.add(id);
  return cast.filter((c) => !gone.has(c.id)).map((c) => ({ id: c.id, name: c.name, photo: c.photo }));
}

/** The next episode to air (calls are open for it), from the schedule: the first with an air time still to come. */
export function openEpisode(schedule: SeasonSchedule | undefined, now: Date): { number: number; airAt: string } | null {
  for (const ep of schedule?.episodes ?? []) if (ep.airAt && Date.parse(ep.airAt) > now.getTime()) return { number: ep.number, airAt: ep.airAt };
  return null;
}

/** A couch with someone else on it who shares the show is the calls' scope; else (solo, a couch of one) just you. */
export async function scopeOf(user: SessionUser, couchId: string | null): Promise<string | null> {
  if (!couchId) return null;
  await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE couch_id = $1", [couchId]);
  return rows[0].n > 1 ? couchId : null;
}

/** The couch's people who share a season (follow it openly), always yourself: a WHERE fragment on `c`, with $me and $couch. */
export const SHARED = (me: string, couch: string) => `(c.user_id = ${me} OR (c.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = ${couch}) AND ${OPEN}))`;

export type SayRow = { user_id: string; episode: number; question: string; happened: boolean };

/**
 * What people said happened on a season's episodes ($1 the season, $2 the episodes), for a call or a bingo square the couch
 * settles (a talk show's): their says, and every square ticked on a bingo card (step 12 part 3) by someone who has seen that
 * episode, as their say that it happened (a say of their own on it wins). `scope`: a WHERE fragment on `c` (user_id, season_id).
 */
const SAYS = (scope: string) => `SELECT c.user_id, c.episode, c.question, c.happened FROM (
    SELECT user_id, season_id, episode, question, happened FROM episode_call_says WHERE season_id = $1 AND episode = ANY($2::int[])
    UNION ALL
    SELECT b.user_id, b.season_id, b.episode, b.squares->(m.square::int)->>'key', true
      FROM bingo_cards b JOIN bingo_marks m ON m.card_id = b.id
      JOIN show_follows sf ON sf.user_id = b.user_id AND sf.season_id = b.season_id AND sf.seen_through >= b.episode
     WHERE b.season_id = $1 AND b.episode = ANY($2::int[]) AND b.squares->(m.square::int)->>'key' <> 'free'
       AND NOT EXISTS (SELECT 1 FROM episode_call_says s WHERE s.user_id = b.user_id AND s.season_id = b.season_id AND s.episode = b.episode
                         AND s.question = b.squares->(m.square::int)->>'key')
  ) c WHERE ${scope}`;

/**
 * The says on these episodes that count for someone: a viewer's (the couch's people who share the show, and them; with no couch,
 * theirs), a couch's (its people who share the show), or just these people's own.
 */
export async function saysOn(seasonId: string, episodes: number[], who: { viewer: string; couch: string | null } | { couch: string } | { users: string[] }): Promise<SayRow[]> {
  if (!episodes.length) return [];
  const [scope, params] =
    "viewer" in who
      ? who.couch
        ? [SHARED("$3", "$4"), [who.viewer, who.couch]]
        : ["c.user_id = $3", [who.viewer]]
      : "users" in who
        ? ["c.user_id = ANY($3::text[])", [who.users]]
        : [`c.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = $3) AND ${OPEN}`, [who.couch]];
  const { rows } = await pool.query(SAYS(scope), [seasonId, episodes, ...params]);
  return rows.map((r) => ({ user_id: r.user_id, episode: r.episode, question: r.question, happened: !!r.happened }));
}

/** A game scored outside its state (Weekly Calls, Weekly Bingo) is over once its season's last episode is within `through`. */
export function endedThrough(schedule: SeasonSchedule | undefined, through: number, end: number | null = null): boolean {
  // A game over a span (settings.endEpisode, docs/PLAN-sports-data.md step 6) is over at its own last episode.
  if (end !== null && through >= end) return true;
  return !!schedule?.episodeCount && through >= schedule.episodeCount;
}

/** How many on a couch, other than `userId`, share a season (follow it openly): with none, your own say settles a call. */
export async function othersSharing(couchId: string, seasonId: string, userId: string | null): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM couch_members m JOIN show_follows f ON f.user_id = m.user_id AND f.season_id = $2 AND f.following AND NOT f.private
      WHERE m.couch_id = $1 AND m.user_id IS DISTINCT FROM $3`,
    [couchId, seasonId, userId]
  );
  return rows[0].n as number;
}

interface Context {
  header: SeasonHeader;
  book: CallBook;
  talk: boolean;
  mark: number;
  airAt: string | null;
  aired: boolean;
  open: { number: number; airAt: string } | null;
  couch: string | null;
  /** Nobody else on the couch shares the show: your own say settles a talk show's call. */
  alone: boolean;
  cast: SeasonCastRow[];
}

async function context(user: SessionUser, seasonId: string, couchId: string | null, n: number, now: Date): Promise<Context> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  if (!header.ready) throw new HttpError(409, `${header.show.name} isn't a game yet: Make it a game first`);
  const [schedule, seen, book, couch, cast] = await Promise.all([
    seasonSchedules([seasonId], now).then((m) => m.get(seasonId)),
    seenThrough(user.id, seasonId),
    seasonBook(seasonId),
    scopeOf(user, couchId),
    castOf(seasonId),
  ]);
  const airAt = schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  const aired = !!airAt && Date.parse(airAt) <= now.getTime();
  const open = openEpisode(schedule, now);
  if (!aired && (!open || open.number !== n)) throw new HttpError(409, open ? `Calls are open for Episode ${open.number}` : `Episode ${n} has no air time yet`);
  const alone = !couch || (await othersSharing(couch, seasonId, user.id)) === 0;
  return { header, book, talk: kindOf(book.blocks) === "talk", mark: seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen, airAt, aired, open, couch, alone, cast };
}

/** One episode's calls, as this viewer may see them. */
export async function episodeCalls(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, now = new Date()): Promise<EpisodeCalls> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  return readCalls(user, seasonId, n, ctx);
}

async function readCalls(user: SessionUser, seasonId: string, n: number, ctx: Context): Promise<EpisodeCalls> {
  const { book, talk, mark, aired, couch } = ctx;
  // Calling needs the episode before it seen (its cast pick says who's still in); seeing how it went needs the episode itself.
  const behind = !aired && !talk && mark < n - 1;
  const showsOut = aired ? mark >= n : !behind;
  const facts = showsOut && !talk ? await episodeFacts(seasonId, book, aired ? n : n - 1, ctx.cast) : new Map<number, EpisodeFacts>();
  const questions = showsOut ? callQuestions(book, n, talk || !ctx.cast.length ? null : stillInAt(ctx.cast, facts, n)) : [];
  const [{ rows: mine }, { rows: count }] = await Promise.all([
    pool.query("SELECT question, answer FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = $3", [user.id, seasonId, n]),
    pool.query(
      `SELECT count(DISTINCT c.user_id)::int AS n FROM episode_calls c WHERE c.season_id = $1 AND c.episode = $2 AND ${couch ? SHARED("$3", "$4") : `(c.user_id = $3 OR ${OPEN})`}`,
      couch ? [seasonId, n, user.id, couch] : [seasonId, n, user.id]
    ),
  ]);
  const out: EpisodeCalls = {
    seasonId,
    episode: n,
    airAt: ctx.airAt,
    status: aired ? "closed" : behind ? "behind" : "open",
    catchUp: behind ? n - 1 : aired && mark < n ? n : null,
    questions,
    mine: Object.fromEntries(mine.map((r) => [r.question, r.answer])),
    verdicts: null,
    people: [],
    called: count[0].n,
    says: null,
    scope: couch ? "couch" : "solo",
    alone: ctx.alone,
  };
  if (!aired || mark < n) return out;

  // It's aired and you've seen it: how each call stands, what the couch said happened, and the couch's calls.
  const saysBy = await saysFor(user.id, seasonId, couch, [n]);
  const settled = settledSays(saysBy, n, user.id, ctx.alone);
  out.says = talk ? Object.fromEntries(questions.filter((q) => q.by === "couch").map((q) => [q.key, settled.get(q.key) ?? { mine: null, yes: 0, no: 0, settled: null }])) : null;
  out.verdicts = Object.fromEntries(questions.map((q) => [q.key, verdictOf(q.key, q.by, facts.get(n) ?? null, settled.get(q.key)?.settled ?? null)]));
  if (couch) {
    const { rows } = await pool.query(
      `SELECT c.user_id, COALESCE(u.username, u.name) AS name, c.question, c.answer, max(c.updated_at) OVER (PARTITION BY c.user_id) AS at
         FROM episode_calls c JOIN "user" u ON u.id = c.user_id
        WHERE c.season_id = $1 AND c.episode = $2 AND ${SHARED("$3", "$4")}`,
      [seasonId, n, user.id, couch]
    );
    const people = new Map<string, CallPerson & { at: number }>();
    for (const r of rows) {
      const p = people.get(r.user_id) ?? { userId: r.user_id as string, name: r.name as string, calls: {} as Record<string, string>, right: 0, at: new Date(r.at).getTime() };
      p.calls[r.question] = r.answer;
      people.set(r.user_id, p);
    }
    for (const p of people.values()) {
      p.right = Object.entries(p.calls).filter(([k, a]) => {
        const v = out.verdicts?.[k];
        return v?.state === "known" && v.right.includes(a);
      }).length;
    }
    out.people = [...people.values()]
      .sort((a, b) => Number(b.userId === user.id) - Number(a.userId === user.id) || b.right - a.right || a.at - b.at)
      .map((p) => ({ userId: p.userId, name: p.name, calls: p.calls, right: p.right }));
  }
  return out;
}

/** Everyone's says on these episodes who counts for this viewer: the couch's people who share the show, and you (bingo ticks too). */
async function saysFor(userId: string, seasonId: string, couch: string | null, episodes: number[]) {
  return saysOn(seasonId, episodes, { viewer: userId, couch });
}

/** What's settled of an episode's says, by question: two on the couch agreeing, or (alone on the show) your own. */
export function settledSays(says: SayRow[], n: number, me: string, alone: boolean): Map<string, CallSay> {
  const out = new Map<string, CallSay>();
  const here = says.filter((s) => s.episode === n);
  for (const key of new Set(here.map((s) => s.question))) {
    const list = here.filter((s) => s.question === key);
    const mine = list.find((s) => s.user_id === me);
    out.set(key, {
      mine: mine ? (mine.happened ? "yes" : "no") : null,
      yes: list.filter((s) => s.happened).length,
      no: list.filter((s) => !s.happened).length,
      settled: settleSays(alone ? (mine ? [mine.happened] : []) : list.map((s) => s.happened), alone),
    });
  }
  return out;
}

/** Make, change or take back your calls before the episode airs; or, once you've seen it, say what happened (a talk show's). */
export async function callEpisode(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  nIn: unknown,
  body: { calls?: unknown; said?: unknown },
  now = new Date()
): Promise<EpisodeCalls> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (body.calls === undefined && body.said === undefined) throw new HttpError(400, "calls or said required");
  if (body.calls !== undefined) {
    if (!isMap(body.calls)) throw new HttpError(400, "calls must be { question: answer }");
    if (ctx.aired) throw new HttpError(409, `Calls for Episode ${n} closed when it started`);
    const now1 = await readCalls(user, seasonId, n, ctx);
    if (now1.status === "behind") throw new HttpError(403, `See Episode ${n - 1} first: its calls say who's still in`);
    for (const [key, answer] of Object.entries(body.calls)) {
      const q = now1.questions.find((x) => x.key === key);
      if (!q || !QUESTION_RE.test(key)) throw new HttpError(400, `"${key}" isn't one of Episode ${n}'s calls`);
      if (answer === null) {
        await pool.query("DELETE FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = $3 AND question = $4", [user.id, seasonId, n, key]);
        continue;
      }
      if (typeof answer !== "string" || !q.options.some((o) => o.key === answer)) {
        throw new HttpError(400, q.kind === "cast" ? "Call someone still in" : "Yes or no");
      }
      await pool.query(
        `INSERT INTO episode_calls (user_id, season_id, episode, question, answer) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, season_id, episode, question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = now()`,
        [user.id, seasonId, n, key, answer]
      );
    }
  }
  if (body.said !== undefined) {
    if (!isMap(body.said)) throw new HttpError(400, "said must be { question: yes | no }");
    if (!ctx.aired || ctx.mark < n) throw new HttpError(403, `See Episode ${n} first`);
    const qs = callQuestions(ctx.book, n, null);
    for (const [key, said] of Object.entries(body.said)) {
      const q = qs.find((x) => x.key === key);
      if (!q || q.by !== "couch") throw new HttpError(400, `"${key}" isn't something the couch says`);
      if (said === null) {
        await pool.query("DELETE FROM episode_call_says WHERE user_id = $1 AND season_id = $2 AND episode = $3 AND question = $4", [user.id, seasonId, n, key]);
        continue;
      }
      if (said !== "yes" && said !== "no") throw new HttpError(400, "Yes or no");
      await pool.query(
        `INSERT INTO episode_call_says (user_id, season_id, episode, question, happened) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, season_id, episode, question) DO UPDATE SET happened = EXCLUDED.happened, updated_at = now()`,
        [user.id, seasonId, n, key, said === "yes"]
      );
    }
  }
  return readCalls(user, seasonId, n, ctx);
}

// ---------- what the season games read ----------

/** `n` more for `userId` at `episode`, in a count by episode (callRights' and bingo.ts bingoLines' byEpisode: step A12 part 4a). */
export function addAt(byEpisode: Map<number, Map<string, number>>, episode: number, userId: string, n: number): void {
  const at = byEpisode.get(episode) ?? new Map<string, number>();
  at.set(userId, (at.get(userId) ?? 0) + n);
  byEpisode.set(episode, at);
}

/**
 * How many calls each of these people got right on a season, from episode `from` through `through` (a viewer's mark), as the
 * season's results (or, a talk show's, the couch's says: `couchId`'s people who share the show) settle them. `only`: some
 * questions ('out' for a public pool's Who goes home?).
 */
export async function callRights(
  seasonId: string,
  userIds: string[],
  opts: { from: number; through: number; couchId: string | null; only?: (key: string) => boolean; book?: CallBook; byEpisode?: Map<number, Map<string, number>> }
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const upTo = Number.isFinite(opts.through) ? opts.through : 100000;
  if (!userIds.length || upTo < Math.max(1, opts.from)) return out;
  const { rows } = await pool.query(
    "SELECT user_id, episode, question, answer FROM episode_calls WHERE season_id = $1 AND user_id = ANY($2::text[]) AND episode BETWEEN $3 AND $4",
    [seasonId, userIds, Math.max(1, opts.from), upTo]
  );
  const calls: MadeCall[] = rows.map((r) => ({ userId: r.user_id, episode: r.episode, key: r.question, answer: r.answer }));
  if (!calls.length) return out;
  const book = opts.book ?? (await seasonBook(seasonId));
  const talk = kindOf(book.blocks) === "talk";
  const episodes = [...new Set(calls.map((c) => c.episode))];
  const facts = talk ? new Map<number, EpisodeFacts>() : await episodeFacts(seasonId, book, upTo);
  // A talk show's calls are settled by what the couch says (its people who share the show); with no couch, by your own say.
  const said = new Map<string, "yes" | "no" | null>();
  if (talk) {
    const says = await saysOn(seasonId, episodes, opts.couchId ? { couch: opts.couchId } : { users: userIds });
    const alone = !opts.couchId || (await othersSharing(opts.couchId, seasonId, null)) <= 1;
    const at = (s: { user_id: string; episode: number; question: string }) => (opts.couchId ? `${s.episode}|${s.question}` : `${s.user_id}|${s.episode}|${s.question}`);
    for (const k of new Set(says.map(at))) said.set(k, settleSays(says.filter((s) => at(s) === k).map((s) => !!s.happened), alone));
  }
  const verdictFor = (c: MadeCall) =>
    verdictOf(c.key, talk && c.key.startsWith("m:") ? "couch" : "results", facts.get(c.episode) ?? null, said.get(opts.couchId ? `${c.episode}|${c.key}` : `${c.userId}|${c.episode}|${c.key}`) ?? null);
  // Each call against its own verdict (a talk show with no couch settles each person's by their own say).
  for (const c of calls) {
    if ((opts.only && !opts.only(c.key)) || !isRight(verdictFor(c), c.answer)) continue;
    out.set(c.userId, (out.get(c.userId) ?? 0) + 1);
    // Step A12 part 4a of docs/PLAN-start-a-game-gpt.md: each episode's right calls too, for a stage's table at each episode.
    if (opts.byEpisode) addAt(opts.byEpisode, c.episode, c.userId, 1);
  }
  return out;
}

/** Your calls on the open episode (how many of its questions you've called, of how many), for a Weekly Calls move. */
export async function callsMade(userId: string, seasonId: string, now = new Date()): Promise<{ episode: number; airAt: string; made: number; of: number } | null> {
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  const open = openEpisode(schedule, now);
  if (!open) return null;
  const book = await seasonBook(seasonId);
  const cast = (await pool.query("SELECT 1 FROM season_cast WHERE season_id = $1 LIMIT 1", [seasonId])).rows.length > 0;
  const keys = callKeys(book, open.number, kindOf(book.blocks) !== "talk" && cast);
  const { rows } = await pool.query("SELECT question FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = $3", [userId, seasonId, open.number]);
  return { episode: open.number, airAt: open.airAt, made: rows.filter((r) => keys.includes(r.question)).length, of: keys.length };
}

/** A season's cast by id, for mapping a league's castaways to the season's (a pool's Who goes home?). */
export async function seasonCastIds(seasonId: string): Promise<{ id: string; name: string }[]> {
  return (await castOf(seasonId)).map((c) => ({ id: c.id, name: c.name }));
}

/**
 * A game's calls as one viewer reads them (season-games.ts, couch-hub.ts): each player's right calls through `mark`, and your
 * move: a public pool's Who goes home? for its pick's episode (your Call it's 'out', as one of the pool's castaways), or Weekly
 * Calls' next show. Null for a game that reads no calls.
 */
export async function leagueCalls(o: {
  state: LeagueState;
  couchId: string | null;
  seasonId: string;
  playerId: string | null;
  userId: string;
  mark: number | null;
  userOf: (playerId: string) => string | null;
  book?: CallBook;
  now?: Date;
}): Promise<GameCalls | null> {
  // Step R1 part 2: Weekly Calls by its pieces (a game scored by the show's calls), never a league type.
  const calls = StateLogic.piecesOf(o.state).hasCalls;
  const pooled = StateLogic.pickEmCallsOn(o.state);
  if (!calls && !pooled) return null;
  const now = o.now ?? new Date();
  // A game over a span counts its own shows only (settings.endEpisode).
  const end = StateLogic.endEpisode(o.state);
  const through = Math.min(o.mark ?? Number.POSITIVE_INFINITY, end ?? Number.POSITIVE_INFINITY);
  const book = o.book ?? (await seasonBook(o.seasonId));
  const userIds = o.state.players.map((p) => o.userOf(p.id)).filter((id): id is string => !!id);
  // A game waiting for its phase (step A3 of docs/PLAN-start-a-game-gpt.md) has no calls of its own yet: nothing counts, and
  // there's nothing to call for it.
  const start = StateLogic.startEpisode(o.state);
  const rights =
    start === null
      ? new Map<string, number>()
      : await callRights(o.seasonId, userIds, { from: start, through, couchId: calls ? o.couchId : null, only: pooled ? (k) => k === "out" : undefined, book });
  const right = (p: string) => rights.get(o.userOf(p) ?? "") ?? 0;
  if (pooled) {
    if (!o.playerId) return { right, move: null };
    const view = StateLogic.GhostLogic.viewFor(o.state, o.playerId, o.mark);
    const { ep } = pickWindow(view);
    let mine: string | null = null;
    if (ep) {
      const { rows } = await pool.query("SELECT answer FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = $3 AND question = 'out'", [
        o.userId,
        o.seasonId,
        ep.number,
      ]);
      if (rows[0]) {
        const cast = await castOf(o.seasonId);
        const called = cast.find((c) => c.id === rows[0].answer);
        mine = view.castaways.find((c) => c.seasonCastId === rows[0].answer || (!!called && norm(c.name) === norm(called.name)))?.id ?? null;
      }
    }
    return { right, move: poolCallOf(view, mine, right(o.playerId)) };
  }
  // Weekly Calls: through the latest show that's aired and you've seen; your move is the next show's calls; over once the season's
  // last show is within that (Noticed's "Weekly Calls never finishes").
  const [schedule, made] = await Promise.all([seasonSchedules([o.seasonId], now).then((m) => m.get(o.seasonId)), callsMade(o.userId, o.seasonId, now)]);
  const aired = latestAired(schedule, now);
  return {
    right,
    through: Math.min(through, aired),
    ended: endedThrough(schedule, Math.min(through, aired), end),
    // Past a span's last show there's nothing left to call for this game.
    move: start !== null && made && (end === null || made.episode <= end) ? { epId: "", episode: made.episode, airsAt: made.airAt, open: true, call: null, available: [], made: made.made, of: made.of, right: o.playerId ? right(o.playerId) : 0 } : null,
  };
}

/** The season-cast id of one of a league's castaways (linked by seasonCastId, else by name): what a pool's call is stored as. */
export async function seasonCastIdOf(seasonId: string, castaway: { name: string; seasonCastId?: string | null }): Promise<string | null> {
  const cast = await castOf(seasonId);
  if (castaway.seasonCastId && cast.some((c) => c.id === castaway.seasonCastId)) return castaway.seasonCastId;
  return cast.find((c) => norm(c.name) === norm(castaway.name))?.id ?? null;
}

/**
 * Weekly Calls' move on the home (/api/me/home), beside actionItems' (whose league states don't hold calls): for each of your
 * Weekly Calls games, the next show's calls while you haven't made them all. Step R1 part 2: a game is Weekly Calls by its pieces
 * (`states`: each game's, as the home read them, a hash each), never by its stored type; a game whose state wasn't read has none.
 */
export async function weeklyCallMoves(
  userId: string,
  games: { leagueId: string; name: string; seasonId: string | null; archived?: boolean; span?: { from: number; to: number } | null }[],
  states: Map<string, LeagueState>,
  now = new Date()
): Promise<{ kind: "calls"; text: string; href: string; leagueId: string; leagueName: string; episode: number; deadline: string; who: "you" }[]> {
  const out = [];
  for (const g of games) {
    const state = states.get(g.leagueId);
    if (!state || !StateLogic.piecesOf(state).hasCalls || !g.seasonId || g.archived) continue;
    const made = await callsMade(userId, g.seasonId, now).catch(() => null);
    if (!made || !made.of || made.made >= made.of) continue;
    // A game over a span asks for no calls past its last show.
    if (g.span && made.episode > g.span.to) continue;
    out.push({
      kind: "calls" as const,
      text: made.of - made.made === 1 && made.made ? "Make your last call" : `Make this week's ${made.of === 1 ? "call" : `${made.of === 2 ? "two" : made.of} calls`}`,
      href: `/show/${g.seasonId}/tonight`,
      leagueId: g.leagueId,
      leagueName: g.name,
      episode: made.episode,
      deadline: made.airAt,
      who: "you" as const,
    });
  }
  return out;
}
