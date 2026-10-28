import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { AnswerFacts, Question, SpecContext, Verdict } from "@/lib/game/game-spec/index.js";
import { momentsFor } from "@/lib/game/formats/rulebook-moments.js";
import { kindOf } from "@/lib/game/formats/rulebook-schema.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import type { LeagueState } from "@/lib/game/types";
import { publicMediaSrc } from "@/lib/game/selectors";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool, withLeagueLock } from "./db";
import { seasonSchedules, type SeasonSchedule } from "./schedule";
import { finaleEpisode, storedAnswers, viewOf } from "./answer-points";
import { seasonBook } from "./calls";
import { gamesHere, type GameHere } from "./season-games";

// A game's questions (docs/PLAN-start-a-game-gpt.md step A4; migration 0200 game_answers):
//   GET  /api/seasons/[id]/answers?league=&episode=   the game's questions as you may see them: this week's (asked each
//        episode) and the game's own (asked once), yours, how many have answered; once one locks, everyone's answers, and how
//        it stands as far as you've seen
//   POST /api/seasons/[id]/answers?league=            { episode?, answers: { [question]: answer | null } } before each locks
// The tables' points are answer-points.ts's (leagueAnswers, answerStanding).
//
// The questions are the game's spec's `ask` (StateLogic.AnswerLogic): a game of questions' own, whose answers live in
// game_answers, and a draft's finale predictions, whose answers stay in its state (state.finalePredictions, where classic's
// finale panel writes them). Weekly Calls' are Call it's (calls.ts). A question locks as a lineup does, at the start of the
// episode that closes it (closedForPlay: whoever runs the game can keep it open or lock it early), once it has results or
// data has settled it; finale predictions when the season's last episode starts. Nobody else's answer leaves the server
// before then, only how many have answered. Graded on read from the league's results at your mark (the spoiler guard's view
// of the state, as every table is), never stored. Nothing polls (docs/HOSTING.md).

export interface QuestionFace {
  id: string;
  name: string;
  photo: string | null;
}

export interface QuestionPerson {
  playerId: string;
  name: string;
  you: boolean;
  answer: unknown;
  /** Null while it's still to be settled (as far as you've seen). */
  right: boolean | null;
  earned: number;
}

export interface QuestionView {
  id: string;
  ask: string;
  answer: Question["answer"];
  points: number;
  asked: "once" | "each";
  closes: "start" | "finale";
  pick: number | null;
  from: "cast" | "team" | null;
  line: number | null;
  options: string[] | null;
  /** The episode it's answered for (asked each), or null (the game's own). */
  episode: number | null;
  /** open: yours to answer; behind: see Episode `catchUp` first (it says who's still in); closed: locked. */
  status: "open" | "behind" | "closed";
  catchUp: number | null;
  /** When it locks (the closing episode's air time), when that's known. */
  closesAt: string | null;
  /** Who a person answer can name: who's still in as far as you've seen (or, from your own team, yours). */
  faces: QuestionFace[] | null;
  mine: unknown;
  /** How many have answered: a count, nobody named. */
  answered: number;
  /** Once it's closed: how it stands as far as you've seen (still to settle, off, or what was right). */
  verdict: Verdict | null;
  /** Once it's closed: everyone's answers, you first, and how each did as far as you've seen. */
  people: QuestionPerson[];
}

export interface GameQuestions {
  leagueId: string;
  /** The episode this week's questions are for (the one lineups and picks are for), or null. */
  episode: number | null;
  questions: QuestionView[];
  /** Your points from them so far, as far as you've seen. */
  points: number;
}


/** Whether a question's answers are a draft's finale predictions (kept in its state), not game_answers'. A game has one
 *  kind or the other, never both: finale predictions are a draft's, a game of questions holds nothing. */
const inState = (state: LeagueState, q: Question) => !!StateLogic.finaleOfGame(state) && (q.id === "top3" || q.id === "winner");

/** The questions answered here: the spec's, less Weekly Calls' (Call it's, calls.ts). */
const questionsOf = (state: LeagueState): Question[] => StateLogic.AnswerLogic.questions(state).filter((q) => !Spec.isCalls(q));

/** Who a person answer can name, as the viewer sees it: who's still in (from your own team, yours). */
function facesFor(view: LeagueState, q: Question, playerId: string): QuestionFace[] {
  const team = q.from === "team" ? new Set(StateLogic.Core.ownedCastawayIds(view, playerId)) : null;
  return view.castaways
    .filter((c) => c.status !== "eliminated" && (!team || team.has(c.id)))
    .map((c) => ({ id: c.id, name: c.name, photo: publicMediaSrc(c.photoUrl) }));
}

/** One of your games on a season, by league: 404 when you don't play it. */
async function gameHere(user: SessionUser, seasonId: string, leagueId: unknown): Promise<GameHere> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (typeof leagueId !== "string" || !isUuid(leagueId)) throw new HttpError(400, "Which game?");
  const { here } = await gamesHere(user, seasonId, null, leagueId);
  const h = here.find((x) => x.game.leagueId === leagueId);
  if (!h) throw new HttpError(404, "Game not found");
  return h;
}

interface Read {
  h: GameHere;
  view: LeagueState;
  facts: AnswerFacts;
  schedule: SeasonSchedule | undefined;
  finale: { number: number; airAt: string | null } | null;
  now: Date;
}

async function readOf(user: SessionUser, seasonId: string, leagueId: unknown, now: Date): Promise<Read> {
  const h = await gameHere(user, seasonId, leagueId);
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  const view = viewOf(h);
  return { h, view, facts: StateLogic.AnswerLogic.facts(view), schedule, finale: finaleEpisode(schedule), now };
}

/** The episode whose start closes a question, and its air time (the league's, else the schedule's). */
function closing(r: Read, q: Question, episode: number): { at: number | null; airAt: string | null } {
  const at = StateLogic.AnswerLogic.closesAt(r.h.state, q, episode, r.finale?.number ?? null);
  if (at === null) return { at, airAt: null };
  const ep = r.h.state.episodes.find((e) => e.number === at);
  return { at, airAt: ep?.airsAt ?? r.schedule?.episodes.find((e) => e.number === at)?.airAt ?? null };
}

/** Whether a question is closed for an episode (the full state's lock: StateLogic.AnswerLogic.closed). */
function isClosed(r: Read, q: Question, episode: number): boolean {
  const { airAt } = closing(r, q, episode);
  return StateLogic.AnswerLogic.closed(r.h.state, q, episode, { now: r.now.getTime(), finale: r.finale?.number ?? null, airAt });
}

/** The episode before the one a person answer needs to have been seen (who's still in), or null when nothing is needed. */
function needsSeen(r: Read, q: Question, episode: number): number | null {
  if (q.answer !== "person" || q.closes === "finale") return null;
  const at = q.asked === "each" ? episode : StateLogic.startEpisode(r.h.state);
  return at === null || at <= 1 ? null : at - 1;
}

/** A game's questions as you may see them. `episodeIn`: a past episode's (for how it went), else this week's. */
export async function gameQuestions(user: SessionUser, seasonId: string, leagueId: unknown, episodeIn?: unknown, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  return readQuestions(r, episodeIn);
}

async function readQuestions(r: Read, episodeIn?: unknown): Promise<GameQuestions> {
  const { h, view, facts } = r;
  const me = h.playerId;
  const qs = questionsOf(h.state);
  // This week's is the game's (the league's own state), not where you are: someone behind sees it as behind, not an
  // earlier episode that's long locked.
  const thisWeek = StateLogic.AnswerLogic.episodeNow(h.state);
  let episode = thisWeek;
  if (episodeIn !== undefined && episodeIn !== null && episodeIn !== "") {
    const n = Number(episodeIn);
    if (!Number.isInteger(n) || n < 1 || !StateLogic.inPlay(h.state, n)) throw new HttpError(400, "Which episode?");
    episode = n;
  }
  // Only the players your copy of the league has: a late joiner you can't see (viewFor takes them out) isn't counted,
  // listed or graded.
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const all = [...(await storedAnswers(h.game.leagueId)), ...StateLogic.AnswerLogic.finaleAnswers(h.state)].filter((a) => names.has(a.playerId));
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  const graded = StateLogic.AnswerLogic.grade(view, all, facts);
  const out: QuestionView[] = [];
  let points = 0;
  for (const [pid, n] of graded.points) if (pid === me) points += n;
  for (const q of qs) {
    const each = q.asked === "each";
    if (each && episode === null) continue;
    const ep = each ? (episode as number) : 0;
    const mine = all.find((a) => a.playerId === me && a.question === q.id && a.episode === ep)?.answer ?? null;
    const theirs = all.filter((a) => a.question === q.id && a.episode === ep);
    const closed = isClosed(r, q, ep);
    const { airAt } = closing(r, q, ep);
    const seen = needsSeen(r, q, ep);
    const behind = !closed && seen !== null && mark < seen;
    const view1: QuestionView = {
      id: q.id,
      ask: q.ask,
      answer: q.answer,
      points: q.points,
      asked: q.asked,
      closes: q.closes,
      pick: q.answer === "person" ? (q.pick ?? 1) : null,
      from: q.answer === "person" ? (q.from ?? "cast") : null,
      line: typeof q.line === "number" ? q.line : null,
      options: q.options ?? null,
      episode: each ? ep : null,
      status: closed ? "closed" : behind ? "behind" : "open",
      catchUp: behind ? seen : null,
      closesAt: airAt,
      faces: q.answer === "person" && !behind ? facesFor(view, q, me) : null,
      mine,
      answered: new Set(theirs.map((a) => a.playerId)).size,
      verdict: null,
      people: [],
    };
    if (closed) {
      // Locked: everyone's answers, and how each stands as far as you've seen (the view is cut at your mark).
      const v = graded.verdicts.get(`${q.id}|${ep}`) ?? Spec.verdictOf(q, ep, facts);
      view1.verdict = v;
      const list = theirs.map((a) => ({ playerId: a.playerId, answer: a.answer }));
      const earned = Spec.pointsFor(q, v, list, facts);
      view1.people = theirs
        .map((a) => ({
          playerId: a.playerId,
          name: names.get(a.playerId) ?? "Someone",
          you: a.playerId === me,
          answer: a.answer,
          right: Spec.isRight(q, v, { playerId: a.playerId, answer: a.answer }, list, facts),
          earned: earned.get(a.playerId) ?? 0,
        }))
        .sort((x, y) => Number(y.you) - Number(x.you) || y.earned - x.earned || x.name.localeCompare(y.name));
    }
    out.push(view1);
  }
  return { leagueId: h.game.leagueId, episode, questions: out, points };
}

/** Answer, change or take back your answers before each question locks. */
export async function answerQuestions(user: SessionUser, seasonId: string, leagueId: unknown, body: { episode?: unknown; answers?: unknown }, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  const { h, view } = r;
  const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!isMap(body.answers)) throw new HttpError(400, "answers must be { question: answer }");
  if (StateLogic.GhostLogic.isCatchingUp(h.state, h.playerId)) throw new HttpError(409, "Catch up first: questions open once you're on the live episode");
  const qs = questionsOf(h.state);
  const thisWeek = StateLogic.AnswerLogic.episodeNow(h.state);
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  const writes: { q: Question; ep: number; value: unknown }[] = [];
  for (const [key, value] of Object.entries(body.answers)) {
    const q = qs.find((x) => x.id === key);
    if (!q) throw new HttpError(400, `"${key}" isn't one of this game's questions`);
    let ep = 0;
    if (q.asked === "each") {
      const asked = body.episode === undefined || body.episode === null ? thisWeek : Number(body.episode);
      if (thisWeek === null || asked !== thisWeek) throw new HttpError(409, thisWeek === null ? "There's nothing to answer for yet" : `Answers are open for Episode ${thisWeek}`);
      ep = thisWeek;
    }
    if (isClosed(r, q, ep)) {
      const { at } = closing(r, q, ep);
      throw new HttpError(409, at === null ? `"${q.ask}" is closed` : `"${q.ask}" closed when Episode ${at} started`);
    }
    if (value !== null) {
      const seen = needsSeen(r, q, ep);
      if (seen !== null && mark < seen) throw new HttpError(403, `See Episode ${seen} first: it says who's still in`);
      const faces = q.answer === "person" ? new Set(facesFor(view, q, h.playerId).map((f) => f.id)) : null;
      const problem = Spec.answerProblem(q, value, faces);
      if (problem) throw new HttpError(400, problem);
    }
    writes.push({ q, ep, value: q.answer === "person" && Array.isArray(value) && (q.pick ?? 1) === 1 ? value[0] : value });
  }
  const stateWrites = writes.filter((w) => inState(h.state, w.q));
  if (stateWrites.length) {
    await withLeagueLock(h.game.leagueId, (s) => {
      for (const w of stateWrites) {
        // The lock again, under the league's own lock (the stamped state).
        if (StateLogic.AnswerLogic.closed(s, w.q, 0, { now: now.getTime(), finale: r.finale?.number ?? null, airAt: r.finale?.airAt ?? null })) throw new HttpError(409, `"${w.q.ask}" is closed`);
        if (w.q.id === "winner") StateLogic.setFinaleWinnerPick(s, h.playerId, (w.value as string | null) ?? null);
        else {
          const list = Array.isArray(w.value) ? (w.value as string[]) : w.value ? [w.value as string] : [];
          for (let i = 0; i < 3; i++) StateLogic.setFinalePick(s, h.playerId, i, null);
          list.forEach((id, i) => StateLogic.setFinalePick(s, h.playerId, i, id));
        }
      }
    });
  }
  // A game of questions' answers, all or none, the lock checked again at the moment they're written.
  const rows = writes.filter((x) => !inState(h.state, x.q));
  if (rows.length) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const w of rows) {
        if (w.value === null) {
          await client.query("DELETE FROM game_answers WHERE league_id = $1 AND player_id = $2 AND question = $3 AND episode = $4", [h.game.leagueId, h.playerId, w.q.id, w.ep]);
          continue;
        }
        await client.query(
          `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (league_id, player_id, question, episode) DO UPDATE SET answer = EXCLUDED.answer, answered_by = EXCLUDED.answered_by, updated_at = now()`,
          [h.game.leagueId, h.playerId, w.q.id, w.ep, JSON.stringify(w.value), user.id]
        );
      }
      const late = rows.find((w) => isClosed({ ...r, now: new Date() }, w.q, w.ep));
      if (late) throw new HttpError(409, `"${late.q.ask}" closed as it was answered`);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  return readQuestions(stateWrites.length ? await readOf(user, seasonId, leagueId, now) : r);
}

/**
 * What the data-can-settle rule checks a game's own questions against (game-spec specProblems' ctx, for RosterLogic.setGame):
 * the moments of the rules the game plays by (its couch's own copy, else the season's), by the ids its results record (a
 * built-in's aliases), and who answers each; whether the results say who goes home (a series' and a talk show's don't),
 * whether anyone wins, who settles the show's calls, and its phases.
 */
export async function questionContext(leagueId: string, seasonId: string): Promise<SpecContext> {
  const { rows } = await pool.query("SELECT r.blocks, r.aliases FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id = $1 AND r.status <> 'archived'", [leagueId]);
  // The couch's own copy (Make it ours), else the season's rulebook, else its show's format read back as blocks (with a
  // built-in's aliases): calls.ts seasonBook.
  const book = rows[0]?.blocks ? { blocks: rows[0].blocks as RulebookBlocks, aliases: rows[0].aliases } : await seasonBook(seasonId);
  const blocks = book.blocks;
  const aliases = book.aliases as { events?: Record<string, string> } | null | undefined;
  const kind = kindOf(blocks);
  return {
    moments: momentsFor(blocks).map((m) => ({ id: aliases?.events?.[m.id] ?? m.id, label: m.label, defaultPoints: m.defaultPoints, answeredBy: m.answeredBy, auto: !!m.auto, off: !!m.off })),
    results: kind !== "series" && kind !== "talk",
    winner: (blocks.waysOut ?? []).some((w) => w.means === "winner"),
    calls: kind === "talk" ? "couch" : "results",
    phases: (blocks.season?.phases ?? []).map((p) => ({ id: p.id, name: p.name })),
  };
}
