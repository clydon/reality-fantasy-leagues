import type { PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import Bots from "@/lib/game/bot-logic.js";
import StateLogic from "@/lib/game/state-logic.js";
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

/**
 * Computer players' answers to a game's own questions (docs/PLAN-start-a-game-redo.md E1b; bot-logic.js answers): written into
 * game_answers as a person's are, never over one already there, inside the caller's transaction. Runs with every league write (a
 * window opening as results land, the game's start) and when someone reads the game's questions (answers.ts), so a bot's answer
 * is in before the window closes whoever opens it first.
 */
export async function answerForBots(client: PoolClient | { query: PoolClient["query"] }, leagueId: string, state: LeagueState, now = Date.now()): Promise<number> {
  if (!Bots.botIds(state).length || !StateLogic.AnswerLogic.questions(state).length) return 0;
  const { rows } = await client.query("SELECT player_id, question, episode FROM game_answers WHERE league_id = $1", [leagueId]);
  const stored = rows.map((r) => ({ playerId: r.player_id as string, question: r.question as string, episode: r.episode as number }));
  const due = Bots.answers(state, stored, { now });
  for (const a of due) {
    await client.query(
      `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, 0, 0)
       ON CONFLICT (league_id, player_id, question, episode) DO NOTHING`,
      [leagueId, a.playerId, a.question, a.episode, JSON.stringify(a.answer)]
    );
  }
  return due.length;
}
