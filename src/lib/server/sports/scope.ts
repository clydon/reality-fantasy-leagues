import { pool } from "../db";
import { teamOfKey } from "./team-season";

// Whose players a sports game picks from, by what it's played on (the user, 2026-11-21): a game on one team's season picks from that
// team's players only (a fan's game: "a Bills game" is the Bills'); one game of it from the two teams playing it. A run of fixed games
// (a series, a rival's meetings, one game on its own matchup) already holds only its two teams, and a league's slate the whole league,
// so neither is limited here. The limit is the spec's own pool.where.teams (ESPN team ids: state-logic.js PoolLogic, the server's
// statTeams stamp), so our check counts the smaller pool (an exclusive draft too big for one team's players is refused with "make it
// shared"), the game's words say it ("Buffalo Bills players only") and Game settings shows it as any pool filter.

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A game that picks players: a draft (its auction and salary cap too) or a pick of players. Pick'em, squares and questions don't. */
export function picksPlayers(spec: Record<string, unknown>): boolean {
  const get = isObj(spec.get) ? spec.get : null;
  return !!get && (get.by === "draft" || get.by === "pick");
}

/**
 * The teams a game on `seasonId` over `from`..`to` picks from, or null when it's not limited (a league's slate, a matchup's fixed
 * games, a show). A team's season: that team; one episode of it (from === to), the teams in that episode's game.
 */
export async function scopeTeams(seasonId: string, from: number | null, to: number | null): Promise<string[] | null> {
  const { rows } = await pool.query("SELECT key FROM sports_matchups WHERE season_id = $1", [seasonId]);
  const who = rows[0] ? teamOfKey(rows[0].key as string) : null;
  if (!who) return null;
  if (from !== null && to === from) {
    const { rows: ev } = await pool.query("SELECT teams FROM season_events WHERE season_id = $1 AND episode = $2", [seasonId, from]);
    const ids = ((ev[0]?.teams ?? []) as { id?: unknown }[]).map((t) => (t && t.id != null ? String(t.id) : "")).filter(Boolean);
    if (ids.length >= 2) return [...new Set(ids)];
  }
  return [who.team];
}

/**
 * `spec` limited to its scope's teams, in place (start-spec.ts, before our check): only a game that picks players, and only when its
 * maker hasn't limited it already (a typed "the Bills' and Dolphins' players" keeps its own). Returns the teams set, or null.
 */
export async function scopePool(spec: Record<string, unknown>, seasonId: string): Promise<string[] | null> {
  if (!picksPlayers(spec)) return null;
  const where = isObj(spec.pool) && isObj(spec.pool.where) ? spec.pool.where : null;
  if (where && Array.isArray(where.teams)) return null;
  const span = isObj(spec.span) ? spec.span : {};
  const from = typeof span.from === "number" ? span.from : null;
  const to = typeof span.to === "number" ? span.to : null;
  const teams = await scopeTeams(seasonId, from, to);
  if (!teams) return null;
  const p = isObj(spec.pool) ? spec.pool : { of: "cast" };
  spec.pool = { ...p, where: { ...(where ?? {}), teams } };
  return teams;
}

/**
 * A game's pool after its span moves (Game settings' How long): when its teams are the scope's for the old span (set at the start, not
 * the maker's own), the new span's; else as it is. Returns the new spec, or the same one.
 */
export async function rescopePool(
  spec: Record<string, unknown>,
  seasonId: string,
  before: { from: number | null; to: number | null },
  after: { from: number | null; to: number | null }
): Promise<Record<string, unknown>> {
  if (!picksPlayers(spec)) return spec;
  const where = isObj(spec.pool) && isObj(spec.pool.where) ? spec.pool.where : null;
  const had = where && Array.isArray(where.teams) ? (where.teams as unknown[]).map(String) : null;
  if (!had) return spec;
  const was = await scopeTeams(seasonId, before.from, before.to);
  if (!was || [...was].sort().join() !== [...had].sort().join()) return spec;
  const now = await scopeTeams(seasonId, after.from, after.to);
  if (!now || [...now].sort().join() === [...had].sort().join()) return spec;
  return { ...spec, pool: { ...(spec.pool as object), where: { ...where, teams: now } } };
}
