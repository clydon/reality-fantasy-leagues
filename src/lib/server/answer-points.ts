import StateLogic from "@/lib/game/state-logic.js";
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
}

/** Every answer stored for a game (game_answers, migration 0200). */
export async function storedAnswers(leagueId: string): Promise<AnswerRow[]> {
  const { rows } = await pool.query("SELECT player_id, question, episode, answer FROM game_answers WHERE league_id = $1", [leagueId]);
  return rows.map((r) => ({ playerId: r.player_id as string, question: r.question as string, episode: r.episode as number, answer: r.answer }));
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
