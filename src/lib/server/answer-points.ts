import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { SheetNights } from "@/lib/game/episode-view";
import type { GameCalls } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import { HttpError, pool } from "./db";
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

/** The game as a viewer sees it: at their mark (the spoiler guard's view), as it stood at a span's end. */
export const viewOf = (h: { state: LeagueState; playerId: string | null; mark: number | null }) =>
  StateLogic.spanView(StateLogic.GhostLogic.viewFor(h.state, h.playerId, h.mark));

/**
 * A game of questions' points by player, as `playerId` sees it at `mark` (the spoiler guard's view: nothing past it is
 * graded), for its table (game-view.ts tableOf ranks it by them, as Weekly Calls' by its calls). Null for any other game: a
 * draft's finale predictions are in its own scores.
 */
export async function leagueAnswers(o: { leagueId: string; state: LeagueState; playerId: string | null; mark: number | null; rows?: AnswerRow[] }): Promise<GameCalls | null> {
  if (!StateLogic.getLeagueType(o.state).hasQuestions) return null;
  const { points } = StateLogic.AnswerLogic.grade(viewOf(o), o.rows ?? (await storedAnswers(o.leagueId)));
  return { right: (p) => points.get(p) ?? 0, move: null };
}

/**
 * The same for the hub's standings (couch-hub.ts standingOf), with the episode it's through and whether it's over. `rows`:
 * the game's answers when they've been read already (the hub reads its standing now and one episode back).
 */
export async function answerStanding(o: { leagueId: string; state: LeagueState; playerId: string | null; mark: number | null; rows?: AnswerRow[] }) {
  if (!StateLogic.getLeagueType(o.state).hasQuestions) return undefined;
  const view = viewOf(o);
  const { points } = StateLogic.AnswerLogic.grade(view, o.rows ?? (await storedAnswers(o.leagueId)));
  const end = StateLogic.endEpisode(view);
  const seen = StateLogic.SpoilerLogic.latestWithResults(view);
  return { right: (p: string) => points.get(p) ?? 0, through: end === null ? seen : Math.min(seen, end), ended: StateLogic.gameOver(view) };
}

/**
 * A Prediction Sheet's nights for one player (step A4 part 2), by episode: the questions asked that episode they answered, how
 * many of those are settled as far as they've seen (the view at their mark), right, and what they earned. For the episodes'
 * "Your night" line (episode-view.ts nightIn); the game's own questions (asked once) are the sheet's, not a night's.
 */
export async function sheetNights(o: { leagueId: string; state: LeagueState; playerId: string; mark: number | null; rows?: AnswerRow[] }): Promise<SheetNights> {
  const view = viewOf(o);
  const facts = StateLogic.AnswerLogic.facts(view);
  const seats = new Set(view.players.map((p) => p.id));
  const rows = (o.rows ?? (await storedAnswers(o.leagueId))).filter((r) => r.episode > 0 && seats.has(r.playerId));
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
        if (Spec.isRight(q, v, mine, list, facts)) n.right++;
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
