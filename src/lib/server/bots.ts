import type { PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import Bots, { type StakeRoom } from "@/lib/game/bot-logic.js";
import StateLogic from "@/lib/game/state-logic.js";
import type { AnswerRow } from "./answer-points";
import { lockAuctionBids } from "./auction";
import { lockBlindPicks } from "./blind-draft";

// Computer players' moves (src/lib/game/bot-logic.js), made inside the caller's league lock so they
// land in the same write as whatever prompted them: a person's draft pick is followed straight away by
// any bot picks after it, results landing are followed by the bots' new lineups, and so on.
//
// Blind-draft lock-ins go first and through lockBlindPicks, the same as a person's -- submissions live
// in blind_draft_picks, never in `state`, and a bot's lock can be the one that completes the set and
// reveals. Everything else is a pure change to `state`.
export async function runBots(client: PoolClient, leagueId: string, state: LeagueState): Promise<void> {
  for (const s of Bots.blindSubmissions(state)) {
    await lockBlindPicks(client, leagueId, state, s.playerId, s.castawayIds);
  }
  // An auction's sealed bids (step A10 part 3b), the same way: kept out of `state`, and the last sheet in settles it.
  for (const s of Bots.auctionBids(state)) {
    await lockAuctionBids(client, leagueId, state, s.playerId, s.bids);
  }
  Bots.run(state);
  await answerForBots(client, leagueId, state);
}

type Answered = { playerId: string; question: string; episode: number };
// The answers' reads (answer-points.ts), loaded only for a game where computer players answer questions: every league write runs
// runBots, and that module brings the grading's whole server side with it.
const points = () => import("./answer-points");
const storedAnswers = async (leagueId: string, client: Client) => (await points()).storedAnswers(leagueId, client);
type Client = PoolClient | { query: PoolClient["query"] };
async function writeAnswers(client: Client, leagueId: string, due: (Answered & { answer: unknown })[]): Promise<void> {
  for (const a of due) {
    await client.query(
      `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, 0, 0)
       ON CONFLICT (league_id, player_id, question, episode) DO NOTHING`,
      [leagueId, a.playerId, a.question, a.episode, JSON.stringify(a.answer)]
    );
  }
}
/** Each computer player's room to stake (E1b's second slice), read as a person's is (answer-points.ts seatStakeRoom), for a game
 *  where any question they answer is staked from points or a bank: live ones as their points stand ("seat|live"), and each one
 *  catching up at the week before each week it answers ("seat|mark"). None otherwise. */
async function roomsFor(leagueId: string, state: LeagueState, rows: AnswerRow[], live: boolean, n: number | null | undefined): Promise<Map<string, StakeRoom> | undefined> {
  if (!Bots.stakesPoints(state)) return undefined;
  const { seatStakeRoom } = await points();
  const rooms = new Map<string, StakeRoom>();
  if (live) for (const pid of Bots.botIds(state)) rooms.set(`${pid}|live`, await seatStakeRoom(leagueId, state, pid, null, rows));
  if (n !== undefined) for (const { playerId, week } of Bots.catchUpWeeks(state, n)) rooms.set(`${playerId}|${week - 1}`, await seatStakeRoom(leagueId, state, playerId, week - 1, rows));
  return rooms;
}
const catchingUp = (state: LeagueState) => state.players.some((p) => Bots.isBot(p) && StateLogic.GhostLogic.isCatchingUp(state, p.id));

/**
 * At your own pace (E1b's second slice): computer players catch up to `n` with whoever revealed it first, answering each week's
 * questions on the way (and the week after's) from their own copies (bot-logic.js catchUpAnswers: that week's results unseen), then
 * playing its picks and lineups (catchUpTo). Inside the caller's league lock (reveal.ts, late-join.ts).
 */
export async function catchUpBots(client: PoolClient, leagueId: string, state: LeagueState, n: number): Promise<void> {
  if (Bots.answeredQuestions(state).length && catchingUp(state)) {
    const rows = await storedAnswers(leagueId, client);
    await writeAnswers(client, leagueId, Bots.catchUpAnswers(state, rows, n, await roomsFor(leagueId, state, rows, false, n)));
  }
  Bots.catchUpTo(state, n);
}

/**
 * Computer players' answers to a game's own questions (docs/PLAN-start-a-game-redo.md E1b; bot-logic.js answers): written into
 * game_answers as a person's are, never over one already there, inside the caller's transaction. Each one playing live answers
 * each open window once; each one catching up at your own pace, its next week's, from its own copy (catchUpAnswers). Runs with
 * every league write: a window opening as results land, and the game's start (start-spec.ts writes once after a start with
 * computer players). A window that opens with no write to the league waits for the next one.
 */
export async function answerForBots(client: Client, leagueId: string, state: LeagueState, now = Date.now()): Promise<number> {
  if (!Bots.answeredQuestions(state).length) return 0;
  const live = Bots.botIds(state).length > 0;
  const behind = catchingUp(state);
  if (!live && !behind) return 0;
  const stored = await storedAnswers(leagueId, client);
  const rooms = await roomsFor(leagueId, state, stored, live, behind ? null : undefined);
  const due = [...(live ? Bots.answers(state, stored, { now, rooms }) : []), ...(behind ? Bots.catchUpAnswers(state, stored, null, rooms) : [])];
  await writeAnswers(client, leagueId, due);
  return due.length;
}
