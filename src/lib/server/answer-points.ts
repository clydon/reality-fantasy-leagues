import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { SheetNights } from "@/lib/game/episode-view";
import { gameView, type GameCalls } from "@/lib/game/game-view";
import type { AnswerFacts, FormatGroups } from "@/lib/game/game-spec/index.js";
import type { AnswerWalk, StageWalk } from "@/lib/game/state-logic.js";
import { groupFacts } from "@/lib/game/formats/format-timeline.js";
import type { LeagueState } from "@/lib/game/types";
import { timelineForShow } from "@db/format-timeline.js";
import { HttpError, pool } from "./db";
import { stagesOf } from "./stages";
import type { SeasonSchedule } from "./schedule";

// A game of questions' points, for its tables (step A4 of docs/PLAN-start-a-game-gpt.md; answers.ts reads and writes the
// answers): graded on read from the league's results at the viewer's mark (StateLogic.AnswerLogic), never stored.

export interface AnswerRow {
  playerId: string;
  question: string;
  episode: number;
  answer: unknown;
  /** Step A9 (migration 0201): how many of the game's episodes had started when it was last changed, and how many times it was
   *  changed once the game had started (a call whose points shrink). */
  late?: number;
  changes?: number;
}

/** Every answer stored for a game (game_answers, migrations 0200 and 0201). */
export async function storedAnswers(leagueId: string): Promise<AnswerRow[]> {
  const { rows } = await pool.query("SELECT player_id, question, episode, answer, late, changes FROM game_answers WHERE league_id = $1", [leagueId]);
  return rows.map((r) => ({ playerId: r.player_id as string, question: r.question as string, episode: r.episode as number, answer: r.answer, late: r.late as number, changes: r.changes as number }));
}

/** The season's last episode, when the season says how many it has: what finale predictions wait for. */
export function finaleEpisode(schedule: SeasonSchedule | undefined): { number: number; airAt: string | null } | null {
  const n = schedule?.episodeCount ?? null;
  if (!n) return null;
  return { number: n, airAt: schedule?.episodes.find((e) => e.number === n)?.airAt ?? null };
}

/** A game of questions as someone may see it (walked): its view, the facts its questions are graded on there, the answers that
 *  count (none of someone's for an episode after they went out) and its walk (null for a game that neither races nor knocks
 *  players out). */
export interface Walked {
  view: LeagueState;
  facts: AnswerFacts;
  rows: AnswerRow[];
  walk: AnswerWalk | null;
}

/**
 * The game as a viewer sees it: at their mark (the spoiler guard's view), as it stood at its end. A game of questions that races
 * or knocks players out (step A11 part 2b: Spec.answerParts) is walked over its graded answers on the viewer's own copy first
 * (StateLogic.AnswerLogic.walk), so it ends, and knocks anyone out, only as far as they've seen, and the copy carries the walk
 * (withWalk) for everything the engine reads of it: its end (lastEpisode, gameOver, spanView), the scores' `out` and the rank. A
 * state that already carries the walk of exactly what this viewer sees (asItStands', nothing hidden from them) keeps it. `rows`:
 * the game's answers when they've been read already.
 */
export async function walked(o: { leagueId: string; state: LeagueState; playerId: string | null; mark: number | null; rows?: AnswerRow[] }): Promise<Walked> {
  const A = StateLogic.AnswerLogic;
  const seen = StateLogic.GhostLogic.viewFor(o.state, o.playerId, o.mark);
  const all = o.rows ?? (StateLogic.getLeagueType(o.state).hasQuestions ? await storedAnswers(o.leagueId) : []);
  // The format's groups, read once (the seen copy and the one cut at the game's end have the same cast).
  const formatGroups = await formatGroupsFor(o.state, seen);
  const factsOf = (v: LeagueState): AnswerFacts => {
    const f = A.facts(v);
    return formatGroups ? { ...f, formatGroups } : f;
  };
  if (!Spec.answerParts(StateLogic.gameOf(seen))) {
    const view = StateLogic.spanView(seen);
    return { view, facts: factsOf(view), rows: all, walk: null };
  }
  const walk = A.walkOf(seen) ?? A.walk(seen, all, factsOf(seen));
  const view = StateLogic.spanView(A.withWalk(seen, walk));
  return { view, facts: factsOf(view), rows: walk ? A.liveRows(seen, all, walk.out) : all, walk };
}

/**
 * A game of questions that races or knocks players out (step A11 part 2b), as it stands: the league walked over all its answers and
 * every result (StateLogic.AnswerLogic.walk), on a copy that carries the walk, for what reads the league itself: whether someone is
 * out or the game has ended (answers.ts refuses their answers; the questions close), and which results are its to reveal. Any
 * other game, the state as it is. `rows`: the answers read (to reuse), when it read them.
 */
export async function asItStands(leagueId: string, state: LeagueState, rows?: AnswerRow[]): Promise<{ state: LeagueState; rows?: AnswerRow[] }> {
  // Step A12 part 1: a game in stages, its stages' tables (stageWalk), so its own table is the overall.
  if (StateLogic.StageLogic.on(state)) return { state: StateLogic.StageLogic.withWalk(state, await stageWalk(leagueId, state)), rows };
  if (!Spec.answerParts(StateLogic.gameOf(state))) return { state, rows };
  const all = rows ?? (await storedAnswers(leagueId));
  const walk = StateLogic.AnswerLogic.walk(state, all, await answerFacts(state, state));
  return { state: StateLogic.AnswerLogic.withWalk(state, walk), rows: all };
}

/** What a stage's table is read as: anyone on its couch, no seat (game-view.ts gameView's `playerId` null). */
const STAGE_REF = { leagueId: "", name: "", gameType: "", gameName: "", yourRole: null };

/**
 * A game in stages' stages' tables (step A12 part 1: StateLogic.StageLogic reads them): each stage league as it stands (a game of
 * questions graded and walked on its answers, as its own table is), its table as it stood after each episode it played, the table
 * anyone on its couch sees at that mark (game-view.ts gameView, no seat), up to the episode it's over at; so the game's overall reads
 * at any viewer's mark. One query for the stages and one for each game of questions' answers; worked out on read, never stored.
 */
export async function stageWalk(parentId: string, parent: LeagueState): Promise<StageWalk | null> {
  if (!StateLogic.StageLogic.on(parent)) return null;
  // Each stage's walk side by side.
  const stages: StageWalk["stages"] = await Promise.all(
    (await stagesOf(pool, parentId)).map(async (r) => {
      const questions = StateLogic.getLeagueType(r.state).hasQuestions;
      const answers = questions ? await storedAnswers(r.id) : undefined;
      const { state } = await asItStands(r.id, r.state, answers);
      const from = StateLogic.startEpisode(state);
      const latest = StateLogic.SpoilerLogic.latestWithResults(state);
      const entries: StageWalk["stages"][number]["entries"] = [];
      for (let n = from ?? latest + 1; n <= latest; n++) {
        if (!state.episodes.some((e) => e.number === n && StateLogic.episodeHasResults(e))) continue;
        const calls = questions ? await leagueAnswers({ leagueId: r.id, state, playerId: null, mark: n, rows: answers }) : null;
        const v = gameView(STAGE_REF, state, null, n, () => null, calls ?? undefined);
        entries.push({ episode: n, over: v.over, rows: v.table.map((t) => ({ playerId: t.playerId, points: t.total, place: t.place })) });
        if (v.over) break;
      }
      return { key: r.key, leagueId: r.id, from, to: StateLogic.lastEpisode(state), entries };
    })
  );
  return { stages };
}

/** Whether a question reads its groups from the format's state over time where the season has them (A6 on F3 part 2): the
 *  grader's own test (game-spec answers.js). */
export const readsTimeline = Spec.readsTimeline;

/**
 * The groups a game's group questions read from the season's format state over time (F3 part 2: format-timeline.js groupFacts),
 * by episode, when it asks one each episode and its season is played in groups the league doesn't hold (The Challenge's pairs:
 * research's format section, never staged as moves); undefined otherwise. A season in named tribes or teams (Survivor) reads
 * the league's own while they're played, and since F4 an episode the timeline knows nobody played in them (after a merge, The
 * Challenge 40's eras outside 3-9) is off, with nothing offered. Worked out on read from the season's stored research (one query each
 * time: research that just landed is read at once), never stored. Members are matched to the view's castaways the forgiving way (Core.findCastawayByName), and
 * every lock up to the league's latest episode is covered: one past the last report is the timeline's, unsure.
 */
export async function formatGroupsFor(state: LeagueState, view: LeagueState): Promise<Map<number, FormatGroups> | undefined> {
  if (!StateLogic.AnswerLogic.questions(state).some(readsTimeline)) return undefined;
  const s = state.settings ?? {};
  const tl = await timelineForShow(pool, s.showId, s.wikiSeason);
  if (!tl) return undefined;
  const resolve = (name: string) => StateLogic.Core.findCastawayByName(view, name).castaway?.id ?? null;
  const through = Math.max(0, ...state.episodes.map((e) => e.number));
  const map = groupFacts(tl, { cast: view.castaways, tribes: (view.tribes ?? []).map((t) => t.name), resolve, through });
  return map.size ? map : undefined;
}

/** The facts a game's questions are graded on as a viewer sees them (StateLogic.AnswerLogic.facts), the timeline's groups in. */
export async function answerFacts(state: LeagueState, view: LeagueState): Promise<AnswerFacts> {
  const formatGroups = await formatGroupsFor(state, view);
  const facts = StateLogic.AnswerLogic.facts(view);
  return formatGroups ? { ...facts, formatGroups } : facts;
}

/**
 * A game of questions' points by player, as `playerId` sees it at `mark` (the spoiler guard's view: nothing past it is
 * graded), for its table (game-view.ts tableOf ranks it by them, as Weekly Calls' by its calls). Null for any other game: a
 * draft's finale predictions are in its own scores.
 */
export async function leagueAnswers(o: { leagueId: string; state: LeagueState; playerId: string | null; mark: number | null; rows?: AnswerRow[] }): Promise<GameCalls | null> {
  if (!StateLogic.getLeagueType(o.state).hasQuestions) return null;
  const w = await walked(o);
  // Step A11 part 2b: a game that races or knocks players out has its points in its walk (frozen once someone's out), and the
  // table reads who's out from the walk (gameView puts it on its copy of the league).
  return { right: pointsOf(w), move: null, walk: w.walk };
}

/** Each one's points as the table shows them: a walk's (frozen once out), else graded on the view. */
function pointsOf(w: Walked): (playerId: string) => number {
  if (w.walk) {
    const totals = w.walk.totals;
    return (p) => totals[p] ?? 0;
  }
  const { points } = StateLogic.AnswerLogic.grade(w.view, w.rows, w.facts);
  return (p) => points.get(p) ?? 0;
}

/**
 * The same for the hub's standings (couch-hub.ts standingOf), with the episode it's through and whether it's over. `rows`:
 * the game's answers when they've been read already (the hub reads its standing now and one episode back).
 */
export async function answerStanding(o: { leagueId: string; state: LeagueState; playerId: string | null; mark: number | null; rows?: AnswerRow[] }) {
  if (!StateLogic.getLeagueType(o.state).hasQuestions) return undefined;
  const w = await walked(o);
  // Through its last episode: its span's end, or where it ended early (step A11 part 2b).
  const end = StateLogic.lastEpisode(w.view);
  const seen = StateLogic.SpoilerLogic.latestWithResults(w.view);
  return { right: pointsOf(w), through: end === null ? seen : Math.min(seen, end), ended: StateLogic.gameOver(w.view), walk: w.walk };
}

/**
 * A Prediction Sheet's nights for one player (step A4 part 2), by episode: the questions asked that episode they answered, how
 * many of those are settled as far as they've seen (the view at their mark), right, and what they earned. For the episodes'
 * "Your night" line (episode-view.ts nightIn); the game's own questions (asked once) are the sheet's, not a night's.
 */
export async function sheetNights(o: { leagueId: string; state: LeagueState; playerId: string; mark: number | null; rows?: AnswerRow[] }): Promise<SheetNights> {
  // Step A11 part 2b: as walked (an answer of someone's for an episode after they went out counts for nobody).
  const { view, facts, rows: live } = await walked(o);
  const seats = new Set(view.players.map((p) => p.id));
  const rows = live.filter((r) => r.episode > 0 && seats.has(r.playerId));
  // What each window earned, A9's ways of combining in (a split pot, a rollover's jackpot, a parlay).
  const { earned } = StateLogic.AnswerLogic.grade(view, rows, facts);
  const out: SheetNights = new Map();
  // Asked each episode, or over a run or a phase (A7: a night is the episode its window opens at).
  for (const q of StateLogic.AnswerLogic.questions(view).filter((x) => x.asked !== "once" && !Spec.isCalls(x))) {
    for (const ep of new Set(rows.filter((r) => r.question === q.id).map((r) => r.episode))) {
      const list = rows.filter((r) => r.question === q.id && r.episode === ep).map((r) => ({ playerId: r.playerId, answer: r.answer }));
      const mine = list.find((r) => r.playerId === o.playerId);
      if (!mine) continue;
      const n = out.get(ep) ?? { answered: 0, settled: 0, off: 0, right: 0, earned: 0 };
      n.answered++;
      const v = Spec.verdictOf(q, ep, facts);
      // Off (nobody went home, right on the line): settled, but it doesn't count either way.
      if (v.state !== "waiting") n.settled++;
      if (v.state === "off") n.off++;
      if (v.state === "known") {
        const right = Spec.isRight(q, v, mine, list, facts);
        // A void pick (F3 part 2: a pair that didn't play as offered) didn't count either way, as an off question doesn't.
        if (right === null) n.off++;
        else if (right) n.right++;
        n.earned += earned.get(`${q.id}|${ep}`)?.get(o.playerId) ?? 0;
      }
      out.set(ep, n);
    }
  }
  return out;
}

/**
 * Classic's finale routes (step A4): a draft's finale predictions lock when the season's last episode starts (its schedule's
 * episode count says which), and with no finale listed, once the season is over. Returns the check to run on the league's state inside
 * its lock (the state's air times are stamped there): it throws 409 once they're closed.
 */
export async function finaleLock(leagueId: string, now = new Date()): Promise<(state: LeagueState) => void> {
  const { leagueSeason } = await import("./push-events");
  const { seasonSchedules } = await import("./schedule");
  const { seasonId } = await leagueSeason(leagueId);
  const finale = finaleEpisode(seasonId ? (await seasonSchedules([seasonId], now)).get(seasonId) : undefined);
  const n = finale?.number ?? null;
  const airAt = finale?.airAt ?? null;
  return (state) => {
    const q = StateLogic.AnswerLogic.questions(state).find((x) => x.id === "winner" || x.id === "top3");
    if (!q || !StateLogic.finaleOfGame(state)) throw new HttpError(409, "This game has no finale predictions");
    if (StateLogic.AnswerLogic.closed(state, q, 0, { now: now.getTime(), finale: n, airAt })) {
      throw new HttpError(409, n ? `Finale predictions closed when Episode ${n} started` : "Finale predictions are closed: the season is over");
    }
  };
}
