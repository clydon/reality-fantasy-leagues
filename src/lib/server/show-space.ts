import { pool } from "./db";
import { gameName } from "./league-season";
import { visibleFollows, type FollowShare } from "./guard";
import type { LeagueRole } from "./roles";

// The pieces the new design's read endpoints are built from (/api/me/home, /api/couches/[id],
// /api/seasons/[id]/space): a season's header, the games (leagues) on a couch or a season, and who follows
// what. None of them reads a league's whole state: Neon meters every byte a query sends back (docs/HOSTING.md),
// so these take only the few fields they show.

export interface SeasonHeader {
  seasonId: string;
  seasonNumber: number;
  seasonName: string | null;
  status: "upcoming" | "airing" | "completed";
  episodeCount: number | null;
  premiereDate: string | null;
  /** How it's released: weekly (or nightly), or a streaming drop (step 14). */
  release: "weekly" | "nightly" | "binge";
  /** Set up as a game (shows.set_up_at, step 10): false is "Not a game yet", a show someone added to follow. */
  ready: boolean;
  show: { id: string; slug: string; name: string; kind: string; artUrl: string | null; terms: { castaway: string; tribe: string } };
}

/** Each season's header (show, number, status, art), by season id. */
export async function seasonHeaders(seasonIds: string[]): Promise<Map<string, SeasonHeader>> {
  const out = new Map<string, SeasonHeader>();
  const ids = [...new Set(seasonIds)];
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.name, ss.status, ss.episode_count, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date,
            ss.release, s.set_up_at IS NOT NULL AS ready,
            s.id AS show_id, s.slug, s.name AS show_name, s.kind, s.art_url, s.castaway_term, s.tribe_term
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.id = ANY($1::uuid[])`,
    [ids]
  );
  for (const r of rows) {
    out.set(r.id, {
      seasonId: r.id,
      seasonNumber: r.season_number,
      seasonName: r.name,
      status: r.status,
      episodeCount: r.episode_count,
      premiereDate: r.premiere_date,
      release: r.release,
      ready: r.ready,
      show: { id: r.show_id, slug: r.slug, name: r.show_name, kind: r.kind, artUrl: r.art_url, terms: { castaway: r.castaway_term, tribe: r.tribe_term } },
    });
  }
  return out;
}

export interface Game {
  leagueId: string;
  name: string;
  /** settings.leagueTypeId, unchanged ("active-roster"). */
  gameType: string;
  /** Its name in the new design ("Weekly Lineup"). */
  gameName: string;
  couchId: string | null;
  /** The season it plays, or null when it hasn't picked one in the catalog. */
  seasonId: string | null;
  /** Its linked group (league-groups.ts): one reveal and one chat. */
  groupId: string | null;
  /** The viewer's role in it, or null when they don't play it. */
  yourRole: LeagueRole | null;
  /** A game on no couch (step 9 part 3, db/migrations/0120): a season's public pool, or someone's practice couch. */
  solo: "public" | "practice" | null;
}

/**
 * Games, filtered by any of: the viewer plays them (`mine`), on these couches, on this season. In each group's
 * order (league-groups.ts), then by name. `withSolo`: with `couchIds`, the viewer's own solo games too (a public pool,
 * a practice couch: on no couch, but theirs wherever they look at the season), after the couch's.
 */
export async function games(viewerId: string, filter: { mine?: boolean; couchIds?: string[]; seasonId?: string; withSolo?: boolean }): Promise<Game[]> {
  const where: string[] = [];
  const params: unknown[] = [viewerId];
  if (filter.mine) where.push("me.user_id IS NOT NULL");
  if (filter.couchIds) {
    const onCouch = `l.couch_id = ANY($${params.push(filter.couchIds)}::uuid[])`;
    where.push(filter.withSolo ? `(${onCouch} OR (l.solo IS NOT NULL AND me.user_id IS NOT NULL))` : onCouch);
  }
  if (filter.seasonId) where.push(`ss.id = $${params.push(filter.seasonId)}`);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.couch_id, l.group_id, l.solo, l.state->'settings'->>'leagueTypeId' AS type_id, ss.id AS season_id, me.role AS your_role
       FROM leagues l
       LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
       LEFT JOIN league_memberships me ON me.league_id = l.id AND me.user_id = $1
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY l.solo NULLS FIRST, l.group_id NULLS LAST, l.group_position NULLS LAST, l.name, l.id`,
    params
  );
  return rows.map((r) => ({
    leagueId: r.id,
    name: r.name,
    gameType: r.type_id || "classic-draft",
    gameName: gameName(r.type_id),
    couchId: r.couch_id,
    seasonId: r.season_id,
    groupId: r.group_id,
    yourRole: r.your_role,
    solo: r.solo ?? null,
  }));
}

/**
 * What these people follow that the viewer may see (guard.ts visibleFollows): their own, and others' open ones.
 * Not how far anyone is: someone's own progress comes from guard.ts seenThrough, and others' isn't shared.
 */
export async function followsOf(viewerId: string, userIds: string[]): Promise<FollowShare[]> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT user_id AS "userId", season_id AS "seasonId", following, private FROM show_follows WHERE user_id = ANY($1::text[])`,
    [ids]
  );
  return visibleFollows(viewerId, rows);
}

/** Who plays which of these games: league id to its players' user ids. */
export async function playersOf(leagueIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(leagueIds.map((id) => [id, []]));
  if (!leagueIds.length) return out;
  const { rows } = await pool.query("SELECT league_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [leagueIds]);
  for (const r of rows) out.get(r.league_id)?.push(r.user_id);
  return out;
}
