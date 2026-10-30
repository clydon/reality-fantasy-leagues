import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import Bots from "@/lib/game/bot-logic.js";
import { pool, withLeagueLock } from "./db";
import { stampAirTimes } from "./air-times";
import { notifyDraftTurn } from "./push-events";

// What a league read does before it answers: the classic league load (GET /api/leagues/[id]/state) and the new
// design's show space (season-games.ts) both read through here, so a league moves on whichever design is open.

// Who's on the clock in the draft, to tell whether a bot's picks passed the turn on to someone (read
// on a copy: currentDraftTurn tidies draftOrder as it goes).
function draftTurn(state: LeagueState) {
  return StateLogic.currentDraftTurn(structuredClone(state))?.playerId;
}

/**
 * The league's state with air times stamped, after anything that was waiting for a read:
 *
 * A league that predates the always-a-next-episode rule (or hasn't been written to since) gets it on load --
 * persisted, not just computed, since bets and picks key on the episode's id and an id invented fresh on every
 * read would never match. The check runs on a copy so the common case (nothing to do) costs no write.
 *
 * Same for a computer player with a move waiting that no write has prompted -- typically a draft whose scheduled
 * start time just passed with a bot first on the clock. withLeagueLock runs the bots. If that moved a turn on,
 * whoever's up now hears about it as they would after a person's pick. Air times are stamped first so a bot never
 * sees a lineup as open when its episode is already airing.
 *
 * And a waiver week with a step due (opening, processing, closing: docs/PLAN-midseason-waivers.md), so the week
 * moves on when its time comes even if nobody has written to the league since; and a draw whose scheduled time has come
 * (DrawLogic, step A10 part 3), so its teams are dealt when it's due, whoever looks first; and an auction whose bidding closed
 * with bids still out (AuctionLogic, part 3b), settled the same way; and keepers whose draft has started (KeeperLogic, part 4),
 * locked the same way.
 */
export async function readyLeague(leagueId: string, state: LeagueState): Promise<LeagueState> {
  await stampAirTimes(pool, state);
  const waiverStepDue = !!StateLogic.WaiverLogic.due(state, Date.now());
  // A draw whose scheduled time has come (step A10 part 3): withLeagueLock draws it.
  const drawDue = StateLogic.DrawLogic.due(state);
  // An auction whose bidding has closed (step A10 part 3b): withLeagueLock settles it.
  const auctionDue = StateLogic.AuctionLogic.due(state, Date.now());
  // Keepers whose draft has started (step A10 part 4): withLeagueLock locks them.
  const keepersDue = StateLogic.KeeperLogic.due(state);
  if (!StateLogic.ensureNextEpisode(structuredClone(state)) && !Bots.hasWork(state) && !waiverStepDue && !drawDue && !auctionDue && !keepersDue) return state;
  const before = draftTurn(state);
  const next = await withLeagueLock(leagueId, () => {});
  if (draftTurn(next) !== before) notifyDraftTurn(leagueId, next, null);
  await stampAirTimes(pool, next);
  return next;
}
