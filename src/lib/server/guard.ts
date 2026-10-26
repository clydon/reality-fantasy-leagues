import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { leagueStates } from "./league-states";

// The spoiler guard, server side (docs/PLAN-new-design.md step 0b; the mock's guard.js rules). Every read
// endpoint of the new design trims what it sends through here, so nothing past someone's episode leaves the
// server, whatever the screen does with it:
//   1. Time: nothing after the episode they've seen (show_follows.seen_through), and an unknown episode is
//      episode 0 (fail closed). Something with no known episode isn't sent at all.
//   2. Secrets: a format's secret roles (the Traitors' faction) only for people who have left by then.
//   3. Sharing: what someone's couches see of them (shares). For now only a show watched privately is
//      hidden; step 15's What your couch sees adds its levels here.

/** Seen through everything: someone who turned spoiler protection off. */
export const EVERYTHING = Number.POSITIVE_INFINITY;

type Queryable = { query: typeof pool.query };

/**
 * How far someone can be told about, from their follow's mark and the classic account setting: someone who
 * sees results straight away (user_settings.show_results_immediately) sees everything on a season where they
 * play an ordinary seat, as classic shows it them. A late joiner always goes by their mark, whatever the
 * setting (results-seen.ts), and so does a season they only follow.
 */
export function progressFrom(mark: number | null | undefined, immediate: boolean, seats: { lateJoiner: boolean }[]): number {
  if (immediate && seats.some((s) => !s.lateJoiner)) return EVERYTHING;
  return Number.isInteger(mark) && (mark as number) > 0 ? (mark as number) : 0;
}

/** The last episode this person may be told about on this season. */
export async function seenThrough(userId: string, seasonId: string, db: Queryable = pool): Promise<number> {
  const { rows } = await db.query(
    `SELECT (SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2) AS mark,
            COALESCE((SELECT show_results_immediately FROM user_settings WHERE user_id = $1), false) AS immediate`,
    [userId, seasonId]
  );
  const mark = rows[0]?.mark as number | null;
  const immediate = !!rows[0]?.immediate;
  if (!immediate) return progressFrom(mark, false, []);
  const { rows: seats } = await db.query(
    `SELECT l.id, m.player_id FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
      WHERE m.user_id = $1 AND ss.id = $2`,
    [userId, seasonId]
  );
  const states = await leagueStates(seats.map((s) => s.id));
  return progressFrom(
    mark,
    true,
    seats.filter((s) => states.has(s.id)).map((s) => ({ lateJoiner: !!StateLogic.GhostLogic.lateJoinOf(states.get(s.id) as LeagueState, s.player_id) }))
  );
}

/**
 * seenThrough for every season this person has a mark on (their follows, and the seasons they play), in one query; someone
 * who sees results straight away has each season asked as seenThrough asks it. A season not in the map is episode 0.
 */
export async function seenThroughAll(userId: string, db: Queryable = pool): Promise<Map<string, number>> {
  const { rows } = await db.query(
    `SELECT f.season_id, f.seen_through,
            COALESCE((SELECT show_results_immediately FROM user_settings WHERE user_id = $1), false) AS immediate
       FROM show_follows f WHERE f.user_id = $1`,
    [userId]
  );
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.season_id as string, r.immediate ? await seenThrough(userId, r.season_id, db) : progressFrom(r.seen_through, false, []));
  return out;
}

/** What can be said of an episode: its number when it's within what they've seen, else null. */
export function withinSeen(episode: number | null | undefined, seen: number): number | null {
  return Number.isInteger(episode) && (episode as number) <= seen ? (episode as number) : null;
}

/** Only what happened by episode `seen`; anything whose episode isn't known is left out. */
export function throughEpisode<T>(items: T[], seen: number, episodeOf: (item: T) => number | null | undefined): T[] {
  return items.filter((item) => withinSeen(episodeOf(item), seen) !== null);
}

/** The fields of a person a format keeps secret until they've left the game: the Traitors' role. */
export function secretFields(format: { roles?: unknown } | null | undefined): string[] {
  return format?.roles ? ["role"] : [];
}

/**
 * A person as they may be shown by episode `seen`: their secret fields (secretFields) only once they've left by
 * then. Everyone else's are taken off, so a secret can't be read, or filtered on, before the show gives it away.
 */
export function withoutSecrets<T extends { exitEpisode?: number | null }>(person: T, format: { roles?: unknown } | null | undefined, seen: number): T {
  const secret = secretFields(format);
  if (!secret.length || withinSeen(person.exitEpisode, seen) !== null) return person;
  const out = { ...person } as Record<string, unknown>;
  for (const f of secret) delete out[f];
  return out as T;
}

export interface FollowShare {
  userId: string;
  seasonId: string;
  following: boolean;
  private: boolean;
}

/** The follows a viewer may see: their own, and everyone else's that they follow openly. */
export function visibleFollows<T extends FollowShare>(viewerId: string, follows: T[]): T[] {
  return follows.filter((f) => f.userId === viewerId || (f.following && !f.private));
}

export type Shareable = { kind: "follow"; seasonId: string };

/** Whether `memberId` shares `what` with `viewerId`. Someone always sees their own. */
export async function shares(viewerId: string, memberId: string, what: Shareable, db: Queryable = pool): Promise<boolean> {
  if (viewerId === memberId) return true;
  const { rows } = await db.query("SELECT following, private FROM show_follows WHERE user_id = $1 AND season_id = $2", [memberId, what.seasonId]);
  return !!rows.length && visibleFollows(viewerId, [{ userId: memberId, seasonId: what.seasonId, following: rows[0].following, private: rows[0].private }]).length === 1;
}
