import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { AnswerFacts, FormatGroups, Question, SpecContext, Verdict } from "@/lib/game/game-spec/index.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import type { LeagueState } from "@/lib/game/types";
import type { CallBook } from "@/lib/game/calls";
import { contextOf } from "@/lib/game/question-choices";
import type { SheetMove } from "@/lib/game/game-view";
import { publicMediaSrc } from "@/lib/game/selectors";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool, withLeagueLock } from "./db";
import { seasonSchedules, type SeasonSchedule } from "./schedule";
import { answerFacts, finaleEpisode, readsTimeline, storedAnswers, viewOf, type AnswerRow } from "./answer-points";
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
  /** Their account, for their face (null: a seat with none). */
  userId: string | null;
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
  /** What settles it (the results' who went home or won, a moment): the screen's words for what was right. */
  settle: Question["settle"];
  points: number;
  asked: Question["asked"];
  closes: "start" | "finale";
  pick: number | null;
  from: "cast" | "team" | null;
  line: number | null;
  options: string[] | null;
  /** A8: an order's places off that still score; chips to spread; a wager's most stake; who outlasts whom, the pairs (each its
   *  key and two faces, answered { key: castawayId }). */
  within: number | null;
  chips: number | null;
  /** A9: "total", any of your points (`stakeMost` is how many that is for you now). */
  wager: number | "total" | null;
  pairs: { key: string; faces: [QuestionFace, QuestionFace] }[] | null;
  /** A9: how its points combine. share: split (a pot split between everyone right) or only (only the only right one scores);
   *  rollover: a window nobody earns anything on carries its points into the next (`jackpot`: what's carried into this one, once
   *  the windows before it are settled as far as you've seen); shrink: a call whose points shrink with each episode that's
   *  started when it's made, or each change once the game's on (`worth`: what yours is worth, or one made now). */
  share: "split" | "only" | null;
  rollover: boolean;
  jackpot: number | null;
  shrink: { points: number; per: "episode" | "change" } | null;
  worth: number | null;
  stakeMost: number | null;
  /** "person": asked about each person still in (A6), answered { castawayId: answer } for any of `faces`. */
  each: "person" | null;
  /** The episode it's answered for (asked each), or null (the game's own). */
  episode: number | null;
  /** open: yours to answer; behind: see Episode `catchUp` first (it says who's still in), or catch up on the game first (null);
   *  closed: locked. */
  status: "open" | "behind" | "closed";
  catchUp: number | null;
  /** When it locks (the closing episode's air time), when that's known. */
  closesAt: string | null;
  /** Who a person answer can name: who's still in as far as you've seen (or, from your own team, yours); a group answer, the groups
   *  someone still in is on; a question about each person, who it asks about. */
  faces: QuestionFace[] | null;
  /** F3 part 2: why a group question has nothing to pick this episode on a season played in pairs (who is with whom going in
   *  isn't sure, or nobody is in a group): it doesn't count either way. Null otherwise. */
  offWhy: string | null;
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
  /** Every castaway by id, name and face (no status: who's still in is `faces`), for the answers and what was right. */
  cast: QuestionFace[];
  /** Every group (tribe, team) by id and name, for a group answer's answers and what was right (A6). */
  groups: QuestionFace[];
  /** Where you are (the last episode you've seen), or null when you see results as they come: a locked question past it says
   *  "once you've seen it", not "waiting". */
  mark: number | null;
}


/** Whether a question's answers are a draft's finale predictions (kept in its state), not game_answers'. A game has one
 *  kind or the other, never both: finale predictions are a draft's, a game of questions holds nothing. */
const inState = (state: LeagueState, q: Question) => !!StateLogic.finaleOfGame(state) && (q.id === "top3" || q.id === "winner");

/** The questions answered here: the spec's, less Weekly Calls' (Call it's, calls.ts). */
const questionsOf = (state: LeagueState): Question[] => StateLogic.AnswerLogic.questions(state).filter((q) => !Spec.isCalls(q));

/** Whether a question's answers name someone still in, or ask about each of them (A6): what you can answer depends on who's still in
 *  (and on what group), so it waits until you've seen the episode before it. */
const namesSomeone = (q: Question) => Spec.NAMES.includes(q.answer) || Spec.RANKS.includes(q.answer) || q.answer === "chips" || q.answer === "pairs" || !!q.each;

/** A pairs question's pairs (step A8): drawn from who was in at the game's start (AnswerLogic.startIn, as the grader draws them),
 *  the same every time, each with its key (its answers' { "a|b": who }). */
function pairsOf(state: LeagueState, q: Question): { key: string; ids: [string, string] }[] {
  return Spec.pairsFrom(q, StateLogic.AnswerLogic.startIn(state)).map((ids) => ({ key: Spec.pairKey(ids), ids }));
}

/** Who a person answer can name, as the viewer sees it: who's still in (from your own team, yours); for a group answer (A6), the
 *  groups someone still in is on (after any swap you've seen, never one you haven't; `fg`, F3 part 2: on a season played in
 *  pairs, the format's state over time's groups going into the episode); for a question about each person, each of those still in. */
function facesFor(view: LeagueState, q: Question, playerId: string, fg?: FormatGroups | null): QuestionFace[] {
  const stillIn = view.castaways.filter((c) => c.status !== "eliminated");
  // F3 part 2: on a season played in groups the league doesn't hold (pairs), the groups going into the lock, from the format's
  // state over time ("Ann & Bea"); none when that isn't sure, unless the question follows the people (carry-on).
  if (fg && readsTimeline(q)) return fg.lockSure || q.fallback === "carry-on" ? fg.offered.map((g) => ({ id: g.id, name: g.name, photo: null })) : [];
  if (q.answer === "group" && !q.each) {
    const on = new Set(stillIn.map((c) => c.tribeId).filter((t): t is string => !!t));
    return (view.tribes ?? []).filter((t) => on.has(t.id)).map((t) => ({ id: t.id, name: t.name, photo: null }));
  }
  const team = q.from === "team" && !q.each ? new Set(StateLogic.Core.ownedCastawayIds(view, playerId)) : null;
  return stillIn.filter((c) => !team || team.has(c.id)).map((c) => ({ id: c.id, name: c.name, photo: publicMediaSrc(c.photoUrl) }));
}

/** Why a group question on the timeline's groups (F3 part 2) has nothing to pick at an episode's lock, or null. */
function offWhy(q: Question, fg: FormatGroups | null | undefined): string | null {
  if (!fg || !readsTimeline(q)) return null;
  if (fg.off === "apart") return "Nobody plays in a pair or team in this episode: it doesn't count either way";
  if (fg.off === "unknown") return "Who played with whom in this episode wasn't known going into it: it doesn't count either way";
  if (!fg.lockSure && q.fallback !== "carry-on") return "Who is with whom going into this episode isn't sure: it doesn't count either way";
  if (!fg.offered.length) return "Nobody is in a pair or team going into this episode: it doesn't count either way";
  return null;
}

/** A castaway's face by id, as the viewer's copy has them. */
function castFace(view: LeagueState, id: string): QuestionFace {
  const c = view.castaways.find((x) => x.id === id);
  return { id, name: c?.name ?? "Someone", photo: c ? publicMediaSrc(c.photoUrl) : null };
}

/** One of your games on a season, by league: 404 when you don't play it. */
async function gameHere(user: SessionUser, seasonId: string, leagueId: unknown): Promise<GameHere> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (typeof leagueId !== "string" || !isUuid(leagueId)) throw new HttpError(400, "Which game?");
  const { here } = await gamesHere(user, seasonId, null, null, leagueId);
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
  return readFrom(await gameHere(user, seasonId, leagueId), seasonId, now);
}

/** A game already read (season-games.ts gamesHere) ready for its questions. */
async function readFrom(h: GameHere, seasonId: string, now: Date): Promise<Read> {
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  const view = viewOf(h);
  return { h, view, facts: await answerFacts(h.state, view), schedule, finale: finaleEpisode(schedule), now };
}

/** The episode whose start closes a question, and its air time (the league's, else the schedule's). */
function closing(r: Read, q: Question, episode: number): { at: number | null; airAt: string | null } {
  const at = StateLogic.AnswerLogic.closesAt(r.h.state, q, episode, r.finale?.number ?? null);
  if (at === null) return { at, airAt: null };
  const ep = r.h.state.episodes.find((e) => e.number === at);
  return { at, airAt: ep?.airsAt ?? r.schedule?.episodes.find((e) => e.number === at)?.airAt ?? null };
}

/** Whether a question is closed for an episode (the full state's lock: StateLogic.AnswerLogic.closed), for you: a game with a late
 *  lock (step A7) keeps it open while you haven't seen it. */
function isClosed(r: Read, q: Question, episode: number): boolean {
  const { airAt } = closing(r, q, episode);
  return StateLogic.AnswerLogic.closed(r.h.state, q, episode, { now: r.now.getTime(), finale: r.finale?.number ?? null, airAt, mark: r.h.mark });
}

/** How many of the game's episodes have started now (A9: when an answer is made), the schedule's air time for one the league
 *  hasn't made yet. */
const startedNow = (r: Read) =>
  StateLogic.AnswerLogic.started(r.h.state, { now: r.now.getTime(), airAtOf: (n) => r.schedule?.episodes.find((e) => e.number === n)?.airAt ?? null });

/** What you've staked on wagers of any of your points (A9) still to settle as far as you've seen, by window ("question|episode"):
 *  points that are already on the line, so a new stake of them can't count them again. */
function heldStakes(qs: Question[], answers: AnswerRow[], verdicts: Map<string, Verdict>, me: string): Map<string, number> {
  const held = new Map<string, number>();
  for (const a of answers) {
    const q = qs.find((x) => x.id === a.question);
    if (a.playerId !== me || q?.wager !== Spec.WAGER_TOTAL) continue;
    const key = `${q.id}|${q.asked === "once" ? 0 : a.episode}`;
    const stake = (a.answer as { stake?: unknown } | null)?.stake;
    if (verdicts.get(key)?.state !== "waiting" || !Number.isInteger(stake) || (stake as number) <= 0) continue;
    held.set(key, stake as number);
  }
  return held;
}
/** The most you can stake on a wager of any of your points (A9) in a window (`key`): your points as they stand for you, less what's
 *  on the line in your other wagers of them still to settle (`held`, and `staking`: the ones this answer sends); at least 0. */
function stakeMost(points: number, held: Map<string, number>, key: string, staking?: Map<string, number>): number {
  let most = points;
  for (const [k, n] of held) if (k !== key && !staking?.has(k)) most -= n;
  for (const [k, n] of staking ?? []) if (k !== key) most -= n;
  return Math.max(0, Math.floor(most));
}
/** Your points as they stand for you (at your mark) and your stakes still on the line: what a wager of any of them (A9) can stake. */
async function stakeRoom(r: Read): Promise<{ points: number; held: Map<string, number> }> {
  const all = StateLogic.getLeagueType(r.h.state).hasQuestions ? await storedAnswers(r.h.game.leagueId) : [];
  const graded = StateLogic.AnswerLogic.grade(r.view, all, r.facts);
  return { points: graded.points.get(r.h.playerId) ?? 0, held: heldStakes(questionsOf(r.h.state), all, graded.verdicts, r.h.playerId) };
}

/** The episode you answer for now: this week's (the game's, not where you are), or with a late lock (step A7) the one after
 *  your mark while it's still open for you. */
const weekOf = (r: Read) =>
  StateLogic.AnswerLogic.lateEpisode(r.h.state, r.h.mark, { now: r.now.getTime(), airAtOf: (n) => r.schedule?.episodes.find((e) => e.number === n)?.airAt ?? null });

/** The window a question is answered for at an episode (step A7: its own asked each; the run or phase it's in), or 0 asked once,
 *  or null when it has none there. A phase's window shows once you're up to the episode before it: someone further behind never
 *  learns the phase began. */
const windowFor = (r: Read, q: Question, episode: number | null) => (q.asked === "once" ? 0 : StateLogic.AnswerLogic.windowAt(r.h.state, q, episode, r.h.mark));

/** The episode before the one a person or group answer (or a question about each person) needs to have been seen (who's still in,
 *  and on what group), or null when nothing is needed. */
function needsSeen(r: Read, q: Question, episode: number): number | null {
  if (!namesSomeone(q) || q.closes === "finale") return null;
  const at = q.asked !== "once" ? episode : StateLogic.startEpisode(r.h.state);
  return at === null || at <= 1 ? null : at - 1;
}

/** A game's questions as you may see them. `episodeIn`: a past episode's (for how it went), else this week's. */
export async function gameQuestions(user: SessionUser, seasonId: string, leagueId: unknown, episodeIn?: unknown, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  return readQuestions(r, episodeIn);
}

async function readQuestions(r: Read, episodeIn?: unknown, rows?: AnswerRow[]): Promise<GameQuestions> {
  const { h, view, facts } = r;
  const me = h.playerId;
  const qs = questionsOf(h.state);
  // This week's is the game's (the league's own state), not where you are: someone behind sees it as behind, not an
  // earlier episode that's long locked. With a late lock (A7), the one after your mark while it's open for you.
  const thisWeek = weekOf(r);
  let episode = thisWeek;
  if (episodeIn !== undefined && episodeIn !== null && episodeIn !== "") {
    const n = Number(episodeIn);
    if (!Number.isInteger(n) || n < 1 || !StateLogic.inPlay(h.state, n)) throw new HttpError(400, "Which episode?");
    episode = n;
  }
  // Only the players your copy of the league has: a late joiner you can't see (viewFor takes them out) isn't counted,
  // listed or graded.
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  // A draft's finale predictions are in its state; only a game of questions keeps its answers in game_answers.
  const stored = StateLogic.getLeagueType(h.state).hasQuestions ? (rows ?? (await storedAnswers(h.game.leagueId))) : [];
  const all = [...stored, ...StateLogic.AnswerLogic.finaleAnswers(h.state)].filter((a) => names.has(a.playerId));
  // A late joiner catching up answers nothing until they're on the live episode (answerQuestions refuses it): each open
  // question waits for them, with no episode to see (catchUp null).
  const catching = StateLogic.GhostLogic.isCatchingUp(h.state, me);
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  const graded = StateLogic.AnswerLogic.grade(view, all, facts);
  const out: QuestionView[] = [];
  let points = 0;
  for (const [pid, n] of graded.points) if (pid === me) points += n;
  // A9: your stakes still on the line, and how many of the game's episodes have started (a shrinking call made now).
  const held = heldStakes(qs, stored, graded.verdicts, me);
  const lateNow = startedNow(r);
  for (const q of qs) {
    // Its window this week (A7: asked each, its episode; every few or by phase, the run it's in), or the game's own (0).
    const each = q.asked !== "once";
    const at = windowFor(r, q, episode);
    if (at === null) continue;
    const ep = at;
    const mineRow = all.find((a) => a.playerId === me && a.question === q.id && a.episode === ep);
    const mine = mineRow?.answer ?? null;
    const theirs = all.filter((a) => a.question === q.id && a.episode === ep);
    const closed = isClosed(r, q, ep);
    const { airAt } = closing(r, q, ep);
    const seen = needsSeen(r, q, ep);
    const behind = !closed && (catching || (seen !== null && mark < seen));
    const view1: QuestionView = {
      id: q.id,
      ask: q.ask,
      answer: q.answer,
      settle: q.settle,
      points: q.points,
      asked: q.asked,
      closes: q.closes,
      pick: (Spec.NAMES.includes(q.answer) || Spec.RANKS.includes(q.answer)) && !q.each ? (q.pick ?? 1) : null,
      from: q.answer === "person" && !q.each ? (q.from ?? "cast") : null,
      line: typeof q.line === "number" ? q.line : null,
      options: q.options ?? null,
      within: q.answer === "order" ? (q.within ?? 0) : null,
      chips: q.answer === "chips" ? (q.chips ?? null) : null,
      wager: q.wager ?? null,
      share: q.share ?? null,
      rollover: !!q.rollover,
      jackpot: q.rollover && graded.worth.has(`${q.id}|${ep}`) ? (graded.worth.get(`${q.id}|${ep}`) ?? q.points) - q.points : null,
      shrink: q.shrink ?? null,
      // Yours as it was made; none yet, one made now (made once the game's on, it counts as a change).
      worth: q.shrink ? Spec.shrunk(q, q.points, mineRow && "late" in mineRow ? mineRow : { late: lateNow, changes: lateNow > 0 ? 1 : 0 }) : null,
      stakeMost: q.wager === Spec.WAGER_TOTAL ? stakeMost(points, held, `${q.id}|${ep}`) : null,
      pairs: q.answer === "pairs" && !behind ? pairsOf(h.state, q).map((p) => ({ key: p.key, faces: [castFace(view, p.ids[0]), castFace(view, p.ids[1])] })) : null,
      each: q.each ?? null,
      episode: each ? ep : null,
      status: closed ? "closed" : behind ? "behind" : "open",
      catchUp: behind && !catching ? seen : null,
      closesAt: airAt,
      // A pairs question's faces are its pairs'.
      faces: namesSomeone(q) && q.answer !== "pairs" && !behind ? facesFor(view, q, me, facts.formatGroups?.get(ep)) : null,
      offWhy: !behind ? offWhy(q, facts.formatGroups?.get(ep)) : null,
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
      // What each earned there, A9's ways of combining in (a split pot, a rollover's jackpot, a parlay, a shrinking call).
      const earned = graded.earned.get(`${q.id}|${ep}`) ?? new Map<string, number>();
      view1.people = theirs
        .map((a) => ({
          playerId: a.playerId,
          userId: h.userOf(a.playerId),
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
  const cast = view.castaways.map((c) => ({ id: c.id, name: c.name, photo: publicMediaSrc(c.photoUrl) }));
  // Only the groups your copy has anyone on (where they started, or a swap you've seen): a tribe a later swap or the merge made is
  // in the league's list from the moment it's recorded, and its name would say it happened.
  const onAny = new Set(
    [...view.castaways.flatMap((c) => [c.tribeId, c.startTribeId]), ...view.episodes.flatMap((e) => (e.groups ?? []).map((g) => g.tribeId))].filter((t): t is string => !!t)
  );
  const groups = (view.tribes ?? []).filter((t) => onAny.has(t.id)).map((t) => ({ id: t.id, name: t.name, photo: null }));
  // ...and on a season played in pairs (F3 part 2), every pair offered at a lock you've reached: going into the episode after the
  // last one you've seen, at most.
  const seenUpTo = (h.mark ?? Number.POSITIVE_INFINITY) + 1;
  for (const [n, fg] of facts.formatGroups ?? []) {
    if (n > seenUpTo) continue;
    for (const g of fg.offered) if (!groups.some((x) => x.id === g.id)) groups.push({ id: g.id, name: g.name, photo: null });
  }
  return { leagueId: h.game.leagueId, episode, questions: out, points, cast, groups, mark: h.mark };
}

/** Answer, change or take back your answers before each question locks. */
export async function answerQuestions(user: SessionUser, seasonId: string, leagueId: unknown, body: { episode?: unknown; answers?: unknown }, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  const { h, view } = r;
  const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!isMap(body.answers)) throw new HttpError(400, "answers must be { question: answer }");
  if (StateLogic.GhostLogic.isCatchingUp(h.state, h.playerId)) throw new HttpError(409, "Catch up first: questions open once you're on the live episode");
  const qs = questionsOf(h.state);
  const thisWeek = weekOf(r);
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  // How many of the game's episodes have started (A9: when an answer is made, for a call whose points shrink).
  const late = startedNow(r);
  // Your points as they stand for you and your stakes on the line, for a wager of any of them (A9), read once when one is staked;
  // `staking`, the stakes this answer sends.
  let room: { points: number; held: Map<string, number> } | null = null;
  const staking = new Map<string, number>();
  const writes: { q: Question; ep: number; value: unknown }[] = [];
  for (const [key, value] of Object.entries(body.answers)) {
    const q = qs.find((x) => x.id === key);
    if (!q) throw new HttpError(400, `"${key}" isn't one of this game's questions`);
    let ep = 0;
    if (q.asked !== "once") {
      // Its window this week (A7): an episode named is this week's, or the one its window opens at.
      const at = windowFor(r, q, thisWeek);
      const asked = body.episode === undefined || body.episode === null ? thisWeek : Number(body.episode);
      if (thisWeek === null || at === null || (asked !== thisWeek && asked !== at)) throw new HttpError(409, thisWeek === null || at === null ? "There's nothing to answer for yet" : `Answers are open for Episode ${thisWeek}`);
      ep = at;
    }
    if (isClosed(r, q, ep)) {
      const { at } = closing(r, q, ep);
      throw new HttpError(409, at === null ? `"${q.ask}" is closed` : `"${q.ask}" closed when Episode ${at} started`);
    }
    if (value !== null) {
      const seen = needsSeen(r, q, ep);
      if (seen !== null && mark < seen) throw new HttpError(403, `See Episode ${seen} first: it says who's still in`);
      // Who it can name (still in, your team, a group); for a pairs question, each pair's "index:id" (A8).
      const faces =
        q.answer === "pairs"
          ? new Set(pairsOf(h.state, q).flatMap((p) => p.ids.map((id) => `${p.key}:${id}`)))
          : namesSomeone(q)
            ? new Set(facesFor(view, q, h.playerId, r.facts.formatGroups?.get(ep)).map((f) => f.id))
            : null;
      let most: number | undefined;
      if (q.wager === Spec.WAGER_TOTAL) {
        room ??= await stakeRoom(r);
        most = stakeMost(room.points, room.held, `${q.id}|${ep}`, staking);
      }
      const problem = Spec.answerProblem(q, value, faces, most === undefined ? undefined : { most });
      if (problem) throw new HttpError(400, problem);
      if (q.wager === Spec.WAGER_TOTAL) staking.set(`${q.id}|${ep}`, (value as { stake: number }).stake);
    } else if (q.shrink && late > 0) {
      // Taken back and given again would start it over: once the game's on, a shrinking call is changed, never taken back.
      throw new HttpError(409, `"${q.ask}" can be changed but not taken back once the game is on`);
    }
    const one = Spec.NAMES.includes(q.answer) && !q.each && Array.isArray(value) && (q.pick ?? 1) === 1;
    writes.push({ q, ep, value: one ? (value as unknown[])[0] : value });
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
        // When it was made (A9): a first answer once the game's on counts as a change (sealing it early is the point), and so does
        // each change after, which makes it as late as now; the same answer again doesn't.
        await client.query(
          `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, CASE WHEN $7 > 0 THEN 1 ELSE 0 END)
           ON CONFLICT (league_id, player_id, question, episode) DO UPDATE SET
             changes = game_answers.changes + CASE WHEN game_answers.answer IS DISTINCT FROM EXCLUDED.answer AND EXCLUDED.late > 0 THEN 1 ELSE 0 END,
             late = CASE WHEN game_answers.answer IS DISTINCT FROM EXCLUDED.answer THEN EXCLUDED.late ELSE game_answers.late END,
             answer = EXCLUDED.answer, answered_by = EXCLUDED.answered_by, updated_at = now()`,
          [h.game.leagueId, h.playerId, w.q.id, w.ep, JSON.stringify(w.value), user.id, late]
        );
      }
      const shut = rows.find((w) => isClosed({ ...r, now: new Date() }, w.q, w.ep));
      if (shut) throw new HttpError(409, `"${shut.q.ask}" closed as it was answered`);
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
  return contextOf(await leagueBook(leagueId, seasonId));
}

/** The rules a game plays by: the couch's own copy (Make it ours), else the season's rulebook, else its show's format read back
 *  as blocks (with a built-in's aliases): calls.ts seasonBook. */
export async function leagueBook(leagueId: string, seasonId: string): Promise<CallBook> {
  const { rows } = await pool.query("SELECT r.blocks, r.aliases FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id = $1 AND r.status <> 'archived'", [leagueId]);
  return rows[0]?.blocks ? { blocks: rows[0].blocks as RulebookBlocks, aliases: rows[0].aliases } : seasonBook(seasonId);
}

/** The rules a game will play by for its questions: a couch's own copy (Make it ours, ours.ts copyOf, already read), else the
 *  season's (as leagueBook says for a game that exists). */
export async function questionBook(seasonId: string, copy: { blocks?: unknown; aliases?: unknown } | null): Promise<CallBook> {
  return copy?.blocks ? { blocks: copy.blocks as RulebookBlocks, aliases: copy.aliases as CallBook["aliases"] } : seasonBook(seasonId);
}

/** questionContext's ctx from the rules themselves (question-choices.ts, pure). */
export { contextOf };

// ---------- what's due, for the screens (step A4 part 2) ----------

/**
 * A game's sheet as its move: this week's questions you can answer now (open, not behind), how many of them you have, the
 * earliest one's lock, and whether it's a draft's finale predictions. Null when it asks nothing of you now (nothing open, or a
 * game that has no questions). For the Games read (GameView.sheet: Tonight's cards, the dock) and the home's moves.
 */
export async function sheetOf(user: SessionUser, seasonId: string, h: GameHere, now = new Date(), rows?: AnswerRow[]): Promise<SheetMove | null> {
  const qs = questionsOf(h.state);
  if (!qs.length) return null;
  const g = await readQuestions(await readFrom(h, seasonId, now), undefined, rows);
  return summaryOf(g, !!StateLogic.finaleOfGame(h.state));
}

/** A read's questions as a move. */
function summaryOf(g: GameQuestions, finale: boolean): SheetMove | null {
  const open = g.questions.filter((q) => q.status === "open");
  const behind = g.questions.find((q) => q.status === "behind")?.catchUp ?? null;
  if (!open.length && behind === null) return null;
  const locks = open.map((q) => (q.closesAt ? Date.parse(q.closesAt) : Infinity));
  const first = Math.min(...locks);
  return {
    episode: g.episode,
    of: open.length,
    answered: open.filter((q) => answered(q.mine)).length,
    closesAt: Number.isFinite(first) ? new Date(first).toISOString() : null,
    behind,
    finale,
  };
}

/** Whether an answer is in (an empty list is none). */
const answered = (v: unknown) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);

/**
 * A game of questions' move on the home (/api/me/home), beside actionItems' (whose league states don't hold the answers): this
 * week's sheet while some of it you could answer now is still blank. A draft's finale predictions are an extra, never a move.
 */
export async function questionMoves(
  user: SessionUser,
  games: { leagueId: string; name: string; gameType: string; seasonId: string | null; archived?: boolean }[],
  now = new Date()
): Promise<{ kind: "questions"; text: string; href: string; leagueId: string; leagueName: string; episode?: number; deadline: string | null; who: "you" }[]> {
  const sheets = games.filter((g) => g.gameType === "questions" && !!g.seasonId && !g.archived);
  // Each read at once: a Prediction Sheet is rare, and these are the home's only per-game reads of answers.
  const reads = await Promise.all(
    sheets.map((g) =>
      gameQuestions(user, g.seasonId!, g.leagueId, undefined, now)
        .then((q) => summaryOf(q, false))
        .catch((e) => {
          console.error(`[answers] home move ${g.leagueId}:`, e);
          return null;
        })
    )
  );
  const out = [];
  for (const [i, g] of sheets.entries()) {
    const m = reads[i];
    if (!m || m.answered >= m.of) continue;
    out.push({
      kind: "questions" as const,
      text: m.answered ? `Finish your sheet (${m.of - m.answered} to go)` : `Fill in your sheet (${m.of} ${m.of === 1 ? "question" : "questions"})`,
      href: `/show/${g.seasonId}/tonight`,
      leagueId: g.leagueId,
      leagueName: g.name,
      ...(m.episode !== null ? { episode: m.episode } : {}),
      deadline: m.closesAt,
      who: "you" as const,
    });
  }
  return out;
}
