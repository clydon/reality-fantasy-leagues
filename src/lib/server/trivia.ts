import { castStats } from "@/lib/game/cast-stats";
import { ROUND, scoreRound, triviaRound, weekOf, type TriviaQuestion, type TriviaSeason } from "@/lib/game/trivia";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { EVERYTHING, seenThroughAll } from "./guard";
import { latestAired, seasonSchedules } from "./schedule";
import { seasonFactsFor } from "./season-stats";
import { seasonHeaders, type SeasonHeader } from "./show-space";

// Trivia (docs/PLAN-new-design.md step 12 part 3; migration 0130 trivia_plays; the questions are trivia.ts's):
//   GET  /api/seasons/[id]/trivia?couch=   this week's round on the season's show: three questions, your score once you've
//        played, and the couch's scores this week
//   POST /api/seasons/[id]/trivia?couch=   { answers: { [question]: option } }: graded here; the week's first play counts
//   GET  /api/me/trivia?couch=             the rounds on your shows (Commercial break's This week only, the solo hub)
//
// Spoiler-safe on the server: a round is only about a season you've seen to its end once it's over, or the one you're on as far
// as you've seen it (guard.ts seenThroughAll; the facts are the stats' own, season-stats.ts, which never count past your mark).
// Someone else on the couch sees only your score. A new round every Monday, the same for everyone who's seen the same. Read when
// a sheet, row or page opens; nothing polls (docs/HOSTING.md).

export interface TriviaRound {
  showId: string;
  /** The season the round is named for ("Survivor 49 trivia"), and the line under it. */
  seasonId: string | null;
  title: string;
  line: string;
  week: string;
  /** Empty when there's nothing to ask yet (a season you haven't seen enough of). */
  questions: TriviaQuestion[];
  /** Your play this week (the first counts). */
  played: { score: number; of: number; answers: Record<string, string> } | null;
  /** Others on the couch who've played this week, best first: a score each, nothing else. */
  couch: { userId: string; name: string; score: number; of: number }[];
  scope: "couch" | "solo";
}

const labelOf = (h: SeasonHeader) => `${h.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;

/** What the round can ask about on a show, for this viewer: its newest season over and seen to the end, and the one they're on. */
async function subjectsOf(user: SessionUser, showId: string, couchId: string | null, now: Date): Promise<TriviaSeason[]> {
  const { rows } = await pool.query("SELECT id FROM show_seasons WHERE show_id = $1 ORDER BY season_number DESC", [showId]);
  const ids = rows.map((r) => r.id as string);
  const [headers, schedules, marks] = await Promise.all([seasonHeaders(ids), seasonSchedules(ids, now), seenThroughAll(user.id)]);
  const finished: string[] = [];
  let current: string | null = null;
  for (const id of ids) {
    const h = headers.get(id);
    const mark = marks.get(id) ?? 0;
    if (!h || mark < 1) continue;
    const schedule = schedules.get(id);
    const count = h.episodeCount ?? schedule?.episodeCount ?? null;
    const latest = latestAired(schedule, now);
    const over = h.status === "completed" || (!!count && latest >= count);
    const seenAll = mark === EVERYTHING || (count ? mark >= count : latest > 0 && mark >= latest);
    if (over && seenAll) finished.push(id);
    else if (!over) current ??= id;
  }
  // The newest season seen to the end that has anything to ask (someone left it), then the one you're on.
  const out: TriviaSeason[] = [];
  const read = async (id: string, done: boolean): Promise<TriviaSeason> => {
    const f = await seasonFactsFor(user, id, couchId);
    const stats = castStats(f.facts, { seen: f.mark, book: f.book });
    const ways = f.book.blocks.waysOut ?? [];
    const named = (means: string) => ways.filter((w) => w.means === means).map((w) => f.book.aliases?.exits?.[w.id] ?? w.name);
    return {
      seasonId: id,
      label: labelOf(headers.get(id)!),
      finished: done,
      cast: stats.cast.map((c) => ({ name: c.name, photo: c.photo, out: c.out, how: c.how, points: c.points, counts: c.counts })),
      stats: stats.stats.filter((s) => s.key !== "points").map((s) => ({ key: s.key, name: s.name })),
      winners: named("winner"),
      finalists: named("finalist"),
    };
  };
  const asks = (s: TriviaSeason) => s.cast.some((c) => c.out != null);
  for (const id of finished.slice(0, 3)) {
    const s = await read(id, true);
    if (asks(s)) {
      out.push(s);
      break;
    }
  }
  if (current) {
    const s = await read(current, false);
    if (asks(s)) out.push(s);
  }
  return out;
}

/** The show a season is of, refusing what isn't one. */
async function showOf(seasonId: string): Promise<string> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows[0]) throw new HttpError(404, "Season not found");
  return rows[0].show_id as string;
}

/** A couch with someone else on it is the scores' scope; else just you. */
async function scopeOf(user: SessionUser, couchId: string | null): Promise<string | null> {
  if (!couchId) return null;
  await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE couch_id = $1", [couchId]);
  return rows[0].n > 1 ? couchId : null;
}

async function roundFor(user: SessionUser, showId: string, couchId: string | null, now: Date): Promise<TriviaRound> {
  const couch = await scopeOf(user, couchId);
  const week = weekOf(now);
  const subjects = await subjectsOf(user, showId, couchId, now);
  const questions = triviaRound(subjects, `trivia|${showId}|${week}`);
  const [{ rows: mine }, { rows: theirs }] = await Promise.all([
    pool.query("SELECT score, questions, answers FROM trivia_plays WHERE user_id = $1 AND show_id = $2 AND week = $3", [user.id, showId, week]),
    couch
      ? pool.query(
          `SELECT t.user_id, COALESCE(u.username, u.name) AS name, t.score, t.questions FROM trivia_plays t JOIN "user" u ON u.id = t.user_id
            WHERE t.show_id = $1 AND t.week = $2 AND t.user_id <> $3 AND t.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = $4)
            ORDER BY t.score DESC, t.played_at`,
          [showId, week, user.id, couch]
        )
      : Promise.resolve({ rows: [] as { user_id: string; name: string; score: number; questions: number }[] }),
  ]);
  // Named for the season its questions are about (the first of them, as dealt).
  const head = subjects.find((s) => questions.some((q) => q.id.split(":")[1] === s.seasonId)) ?? subjects[0];
  const n = questions.length;
  return {
    showId,
    seasonId: head?.seasonId ?? null,
    title: head ? `${head.label} trivia` : "Trivia",
    line: !n ? "Nothing to ask yet" : `${n === ROUND ? "3" : n} ${n === 1 ? "question" : "questions"} ${head.finished ? "from the real season" : "so far"}`,
    week,
    questions,
    played: mine[0] ? { score: mine[0].score, of: mine[0].questions, answers: mine[0].answers } : null,
    couch: theirs.map((r) => ({ userId: r.user_id, name: r.name, score: r.score, of: r.questions })),
    scope: couch ? "couch" : "solo",
  };
}

/** This week's round on a season's show. */
export async function seasonTrivia(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<TriviaRound> {
  return roundFor(user, await showOf(seasonId), couchId, now);
}

/** Play this week's round: graded against the round as it stands for you; the week's first play is the one kept. */
export async function playTrivia(user: SessionUser, seasonId: string, couchId: string | null, body: { answers?: unknown }, now = new Date()): Promise<TriviaRound> {
  const showId = await showOf(seasonId);
  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new HttpError(400, "answers must be { question: option }");
  const round = await roundFor(user, showId, couchId, now);
  if (!round.questions.length) throw new HttpError(409, "Nothing to ask about yet");
  const kept = Object.fromEntries(round.questions.filter((q) => typeof (answers as Record<string, unknown>)[q.id] === "string").map((q) => [q.id, String((answers as Record<string, unknown>)[q.id]).slice(0, 120)]));
  if (!Object.keys(kept).length) throw new HttpError(400, "Answer at least one question");
  await pool.query(
    `INSERT INTO trivia_plays (user_id, show_id, week, season_id, score, questions, answers) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, show_id, week) DO NOTHING`,
    [user.id, showId, round.week, round.seasonId, scoreRound(round.questions, kept), round.questions.length, JSON.stringify(kept)]
  );
  return roundFor(user, showId, couchId, now);
}

export interface TriviaCard {
  seasonId: string;
  showId: string;
  title: string;
  line: string;
  artUrl: string | null;
  questions: number;
  played: { score: number; of: number } | null;
  best: { name: string; score: number } | null;
}

/** The rounds on your shows (the ones you follow or play), a few at most, with something to ask: for Commercial break and the solo hub. */
export async function myTrivia(user: SessionUser, couchId: string | null, now = new Date()): Promise<TriviaCard[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (ss.show_id) ss.show_id, ss.id AS season_id FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id
      WHERE f.user_id = $1 AND f.following AND f.seen_through > 0
      ORDER BY ss.show_id, ss.season_number DESC`,
    [user.id]
  );
  const headers = await seasonHeaders(rows.map((r) => r.season_id));
  const out: TriviaCard[] = [];
  for (const r of rows.slice(0, 6)) {
    const round = await roundFor(user, r.show_id, couchId, now).catch(() => null);
    if (!round || !round.questions.length || !round.seasonId) continue;
    out.push({
      seasonId: round.seasonId,
      showId: r.show_id,
      title: round.title,
      line: round.line,
      artUrl: headers.get(r.season_id)?.show.artUrl ?? null,
      questions: round.questions.length,
      played: round.played ? { score: round.played.score, of: round.played.of } : null,
      best: round.couch[0] ? { name: round.couch[0].name, score: round.couch[0].score } : null,
    });
    if (out.length >= 3) break;
  }
  return out;
}
