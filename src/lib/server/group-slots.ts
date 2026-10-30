import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { slotRecords } from "@/lib/game/formats/format-timeline.js";
import type { EpisodeFormatGroups, LeagueState } from "@/lib/game/types";

// Group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1, "When a grouping lasts": a draft's +1 or +2 slot that holds a pair
// or a team the show forms). The groups are the season's format state over time (db/format-timeline.js, built from each
// episode's stored research on read), written into a game with slots as each episode's `formatGroups` (state-logic.js
// GroupSlotLogic.settle: only on episodes with results), so everything that scores it, on the server or in the browser, reads
// it from the league's state. Every write to such a game settles it again (withLeagueLock: before the mutation, so a pick
// reads what's on offer now, and after it, for results it applied), so a corrected report reaches the game at its next write
// (the season sync after every result is one). One query a write, for a game with group slots only; the database module is
// loaded only then (db.ts imports this, and everything that writes a league imports db.ts).

/** The season's groups for a game with group slots, by episode, members as its castaway ids (the forgiving match); null for
 *  any other game. A league naming no season has none. */
export async function slotRecordsFor(db: Pool | PoolClient, state: LeagueState): Promise<Map<number, EpisodeFormatGroups> | null> {
  if (!StateLogic.GroupSlotLogic.config(state)) return null;
  const s = state.settings ?? {};
  const { timelineForShow } = await import("@db/format-timeline.js");
  const tl = await timelineForShow(db, s.showId, s.wikiSeason);
  if (!tl) return new Map();
  const resolve = (name: string) => StateLogic.Core.findCastawayByName(state, name).castaway?.id ?? null;
  return slotRecords(tl, { resolve });
}

/**
 * Writes the season's groups into a game with group slots (GroupSlotLogic.settle); a failure is logged and leaves the groups
 * it had. The records, for settling again after a mutation, or null. `inTransaction`: `db` is a client inside an open
 * transaction (withLeagueLock's), so the read goes in a savepoint: a failed statement would otherwise abort the whole write.
 */
export async function settleGroupSlots(db: Pool | PoolClient, state: LeagueState, inTransaction = false): Promise<Map<number, EpisodeFormatGroups> | null> {
  if (!StateLogic.GroupSlotLogic.config(state)) return null;
  if (inTransaction) await db.query("SAVEPOINT group_slots");
  try {
    const records = await slotRecordsFor(db, state);
    if (inTransaction) await db.query("RELEASE SAVEPOINT group_slots");
    if (records) StateLogic.GroupSlotLogic.settle(state, records);
    return records;
  } catch (e) {
    if (inTransaction) await db.query("ROLLBACK TO SAVEPOINT group_slots").catch(() => {});
    console.error("[group-slots] couldn't read the season's groups:", e);
    return null;
  }
}
