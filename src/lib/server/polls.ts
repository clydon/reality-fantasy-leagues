import { publicMediaSrc } from "@/lib/game/selectors";
import { isUuid, type SessionUser } from "./auth-helpers";
import type { BingoMove } from "@/lib/game/game-view";
import { weekBingo } from "./bingo";
import { callsMade, episodeFacts, seasonBook } from "./calls";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { EVERYTHING, seenThrough, seenThroughAll } from "./guard";
import { seasonSchedules, type SeasonSchedule } from "./schedule";
import { seasonHeaders, type SeasonHeader } from "./show-space";

// The couch's polls (docs/PLAN-new-design.md step 12 part 2; migration 0129 couch_polls, couch_poll_votes; the mock's
// index.html pollSheet and banishSheet): anyone on a couch starts one for a show's next episode ("Who does the couch think
// goes next?"), on the cast still in or two to four options of their own, and everyone votes until it airs.
//   GET  /api/seasons/[id]/polls?couch=   the couch's polls on a season you may see, and whether you can start one now
//   POST /api/seasons/[id]/polls?couch=   { question, cast: true } or { question, options: [2-4 words] }: start one
//   POST /api/polls/[id]                  { vote: option | null }, or { remove: true } (whoever started it, until it closes)
//   GET  /api/couches/[id]/this-week      Commercial break's This week only: each of your shows' calls and the couch's polls
//
// Spoiler-safe on the server: a poll for Episode N is only for someone who has seen Episode N - 1 (its cast is who's still in);
// its votes are hidden from everyone until it closes (only how many have voted), and after it only reach someone who has
// seen Episode N. Nobody is pushed (Noticed: polls don't notify). Nothing polls (docs/HOSTING.md).

export interface PollOption {
  key: string;
  label: string;
  photo: string | null;
}

export interface Poll {
  id: string;
  seasonId: string;
  /** "Survivor 51". */
  label: string;
  episode: number;
  question: string;
  cast: boolean;
  options: PollOption[];
  by: { userId: string; name: string } | null;
  /** You started it (and can take it down until it closes). */
  yours: boolean;
  closesAt: string;
  open: boolean;
  /** Your vote. */
  vote: string | null;
  /** How many have voted. */
  votes: number;
  /** Once it's closed and you've seen the episode: each option's votes, most first, and who. */
  results: { key: string; n: number; people: { userId: string; name: string }[] }[] | null;
  /** Closed, but you haven't seen the episode: see it first. */
  waitsFor: number | null;
}

export interface SeasonPolls {
  polls: Poll[];
  /** Whether you can start one now, and for which episode (null: nothing coming up, or you're behind). */
  start: { episode: number; airAt: string; cast: boolean } | null;
}

/** Open polls on one show's episode the couch may have at once. */
export const POLLS_OPEN_MAX = 3;
const QUESTION_MAX = 80;
const OPTION_MAX = 40;

const labelOf = (h: SeasonHeader) => `${h.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
const tidy = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** When a poll closes: its episode's air time as the schedule has it now (it follows a moved airing), else when it was started. */
function closingOf(r: { season_id: string; episode: number; closes_at: Date }, schedules: Map<string, SeasonSchedule>): number {
  const at = schedules.get(r.season_id)?.episodes.find((e) => e.number === r.episode)?.airAt;
  return at ? Date.parse(at) : new Date(r.closes_at).getTime();
}

function openEpisode(schedule: SeasonSchedule | undefined, now: Date): { number: number; airAt: string } | null {
  for (const ep of schedule?.episodes ?? []) if (ep.airAt && Date.parse(ep.airAt) > now.getTime()) return { number: ep.number, airAt: ep.airAt };
  return null;
}

/** The cast still in going into episode `n`, as poll options (season_cast ids). */
async function castOptions(seasonId: string, n: number): Promise<PollOption[]> {
  const { rows } = await pool.query("SELECT id, name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]);
  if (!rows.length) return [];
  const cast = rows.map((r) => ({ id: r.id as string, name: r.name as string, photo: publicMediaSrc(r.photo_url) }));
  const facts = await episodeFacts(seasonId, await seasonBook(seasonId), n - 1, cast);
  const gone = new Set<string>();
  for (const f of facts.values()) for (const id of f.out ?? []) gone.add(id);
  return cast.filter((c) => !gone.has(c.id)).map((c) => ({ key: c.id, label: c.name, photo: c.photo }));
}

interface PollRow {
  id: string;
  season_id: string;
  episode: number;
  question: string;
  cast_poll: boolean;
  options: PollOption[];
  created_by: string | null;
  by_name: string | null;
  closes_at: Date;
}

/** Polls as this viewer may see them: their vote, the count, and once closed (and seen) the results. */
async function pollsOut(userId: string, rows: PollRow[], marks: Map<string, number>, headers: Map<string, SeasonHeader>, schedules: Map<string, SeasonSchedule>, now: Date): Promise<Poll[]> {
  if (!rows.length) return [];
  const { rows: votes } = await pool.query(
    `SELECT v.poll_id, v.user_id, v.option, COALESCE(u.username, u.name) AS name FROM couch_poll_votes v JOIN "user" u ON u.id = v.user_id
      WHERE v.poll_id = ANY($1::uuid[]) ORDER BY v.voted_at`,
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => {
    const mine = votes.filter((v) => v.poll_id === r.id);
    const closes = closingOf(r, schedules);
    const open = closes > now.getTime();
    const seen = marks.get(r.season_id) ?? 0;
    const shows = !open && seen >= r.episode;
    const h = headers.get(r.season_id);
    return {
      id: r.id,
      seasonId: r.season_id,
      label: h ? labelOf(h) : "",
      episode: r.episode,
      question: r.question,
      cast: r.cast_poll,
      options: r.options,
      by: r.created_by ? { userId: r.created_by, name: r.by_name ?? "" } : null,
      yours: r.created_by === userId,
      closesAt: new Date(closes).toISOString(),
      open,
      vote: mine.find((v) => v.user_id === userId)?.option ?? null,
      votes: mine.length,
      results: shows
        ? r.options
            .map((o) => ({ key: o.key, n: 0, people: mine.filter((v) => v.option === o.key).map((v) => ({ userId: v.user_id as string, name: v.name as string })) }))
            .map((x) => ({ ...x, n: x.people.length }))
            .sort((a, b) => b.n - a.n)
        : null,
      waitsFor: !open && !shows ? r.episode : null,
    };
  });
}

const POLL_COLUMNS = `p.id, p.season_id, p.episode, p.question, p.cast_poll, p.options, p.created_by, COALESCE(u.username, u.name) AS by_name, p.closes_at`;

/**
 * Which polls a viewer may see on a season: one for an episode no further than the one after their mark (open, or closed and
 * waiting for them), and closed ones for the latest two episodes they've seen.
 */
const visible = (r: { season_id: string; episode: number; closes_at: Date }, mark: number, schedules: Map<string, SeasonSchedule>, now: Date) =>
  r.episode <= mark + 1 && (closingOf(r, schedules) > now.getTime() || r.episode >= mark - 1);

async function onCouch(user: SessionUser, couchId: string | null): Promise<string> {
  if (!couchId) throw new HttpError(400, "couch required");
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(403, "Polls are the couch's");
  return couchId;
}

/** The couch's polls on a season you may see, and what you could start. */
export async function seasonPolls(user: SessionUser, seasonId: string, couchIdIn: string | null, now = new Date()): Promise<SeasonPolls> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = await onCouch(user, couchIdIn);
  const [headers, schedules, seen, { rows }] = await Promise.all([
    seasonHeaders([seasonId]),
    seasonSchedules([seasonId], now),
    seenThrough(user.id, seasonId),
    pool.query(
      `SELECT ${POLL_COLUMNS} FROM couch_polls p LEFT JOIN "user" u ON u.id = p.created_by WHERE p.couch_id = $1 AND p.season_id = $2 ORDER BY p.episode DESC, p.created_at DESC`,
      [couchId, seasonId]
    ),
  ]);
  if (!headers.has(seasonId)) throw new HttpError(404, "Season not found");
  const mark = seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen;
  const polls = await pollsOut(user.id, rows.filter((r) => visible(r, mark, schedules, now)), new Map([[seasonId, mark]]), headers, schedules, now);
  const open = openEpisode(schedules.get(seasonId), now);
  const start = open && mark >= open.number - 1 ? { episode: open.number, airAt: open.airAt, cast: (await castOptions(seasonId, open.number)).length >= 2 } : null;
  return { polls: polls.sort((a, b) => Number(b.open) - Number(a.open)), start };
}

/** Start a poll for the show's next episode: on the cast still in (`cast`), or two to four options of your own. */
export async function startPoll(user: SessionUser, seasonId: string, couchIdIn: string | null, body: { question?: unknown; cast?: unknown; options?: unknown }, now = new Date()): Promise<SeasonPolls & { id: string }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = await onCouch(user, couchIdIn);
  const question = tidy(body.question, QUESTION_MAX);
  if (question.length < 3) throw new HttpError(400, "Ask the couch something");
  if (question.length > QUESTION_MAX) throw new HttpError(400, `Keep the question to ${QUESTION_MAX} characters`);
  const [schedules, seen] = await Promise.all([seasonSchedules([seasonId], now), seenThrough(user.id, seasonId)]);
  const open = openEpisode(schedules.get(seasonId), now);
  if (!open) throw new HttpError(409, "Nothing's coming up to poll the couch about");
  if (seen < open.number - 1) throw new HttpError(403, `See Episode ${open.number - 1} first`);
  let options: PollOption[];
  if (body.cast === true) {
    options = await castOptions(seasonId, open.number);
    if (options.length < 2) throw new HttpError(409, "This show has no cast to poll about: write the options");
  } else {
    if (!Array.isArray(body.options)) throw new HttpError(400, "options required: two to four, or cast: true");
    const words = body.options.map((o) => tidy(o, OPTION_MAX)).filter(Boolean);
    if (words.length < 2 || words.length > 4) throw new HttpError(400, "Two to four options");
    if (words.some((w) => w.length > OPTION_MAX)) throw new HttpError(400, `Keep each option to ${OPTION_MAX} characters`);
    if (new Set(words.map((w) => w.toLowerCase())).size !== words.length) throw new HttpError(400, "Each option once");
    options = words.map((w, i) => ({ key: String(i + 1), label: w, photo: null }));
  }
  // The open episode's polls are all still open (it hasn't aired).
  const { rows: count } = await pool.query("SELECT count(*)::int AS n FROM couch_polls WHERE couch_id = $1 AND season_id = $2 AND episode = $3", [
    couchId,
    seasonId,
    open.number,
  ]);
  if (count[0].n >= POLLS_OPEN_MAX) throw new HttpError(409, `The couch has ${POLLS_OPEN_MAX} polls on Episode ${open.number} already`);
  const { rows } = await pool.query(
    `INSERT INTO couch_polls (couch_id, season_id, episode, question, cast_poll, options, created_by, closes_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [couchId, seasonId, open.number, question, body.cast === true, JSON.stringify(options), user.id, open.airAt]
  );
  return { id: rows[0].id as string, ...(await seasonPolls(user, seasonId, couchId, now)) };
}

/** Vote in a poll (null takes your vote back) or, whoever started it, take it down: until it closes. */
export async function answerPoll(user: SessionUser, pollId: string, body: { vote?: unknown; remove?: unknown }, now = new Date()): Promise<SeasonPolls> {
  if (!isUuid(pollId)) throw new HttpError(404, "Poll not found");
  const { rows } = await pool.query("SELECT couch_id, season_id, episode, options, created_by, closes_at FROM couch_polls WHERE id = $1", [pollId]);
  const p = rows[0];
  if (!p) throw new HttpError(404, "Poll not found");
  const couchId = await onCouch(user, p.couch_id).catch(() => {
    throw new HttpError(404, "Poll not found");
  });
  const [seen, schedules] = await Promise.all([seenThrough(user.id, p.season_id), seasonSchedules([p.season_id], now)]);
  if (seen < p.episode - 1) throw new HttpError(404, "Poll not found");
  if (closingOf({ season_id: p.season_id, episode: p.episode, closes_at: p.closes_at }, schedules) <= now.getTime()) throw new HttpError(409, "The poll closed when the episode started");
  if (body.remove === true) {
    if (p.created_by !== user.id) throw new HttpError(403, "Only whoever started it can take it down");
    await pool.query("DELETE FROM couch_polls WHERE id = $1", [pollId]);
  } else if (body.vote === null) {
    await pool.query("DELETE FROM couch_poll_votes WHERE poll_id = $1 AND user_id = $2", [pollId, user.id]);
  } else {
    if (typeof body.vote !== "string" || !(p.options as PollOption[]).some((o) => o.key === body.vote)) throw new HttpError(400, "Vote for one of its options");
    await pool.query(
      `INSERT INTO couch_poll_votes (poll_id, user_id, option) VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id) DO UPDATE SET option = EXCLUDED.option, voted_at = now()`,
      [pollId, user.id, body.vote]
    );
  }
  return seasonPolls(user, p.season_id, couchId, now);
}

// ---------- Commercial break ----------

export interface ThisWeekShow {
  seasonId: string;
  label: string;
  artUrl: string | null;
  episode: number;
  airAt: string;
  /** Your calls on it: how many of its questions you've called, of how many (null: it isn't a game, so no calls). */
  calls: { made: number; of: number } | null;
  /** Your bingo card this week (step 12 part 3): the episode you'd watch next once it's aired, else this one; null: no bingo. */
  bingo: BingoMove | null;
}

/**
 * Commercial break's This week only (the mock's hubplus.js breakHTML): for each show you follow or play that has an episode
 * coming up, Call it and how far you've got with it, your bingo card (part 3), and the couch's polls you may see. Read when the
 * page opens.
 */
export async function couchThisWeek(user: SessionUser, couchIdIn: string, now = new Date()): Promise<{ shows: ThisWeekShow[]; polls: Poll[] }> {
  const couchId = await onCouch(user, couchIdIn);
  const { rows: follows } = await pool.query(
    `SELECT DISTINCT season_id FROM (
       SELECT season_id FROM show_follows WHERE user_id = $1 AND following
       UNION SELECT ss.id FROM league_memberships m JOIN leagues l ON l.id = m.league_id AND l.deleted_at IS NULL
         JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE m.user_id = $1) x`,
    [user.id]
  );
  const ids = follows.map((r) => r.season_id as string);
  if (!ids.length) return { shows: [], polls: [] };
  const [headers, schedules, marks] = await Promise.all([seasonHeaders(ids), seasonSchedules(ids, now), seenThroughAll(user.id)]);
  const shows: ThisWeekShow[] = [];
  for (const id of ids) {
    const h = headers.get(id);
    const open = openEpisode(schedules.get(id), now);
    // A week ahead at most: this week only.
    if (!h || !open || Date.parse(open.airAt) - now.getTime() > 8 * 24 * 3600_000) continue;
    const mark = marks.get(id) ?? 0;
    let calls: ThisWeekShow["calls"] = null;
    if (h.ready && (h.show.kind === "talk" || mark >= open.number - 1)) {
      const made = await callsMade(user.id, id, now).catch(() => null);
      if (made && made.of) calls = { made: made.made, of: made.of };
    }
    const bingo = h.ready ? await weekBingo(user.id, id, mark === EVERYTHING ? Number.POSITIVE_INFINITY : mark, schedules.get(id), now).catch(() => null) : null;
    shows.push({ seasonId: id, label: labelOf(h), artUrl: h.show.artUrl, episode: open.number, airAt: open.airAt, calls, bingo });
  }
  shows.sort((a, b) => Date.parse(a.airAt) - Date.parse(b.airAt));
  const { rows } = await pool.query(
    `SELECT ${POLL_COLUMNS} FROM couch_polls p LEFT JOIN "user" u ON u.id = p.created_by
      WHERE p.couch_id = $1 AND p.season_id = ANY($2::uuid[]) AND p.closes_at > now() - interval '8 days'
      ORDER BY p.closes_at DESC`,
    [couchId, ids]
  );
  const mark = (id: string) => {
    const m = marks.get(id) ?? 0;
    return m === EVERYTHING ? Number.POSITIVE_INFINITY : m;
  };
  const polls = await pollsOut(user.id, rows.filter((r) => visible(r, mark(r.season_id), schedules, now)), new Map(ids.map((id) => [id, mark(id)])), headers, schedules, now);
  return { shows, polls: polls.sort((a, b) => Number(b.open) - Number(a.open)) };
}
