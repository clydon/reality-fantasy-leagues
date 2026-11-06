import type { PoolClient } from "pg";
import { pool, HttpError, syncStagesFor } from "./db";

// League roles (db/migrations/0105): Commissioner (results, waivers, rules and roles), Game admin (results and
// waivers, can pick for people in a draft; not rules or roles) and member. Roles can be handed off or shared;
// a league always keeps at least one Commissioner. The classic app knows only commissioner and member, so a
// Game admin is a member there.

export type LeagueRole = "commissioner" | "admin" | "member";
export const LEAGUE_ROLES: LeagueRole[] = ["commissioner", "admin", "member"];

const RANK: Record<LeagueRole, number> = { member: 0, admin: 1, commissioner: 2 };

/** Whether `role` can do what `min` can (a Commissioner can do everything a Game admin can). */
export function roleAtLeast(role: string | null | undefined, min: LeagueRole): boolean {
  return role != null && role in RANK && RANK[role as LeagueRole] >= RANK[min];
}

/** Why a league's roles can't change this way, or null: it would leave the league with no Commissioner. */
export function lastCommissionerProblem(roles: { userId: string; role: string }[], userId: string, next: LeagueRole): string | null {
  const current = roles.find((r) => r.userId === userId)?.role;
  if (current !== "commissioner" || next === "commissioner") return null;
  return roles.filter((r) => r.role === "commissioner").length > 1 ? null : "Every game needs a Commissioner. Hand it to someone first.";
}

/**
 * Sets someone's role in a league, refusing to leave it without a Commissioner. `inside` runs in the same transaction,
 * with the role it had: the Recent changes line (change-log.ts roleChange), or an undo marking itself done.
 */
export async function setLeagueRole(
  leagueId: string,
  userId: string,
  role: unknown,
  inside?: (client: PoolClient, before: LeagueRole) => Promise<void>,
  /** `nobodyRuns`: the change may leave the game with no Commissioner (the desk's Undo of a hand-on from a couch nobody ran). */
  opts: { nobodyRuns?: boolean } = {}
): Promise<LeagueRole> {
  if (typeof role !== "string" || !LEAGUE_ROLES.includes(role as LeagueRole)) throw new HttpError(400, "role must be commissioner, admin or member");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Every membership of the league locked, so two Commissioners stepping down at once can't both pass.
    const { rows } = await client.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
    if (!rows.some((r) => r.user_id === userId)) throw new HttpError(404, "Not a member of this league");
    const problem = opts.nobodyRuns ? null : lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, role as LeagueRole);
    if (problem) throw new HttpError(409, problem);
    await client.query("UPDATE league_memberships SET role = $3 WHERE league_id = $1 AND user_id = $2", [leagueId, userId, role]);
    await inside?.(client, rows.find((r) => r.user_id === userId).role);
    await client.query("COMMIT");
    // A game in stages (step A12 part 4c): the role in each stage too, now it's committed (no write to the game would carry it).
    await syncStagesFor([leagueId]);
    return role as LeagueRole;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
