import { castStats } from "@/lib/game/cast-stats";
import { randomFrom, shuffled } from "@/lib/game/seeded";
import { ROUND, scoreRound, triviaRound, weekOf, type ResearchedQuestion, type TriviaQuestion, type TriviaSeason } from "@/lib/game/trivia";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { markSeenToEnd } from "./follows";
import { EVERYTHING, seenThroughAll } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { latestAired, seasonSchedules } from "./schedule";
import { seasonFactsFor } from "./season-stats";
import { seasonHeaders, type SeasonHeader } from "./show-space";

// Trivia (docs/PLAN-new-design.md step 12 part 3; migrations 0130 trivia_plays, 0140 trivia_questions; the questions are trivia.ts's):
//   GET  /api/seasons/[id]/trivia?couch=   the round on the season's show: three questions, your score once you've played, and
//        the couch's scores on it
//   POST /api/seasons/[id]/trivia?couch=   { answers: { [question]: option } }: graded here; the round's first play counts; or
//        { seen: seasonId }: an earlier season of the show, over, that you've seen to the end (step 15 part 3: `past`); or
//        { flag: question }: "This question's wrong" on a researched one (gone for you now; for everyone at two flags, or an admin's)
//   GET  /api/me/trivia?couch=             the rounds on your shows (Commercial break's This week only, the solo hub)
//
// Spoiler-safe on the server: a round is only about a season you've seen to its end once it's over, or the one you're on as far
// as you've seen it (guard.ts seenThroughAll; the facts are the stats' own, season-stats.ts, which never count past your mark).
// Someone else on the couch sees only your score. A new round every Monday, the same for everyone who's seen the same. Read when
// a sheet, row or page opens; nothing polls (docs/HOSTING.md).
//
// Researched questions (db/trivia-research.js: the bot writes a batch a day before each episode, about the one before it and the
// season so far, and a second ask checks them) are asked first, each once you've seen the episode it's about. A batch written in
// the last week about where you are is a round of its own (`round` '<season>:<made_after>', played once), so a show that airs
// most nights has one before each episode; otherwise the week's round asks the researched ones you haven't been asked, and the
// facts' questions fill what's left.

export interface TriviaRound {
  showId: string;
  /** The season the round is named for ("Survivor 49 trivia"), and the line under it. */
  seasonId: string | null;
  title: string;
  line: string;
  week: string;
  /** '' for the week's round; '<season>:<made_after>' for a researched batch's. */
  round: string;
  /** Empty when there's nothing to ask yet (a season you haven't seen enough of). */
  questions: TriviaQuestion[];
  /** Your play of this round (the first counts). */
  played: { score: number; of: number; answers: Record<string, string> } | null;
  /** Others on the couch who've played this round, best first: a score each, nothing else. */
  couch: { userId: string; name: string; score: number; of: number }[];
  scope: "couch" | "solo";
  /** Earlier seasons of the show, over and with results here, that you haven't marked seen to the end (newest first, a few):
   *  Seen it all marks one, and trivia can ask about it (step 15 part 3, from Noticed). Not one you play. */
  past: { seasonId: string; label: string; episodes: number }[];
}

const labelOf = (h: SeasonHeader) => `${h.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;

/** A season researched questions can be about, and the last episode of it you've seen (Infinity: all of it). */
interface Subject {
  season: TriviaSeason;
  through: number;
}

/**
 * What the round can ask about on a show, for this viewer: its newest season over and seen to the end, and the one they're on.
 * `seasons` for the facts' questions (someone's left them); `subjects` for researched ones, the one you're on first.
 */
async function subjectsOf(user: SessionUser, showId: string, couchId: string | null, now: Date): Promise<{ seasons: TriviaSeason[]; subjects: Subject[] }> {
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
  const subjects: Subject[] = [];
  const asks = (s: TriviaSeason) => s.cast.some((c) => c.out != null);
  for (const id of finished.slice(0, 3)) {
    const s = await read(id, true);
    if (asks(s)) {
      out.push(s);
      subjects.push({ season: s, through: Number.POSITIVE_INFINITY });
      break;
    }
  }
  if (current) {
    const s = await read(current, false);
    if (asks(s)) out.push(s);
    const mark = marks.get(current) ?? 0;
    subjects.unshift({ season: s, through: mark === EVERYTHING ? Number.POSITIVE_INFINITY : mark });
  }
  return { seasons: out, subjects };
}

/** A researched batch this new is a round of its own; an older one's questions go in the week's round. */
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

type Researched = ResearchedQuestion & { createdAt: number };
type Batch = { seasonId: string; madeAfter: number };

/** The researched questions you may be asked on these seasons: live, about an episode you've seen, not pulled (two flags, or
 *  an admin's) and not flagged by you (`yours`: kept, to grade the round you flagged one in). */
async function researchedFor(user: SessionUser, subjects: Subject[], yours = false): Promise<Researched[]> {
  if (!subjects.length) return [];
  const { rows } = await pool.query(
    `SELECT q.id, q.season_id, q.made_after, q.episode, q.kind, q.question, q.options, q.answer, q.why, q.source, q.created_at
       FROM trivia_questions q
      WHERE q.season_id = ANY($1::uuid[]) AND q.status = 'live'
        AND ($3 OR NOT EXISTS (SELECT 1 FROM trivia_flags f WHERE f.question_id = q.id AND f.user_id = $2))
        AND NOT EXISTS (SELECT 1 FROM trivia_flags f JOIN "user" u ON u.id = f.user_id WHERE f.question_id = q.id AND u.role = 'admin')
        AND (SELECT count(*) FROM trivia_flags f WHERE f.question_id = q.id) < 2`,
    [subjects.map((p) => p.season.seasonId), user.id, yours]
  );
  const through = new Map(subjects.map((p) => [p.season.seasonId, p.through]));
  return rows
    .filter((r) => r.episode <= (through.get(r.season_id) ?? 0))
    .map((r) => ({
      id: r.id,
      seasonId: r.season_id,
      madeAfter: r.made_after,
      episode: r.episode,
      kind: r.kind,
      question: r.question,
      options: r.options,
      answer: r.answer,
      why: r.why,
      source: r.source,
      createdAt: new Date(r.created_at).getTime(),
    }));
}

/** Which round this is: the newest batch written in the last week about where you are (the season you're on first); null for
 *  the week's. */
function batchOf(list: Researched[], subjects: Subject[], now: Date): Batch | null {
  for (const p of subjects) {
    const fresh = list.filter((q) => q.seasonId === p.season.seasonId && q.madeAfter <= p.through && now.getTime() - q.createdAt < FRESH_MS);
    if (fresh.length) return { seasonId: p.season.seasonId, madeAfter: Math.max(...fresh.map((q) => q.madeAfter)) };
  }
  return null;
}

/**
 * The researched questions in the order a round asks them: its batch's (a batch's round), then the rest, the season you're on
 * first, newest batch first (one written after an episode you haven't seen yet, of its questions about ones you have, last). Each
 * batch in its own seeded order; never one you were asked in another round.
 */
function inOrder(list: Researched[], subjects: Subject[], batch: Batch | null, askedBefore: Set<string>, seed: string): ResearchedQuestion[] {
  const next = randomFrom(seed);
  const at = (q: Researched) => subjects.findIndex((p) => p.season.seasonId === q.seasonId);
  const rank = (q: Researched) => [
    batch && q.seasonId === batch.seasonId && q.madeAfter === batch.madeAfter ? 0 : 1,
    at(q),
    q.madeAfter <= subjects[at(q)].through ? 0 : 1,
    -q.madeAfter,
  ];
  const groups = new Map<string, Researched[]>();
  for (const q of list) {
    if (askedBefore.has(`r:${q.id}`)) continue;
    const key = `${q.seasonId}:${q.madeAfter}`;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const byRank = (a: number[], b: number[]) => {
    const i = a.findIndex((x, j) => x !== b[j]);
    return i < 0 ? 0 : a[i] - b[i];
  };
  return [...groups.values()]
    .sort((a, b) => byRank(rank(a[0]), rank(b[0])))
    .flatMap((g) => shuffled(g, next));
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

/** What Seen it all can mark on a show: its seasons that are over, with results here, not seen to the end, not played. */
async function pastOf(user: SessionUser, showId: string): Promise<TriviaRound["past"]> {
  const [{ rows }, marks] = await Promise.all([
    pool.query(
      `SELECT x.id, x.episode_count FROM show_seasons x
        WHERE x.show_id = $1 AND x.status = 'completed' AND x.episode_count > 0
          AND EXISTS (SELECT 1 FROM season_decisions d WHERE d.season_id = x.id AND d.status = 'accepted' AND d.kind = 'elimination')
          AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN} WHERE m.user_id = $2 AND ss.id = x.id)
        ORDER BY x.season_number DESC NULLS LAST`,
      [showId, user.id]
    ),
    seenThroughAll(user.id),
  ]);
  const open = rows.filter((r) => {
    const mark = marks.get(r.id) ?? 0;
    return mark !== EVERYTHING && mark < r.episode_count;
  });
  const headers = await seasonHeaders(open.slice(0, 3).map((r) => r.id as string));
  return open
    .slice(0, 3)
    .flatMap((r) => (headers.get(r.id) ? [{ seasonId: r.id as string, label: labelOf(headers.get(r.id)!), episodes: r.episode_count as number }] : []));
}

// A play of this round: a batch's whatever week it was played in, the week's in this week. ($3 the week, $4 the round.)
const THIS_ROUND = "(($4 <> '' AND t.round = $4) OR ($4 = '' AND t.round = '' AND t.week = $3))";

/** `grading`: the round as it was dealt, with any question you flagged while playing it (it still counts this time). */
async function roundFor(user: SessionUser, showId: string, couchId: string | null, now: Date, grading = false): Promise<TriviaRound> {
  const couch = await scopeOf(user, couchId);
  const week = weekOf(now);
  const [{ seasons, subjects }, past] = await Promise.all([subjectsOf(user, showId, couchId, now), pastOf(user, showId)]);
  const researched = await researchedFor(user, subjects, grading);
  const batch = batchOf(researched, subjects, now);
  const round = batch ? `${batch.seasonId}:${batch.madeAfter}` : "";
  const [{ rows: plays }, { rows: theirs }] = await Promise.all([
    pool.query(`SELECT t.score, t.questions, t.answers, ${THIS_ROUND} AS here FROM trivia_plays t WHERE t.user_id = $1 AND t.show_id = $2`, [user.id, showId, week, round]),
    couch
      ? pool.query(
          `SELECT t.user_id, COALESCE(u.username, u.name) AS name, t.score, t.questions FROM trivia_plays t JOIN "user" u ON u.id = t.user_id
            WHERE t.show_id = $1 AND ${THIS_ROUND} AND t.user_id <> $2 AND t.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = $5)
            ORDER BY t.score DESC, t.played_at`,
          [showId, user.id, week, round, couch]
        )
      : Promise.resolve({ rows: [] as { user_id: string; name: string; score: number; questions: number }[] }),
  ]);
  const mine = plays.filter((r) => r.here);
  // A researched question is asked once: never again in a later round.
  const askedBefore = new Set(plays.filter((r) => !r.here).flatMap((r) => Object.keys(r.answers ?? {})));
  const seed = `trivia|${showId}|${round || week}`;
  const questions = triviaRound(seasons, seed, ROUND, inOrder(researched, subjects, batch, askedBefore, seed));
  // Named for the season its questions are about (the first of them, as dealt).
  const all = [...subjects.map((p) => p.season), ...seasons];
  const head = all.find((s) => s.seasonId === questions[0]?.seasonId) ?? seasons[0] ?? subjects[0]?.season;
  const n = questions.length;
  const count = `${n} ${n === 1 ? "question" : "questions"}`;
  const line = !n
    ? "Nothing to ask yet"
    : batch
      ? `${count} on episode ${batch.madeAfter}${batch.madeAfter > 1 ? " and the season so far" : ""}`
      : questions.some((q) => q.id.startsWith("r:"))
        ? `${count} from the episodes you've seen`
        : `${count} ${head?.finished ? "from the real season" : "so far"}`;
  return {
    showId,
    seasonId: head?.seasonId ?? null,
    title: head ? `${head.label} trivia` : "Trivia",
    line,
    week,
    round,
    questions,
    played: mine[0] ? { score: mine[0].score, of: mine[0].questions, answers: mine[0].answers } : null,
    couch: theirs.map((r) => ({ userId: r.user_id, name: r.name, score: r.score, of: r.questions })),
    scope: couch ? "couch" : "solo",
    past,
  };
}

/** The round on a season's show. */
export async function seasonTrivia(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<TriviaRound> {
  return roundFor(user, await showOf(seasonId), couchId, now);
}

/** Seen it all: an earlier season of this show, over, marked seen to the end (follows.ts markSeenToEnd); answers the round again. */
export async function seenAllOf(user: SessionUser, seasonId: string, couchId: string | null, seen: unknown, now = new Date()): Promise<TriviaRound> {
  const showId = await showOf(seasonId);
  if (typeof seen !== "string" || (await showOf(seen).catch(() => null)) !== showId) throw new HttpError(400, "seen must be a season of this show");
  await markSeenToEnd(user.id, seen);
  return roundFor(user, showId, couchId, now);
}

/**
 * Play the round: graded against the round as it stands for you, or as it was dealt if you flagged a question in it while
 * playing (whichever has the questions answered); the round's first play is the one kept.
 */
export async function playTrivia(user: SessionUser, seasonId: string, couchId: string | null, body: { answers?: unknown }, now = new Date()): Promise<TriviaRound> {
  const showId = await showOf(seasonId);
  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new HttpError(400, "answers must be { question: option }");
  const [shown, dealt] = await Promise.all([roundFor(user, showId, couchId, now), roundFor(user, showId, couchId, now, true)]);
  const fits = (r: TriviaRound) => r.questions.filter((q) => typeof (answers as Record<string, unknown>)[q.id] === "string").length;
  const round = fits(dealt) > fits(shown) ? dealt : shown;
  if (!round.questions.length) throw new HttpError(409, "Nothing to ask about yet");
  // A batch's round played in an earlier week is still played.
  if (round.played) return shown;
  const kept = Object.fromEntries(round.questions.filter((q) => typeof (answers as Record<string, unknown>)[q.id] === "string").map((q) => [q.id, String((answers as Record<string, unknown>)[q.id]).slice(0, 120)]));
  if (!Object.keys(kept).length) throw new HttpError(400, "Answer at least one question");
  await pool.query(
    `INSERT INTO trivia_plays (user_id, show_id, week, round, season_id, score, questions, answers) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, show_id, week, round) DO NOTHING`,
    [user.id, showId, round.week, round.round, round.seasonId, scoreRound(round.questions, kept), round.questions.length, JSON.stringify(kept)]
  );
  return roundFor(user, showId, couchId, now);
}

/** "This question's wrong", on a researched question ("r:<id>") of this show: it's gone from your rounds now, and from everyone's
 *  once two people have said so (or an admin has). */
export async function flagTrivia(user: SessionUser, seasonId: string, question: unknown): Promise<{ ok: true }> {
  const showId = await showOf(seasonId);
  const id = typeof question === "string" && question.startsWith("r:") ? question.slice(2) : "";
  if (!isUuid(id)) throw new HttpError(400, "Only a researched question can be flagged");
  const { rowCount } = await pool.query(
    `INSERT INTO trivia_flags (question_id, user_id)
     SELECT q.id, $2 FROM trivia_questions q JOIN show_seasons ss ON ss.id = q.season_id WHERE q.id = $1 AND ss.show_id = $3
     ON CONFLICT DO NOTHING`,
    [id, user.id, showId]
  );
  if (rowCount === 0) {
    const { rows } = await pool.query("SELECT 1 FROM trivia_flags WHERE question_id = $1 AND user_id = $2", [id, user.id]);
    if (!rows.length) throw new HttpError(404, "No such question");
  }
  return { ok: true };
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
