import type { PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import Bots from "@/lib/game/bot-logic.js";
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
}
