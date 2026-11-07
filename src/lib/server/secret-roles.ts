import { randomUUID } from "crypto";
import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// Secret roles among the players (docs/PLAN-start-a-game-gpt.md step A14 part 4; game-spec schema.js's score.roles): the deal, made
// once the game starts and kept in secret_role_deals (0210), never in the league's state (every route sends it whole). The first
// read or write after the game's first episode locks (or has results) deals it (StateLogic.SecretRoleLogic.deal, from a fresh
// seed: an insert racing nobody, read back), from stampAirTimes, after the air times it needs. Until the reveal nothing of it
// reaches the state; once the reveal's episode has results (SecretRoleLogic.revealAt: the game's end, or the episode the spec names),
// it's stamped as `state.secretRoles` ({ at, holders }) on every read and write, so the draft's walk counts the role's points there,
// on the server and in the browser alike, and the spoiler view takes it off a copy that hasn't seen that episode. A game with no
// roles costs no query (a stale stamp is only taken off). Each seat learns its own role from the roles route.
//
// Read with the caller's `db`, in a savepoint inside a write, as vote-records.ts is.

type Queryable = Pool | PoolClient;
export type SecretRoleDeal = { seed: string; seats: string[]; holders: string[]; role: string };

export async function readDeal(db: Queryable, leagueId: string): Promise<SecretRoleDeal | null> {
  const { rows } = await db.query("SELECT seed, seats, holders, role FROM secret_role_deals WHERE league_id = $1", [leagueId]);
  const r = rows[0];
  return r ? { seed: r.seed, seats: Array.isArray(r.seats) ? r.seats : [], holders: Array.isArray(r.holders) ? r.holders : [], role: r.role } : null;
}

/** A game's deal: read, or made now once it's due (the game has roles and has started). Null for a game with none, or none yet. */
export async function dealFor(db: Queryable, leagueId: string, state: LeagueState, now = Date.now()): Promise<SecretRoleDeal | null> {
  const R = StateLogic.SecretRoleLogic;
  const cfg = R.of(state);
  if (!cfg) return null;
  const had = await readDeal(db, leagueId);
  if (had || !R.due(state, now)) return had;
  const seed = randomUUID();
  const d = R.deal(state, seed);
  await db.query(
    "INSERT INTO secret_role_deals (league_id, seed, seats, holders, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (league_id) DO NOTHING",
    [leagueId, seed, JSON.stringify(d.seats), JSON.stringify(d.holders), cfg.name]
  );
  return readDeal(db, leagueId);
}

/** Deals a game's roles once due, marks the state dealt (`secretRolesDealt`: only that they are, so setGame keeps them as dealt),
 *  and stamps them on it once revealed (else takes the stamp off). A failure is logged and leaves the stamps it had (a write saves
 *  the state: a passing error mustn't take revealed points off it). Without a league to name, nothing changes. */
export async function stampSecretRoles(db: Queryable, state: LeagueState, leagueId?: string, now = Date.now()): Promise<void> {
  if (!StateLogic.SecretRoleLogic.of(state)) {
    delete state.secretRoles;
    delete state.secretRolesDealt;
    return;
  }
  if (!leagueId) return;
  const inWrite = "release" in db && typeof db.release === "function";
  let deal: SecretRoleDeal | null;
  try {
    if (inWrite) await db.query("SAVEPOINT secret_roles");
    deal = await dealFor(db, leagueId, state, now);
    if (inWrite) await db.query("RELEASE SAVEPOINT secret_roles");
  } catch (e) {
    if (inWrite) await db.query("ROLLBACK TO SAVEPOINT secret_roles").catch(() => {});
    console.error("[secret-roles] couldn't read the game's deal:", e);
    return;
  }
  if (deal) state.secretRolesDealt = true;
  else delete state.secretRolesDealt;
  const at = StateLogic.SecretRoleLogic.revealAt(state);
  if (deal && at !== null) state.secretRoles = { at, holders: [...deal.holders] };
  else delete state.secretRoles;
}
