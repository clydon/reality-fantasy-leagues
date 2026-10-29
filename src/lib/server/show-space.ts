import { cardArtSql, framedCard, framedHeader } from "./art-sql";
import { pool } from "./db";
import { gameName } from "./league-season";
import { sharingOf, visibleFollows, type FollowShare } from "./guard";
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
  /** When a streaming season drops every episode (step 14), else null. */
  dropAt: string | null;
  /** Set up as a game (shows.set_up_at, step 10): false is "Not a game yet", a show someone added to follow. */
  ready: boolean;
  show: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    /** The season's poster, else the show's (cards and tiles; the show's link over both: shows.art_link); null while the show's
     *  art is off. Its framing rides on it (src/lib/art-frame.ts: ShowArt draws it). */
    artUrl: string | null;
    /** A landscape image for headers and wide cards (TMDB's backdrop or the desk's: show-art.ts), framed as the cards are;
     *  null without one. */
    backdropUrl: string | null;
    /** What it calls its people, their groups and its episodes (0142: "Game" for a baseball series): lib/game/show-words.ts. */
    terms: { castaway: string; people: string | null; tribe: string; episode: string };
    tvmazeId: number | null;
    /** Where it airs, from its TV listing: the network, else the streaming service ("Netflix"; step 14); null without one. */
    network: string | null;
  };
}

/** Each season's header (show, number, status, art), by season id. */
export async function seasonHeaders(seasonIds: string[]): Promise<Map<string, SeasonHeader>> {
  const out = new Map<string, SeasonHeader>();
  const ids = [...new Set(seasonIds)];
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.name, ss.status, ss.episode_count, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date,
            ss.release, ss.drop_at, s.set_up_at IS NOT NULL AS ready,
            s.id AS show_id, s.slug, s.name AS show_name, s.kind, ${cardArtSql()} AS art_url, s.art_url AS own_art, s.art_style,
            CASE WHEN s.art_off THEN NULL ELSE s.backdrop_url END AS backdrop_url, s.backdrop_style, s.castaway_term, s.castaway_plural, s.tribe_term, s.episode_term, s.tvmaze_id, s.listing->>'network' AS network
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
      dropAt: r.drop_at ? new Date(r.drop_at).toISOString() : null,
      ready: r.ready,
      show: {
        id: r.show_id,
        slug: r.slug,
        name: r.show_name,
        kind: r.kind,
        artUrl: framedCard(r.art_url, r.art_style, r.own_art),
        backdropUrl: framedHeader(r.backdrop_url, r.backdrop_style),
        terms: { castaway: r.castaway_term, people: r.castaway_plural ?? null, tribe: r.tribe_term, episode: r.episode_term },
        tvmazeId: r.tvmaze_id ?? null,
        network: r.network ?? null,
      },
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
  /** Archived (step 10 part 2b, settings.archivedAt): on the couch and the trophy shelf as it stood; nothing scores it. */
  archived: boolean;
  /** A game over a span (settings.startEpisode through settings.endEpisode; docs/PLAN-sports-data.md step 6), or null: to the
   *  season's end (or a game still waiting for its phase: its span isn't known yet). */
  span: { from: number; to: number } | null;
  /** The episode it starts with (settings.startEpisode): a game started after a span ended is its run back. Null while a game
   *  that starts at a phase of the season (settings.startPhase: step A3 of docs/PLAN-start-a-game-gpt.md) waits for it. */
  start: number | null;
}

/**
 * Games, filtered by any of: the viewer plays them (`mine`), on these couches, on this season, this one (`leagueId`). In each group's
 * order (league-groups.ts), then by name. `withSolo`: with `couchIds`, the viewer's own solo games too (a public pool,
 * a practice couch: on no couch, but theirs wherever they look at the season), after the couch's.
 */
export async function games(viewerId: string, filter: { mine?: boolean; couchIds?: string[]; seasonId?: string; withSolo?: boolean; leagueId?: string }): Promise<Game[]> {
  // A deleted game (step 10 part 2b, db/migrations/0123) is nobody's until it's restored from Recent changes.
  const where: string[] = ["l.deleted_at IS NULL"];
  const params: unknown[] = [viewerId];
  if (filter.mine) where.push("me.user_id IS NOT NULL");
  if (filter.couchIds) {
    const onCouch = `l.couch_id = ANY($${params.push(filter.couchIds)}::uuid[])`;
    where.push(filter.withSolo ? `(${onCouch} OR (l.solo IS NOT NULL AND me.user_id IS NOT NULL))` : onCouch);
  }
  if (filter.seasonId) where.push(`ss.id = $${params.push(filter.seasonId)}`);
  if (filter.leagueId) where.push(`l.id = $${params.push(filter.leagueId)}`);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.couch_id, l.group_id, l.solo, l.state->'settings'->>'leagueTypeId' AS type_id, ss.id AS season_id, me.role AS your_role,
            COALESCE(l.state->'settings'->>'archivedAt', '') <> '' AS archived,
            l.state->'settings'->'startEpisode' AS start_episode, l.state->'settings'->'endEpisode' AS end_episode,
            l.state->'settings'->>'startPhase' AS start_phase
       FROM leagues l
       LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
       LEFT JOIN league_memberships me ON me.league_id = l.id AND me.user_id = $1
      WHERE ${where.join(" AND ")}
      ORDER BY l.solo NULLS FIRST, l.group_id NULLS LAST, l.group_position NULLS LAST, l.name, l.id`,
    params
  );
  // A phase start with no episode yet waits for its phase (state-logic.js startEpisode); else no start is Episode 1.
  const startOf = (r: { start_episode: unknown; start_phase: string | null }) => (Number.isInteger(r.start_episode) ? (r.start_episode as number) : r.start_phase ? null : 1);
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
    archived: !!r.archived,
    span: Number.isInteger(r.end_episode) && startOf(r) !== null ? { from: startOf(r) as number, to: r.end_episode } : null,
    start: startOf(r),
  }));
}

/**
 * What these people follow that the viewer may see (guard.ts visibleFollows): their own, and others' open ones that they share
 * Where I am on (step 15 part 3's What your couch sees). Each with how far they are (`seen`, their mark): shown only for a follow
 * they share, so it's there only where the follow is. Someone's own progress for spoilers is guard.ts seenThrough, not this.
 */
export async function followsOf(viewerId: string, userIds: string[]): Promise<(FollowShare & { seen: number })[]> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return [];
  const [{ rows }, sharing] = await Promise.all([
    pool.query(
      `SELECT user_id AS "userId", season_id AS "seasonId", following, private, seen_through AS seen FROM show_follows WHERE user_id = ANY($1::text[])`,
      [ids]
    ),
    sharingOf(ids.filter((id) => id !== viewerId)),
  ]);
  return visibleFollows(viewerId, rows as (FollowShare & { seen: number })[], sharing);
}

/** Who plays which of these games: league id to its players' user ids. */
export async function playersOf(leagueIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(leagueIds.map((id) => [id, []]));
  if (!leagueIds.length) return out;
  const { rows } = await pool.query("SELECT league_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [leagueIds]);
  for (const r of rows) out.get(r.league_id)?.push(r.user_id);
  return out;
}
