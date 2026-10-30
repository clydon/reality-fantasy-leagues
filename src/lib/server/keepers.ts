import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// Keepers across seasons (docs/PLAN-start-a-game-gpt.md step A10 part 4, the spec's get.keep: "Dynasty: keep 2 of your players
// when they come back next season"). Who a seat can keep is never a name a person types: it's worked out here from the two
// leagues, the game this one continues (get.keep.from) and this one. Each account on this game that also had a seat there is
// offered its team there as it stands, best first by last season's points, each matched to this league's cast by name as each
// season's cast records it (StateLogic.KeeperLogic.optionsFrom, nameKey: the only thing that knows a person across seasons; nothing
// in the data links the two seasons' cast rows), and written into the game (KeeperLogic.setOptions) until the keepers lock as
// the draft starts. Its fallbacks: a game it can't find, or one on another show or not an earlier season, offers nobody anything
// (everyone drafts a whole team); someone not on this season's cast isn't offered (their place goes to the draft); a seat whose
// account wasn't on last season's game (a computer player, someone new) is offered nobody. Every write to a game with keepers
// still open settles them (withLeagueLock: before the mutation, and after one that turned keepers on), one query for the old
// league and one for both leagues' members; nothing once they're locked.

// A league id, before it's queried (a spec's `from` is anything a spec says). Its own copy: auth-helpers.ts's isUuid imports db.ts,
// which imports this module.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each seat's options ({ playerId: [castawayId] } best first) in a game whose keepers are open, or null for any other game. */
export async function keeperOptionsFor(db: Pool | PoolClient, leagueId: string, state: LeagueState): Promise<Record<string, string[]> | null> {
  const k = StateLogic.KeeperLogic.config(state);
  if (!k || StateLogic.KeeperLogic.locked(state)) return null;
  const from = k.from;
  if (!from || from === leagueId || !UUID.test(from)) return {};
  const { rows } = await db.query("SELECT state FROM leagues WHERE id = $1 AND deleted_at IS NULL", [from]);
  if (!rows.length) return {};
  const old: LeagueState = rows[0].state;
  const was = old.settings ?? {};
  const now = state.settings ?? {};
  // Last season's game: the same show, an earlier season.
  if (!was.showId || was.showId !== now.showId || !(Number(was.wikiSeason) < Number(now.wikiSeason))) return {};
  const { rows: members } = await db.query("SELECT league_id, user_id, player_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [[leagueId, from]]);
  const seatsThen = new Map<string, string[]>();
  for (const m of members) if (m.league_id === from) seatsThen.set(m.user_id, [...(seatsThen.get(m.user_id) ?? []), m.player_id]);
  // A team two people share (step A10 part 4b) is offered both their teams there, ranked together, best first.
  const thenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.league_id !== leagueId) continue;
    const then = seatsThen.get(m.user_id);
    if (then) thenOf.set(m.player_id, [...new Set([...(thenOf.get(m.player_id) ?? []), ...then])]);
  }
  const out: Record<string, string[]> = {};
  for (const [seat, then] of thenOf) out[seat] = StateLogic.KeeperLogic.optionsFrom(old, then, state);
  return out;
}

/**
 * Writes each seat's keeper options into a game whose keepers are open (KeeperLogic.setOptions); a failure is logged and leaves
 * the options it had. Whether it read any (false for any other game). `inTransaction`: `db` is a client inside an open
 * transaction (withLeagueLock's), so the reads go in a savepoint: a failed statement would otherwise abort the whole write.
 */
export async function settleKeepers(db: Pool | PoolClient, leagueId: string, state: LeagueState, inTransaction = false): Promise<boolean> {
  if (!StateLogic.KeeperLogic.config(state) || StateLogic.KeeperLogic.locked(state)) return false;
  if (inTransaction) await db.query("SAVEPOINT keepers");
  try {
    const options = await keeperOptionsFor(db, leagueId, state);
    if (inTransaction) await db.query("RELEASE SAVEPOINT keepers");
    if (options) StateLogic.KeeperLogic.setOptions(state, options);
    return true;
  } catch (e) {
    if (inTransaction) await db.query("ROLLBACK TO SAVEPOINT keepers").catch(() => {});
    console.error("[keepers] couldn't read last season's game:", e);
    return false;
  }
}
