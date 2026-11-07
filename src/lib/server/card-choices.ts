import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";

// A card the bot chooses (docs/PLAN-start-a-game-gpt.md step C7 part 2; db/card-research.js): each episode's choice, as it stood
// when the card came out, stamped on the league's episode (`episode.cardChoice`) with the air times (air-times.ts stampAirTimes),
// so everything that scores or shows the card, on the server or in the browser, reads it from the league's state: on every read and
// every write, from card_choices (0208), so a choice the bot made since reaches every game on the season at its next read. Public
// once made (players answer or pick for the card's lines), so it's the state's as the air times are; the card is out
// Spec.CARD_OUT_HOURS before its episode airs, by the broadcast's clock even for a league at its own pace (a choice made after a
// season aired was never that episode's). Two queries for such a game (and a fallback filed the first time a card is found out
// without a choice); none for any other (a stale stamp is only taken off).
//
// Read with the caller's `db`: inside a write (withLeagueLock passes its transaction's client: the only caller that passes a client),
// in a savepoint, so a failed read can't abort the write around it, and the write never waits for a second connection while it holds
// its row lock.

/** Stamps a league's episodes with its card's choices (db/card-research.js stampLeague). A failure is logged and leaves the stamps
 *  it had. */
export async function stampCardChoices(db: Pool | PoolClient, state: LeagueState, now = Date.now()): Promise<void> {
  if (!Spec.botCard(Spec.cardOf(StateLogic.gameOf(state))) && !state.episodes?.some((e) => e.cardChoice)) return;
  const inWrite = "release" in db && typeof db.release === "function";
  try {
    const { stampLeague } = await import("@db/card-research.js");
    if (inWrite) await db.query("SAVEPOINT card_choices");
    await stampLeague(db, state, now);
    if (inWrite) await db.query("RELEASE SAVEPOINT card_choices");
  } catch (e) {
    if (inWrite) await db.query("ROLLBACK TO SAVEPOINT card_choices").catch(() => {});
    console.error("[card-choices] couldn't stamp the season's card choices:", e);
  }
}
