import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { pool } from "../db";

// The games you play, by their provider's ids (docs/PLAN-sports-couch.md A1, the hub's scores strip): each linked game of a sports
// season one of your games is on, from two days back to two weeks on, inside that game's span (a Pick'em on one game is that game,
// never its season's others), with your pick on it when you've made one: the side your answer names (a team's id, as a sports
// Pick'em asks it: answers.ts factFaces). Three small reads, no state written; the strip reads it once a hub load.

export interface MyGame {
  league: string;
  event: string;
  seasonId: string;
  episode: number;
  leagueId: string;
  /** The side you picked (its team id), when an answer of yours on this game names one of its teams. */
  pick: string | null;
}

export async function myGames(userId: string): Promise<MyGame[]> {
  const { rows } = await pool.query(
    `SELECT e.league, e.event_id, ss.id AS season_id, e.episode, l.id AS league_id, m.player_id, e.teams, l.state
       FROM league_memberships m
       JOIN leagues l ON l.id = m.league_id AND l.deleted_at IS NULL
       ${LEAGUE_SEASON_JOIN}
       JOIN season_events e ON e.season_id = ss.id
      WHERE m.user_id = $1 AND e.starts_at > now() - interval '2 days' AND e.starts_at < now() + interval '15 days'`,
    [userId]
  );
  // Inside each game's span, and never an archived one.
  const inSpan = rows.filter((r) => {
    const state = r.state as LeagueState & { settings?: { archivedAt?: string | null } };
    if (state.settings?.archivedAt) return false;
    const from = StateLogic.startEpisode(state);
    const to = StateLogic.endEpisode(state);
    return (from == null || r.episode >= from) && (to == null || r.episode <= to);
  });
  const picks = new Map<string, unknown[]>();
  if (inSpan.length) {
    const { rows: answers } = await pool.query(
      `SELECT a.league_id, a.episode, a.answer FROM game_answers a
         JOIN unnest($1::uuid[], $2::text[], $3::int[]) AS w(league_id, player_id, episode)
           ON a.league_id = w.league_id AND a.player_id = w.player_id AND a.episode = w.episode`,
      [inSpan.map((r) => r.league_id), inSpan.map((r) => r.player_id), inSpan.map((r) => r.episode)]
    );
    for (const a of answers) {
      const k = `${a.league_id}|${a.episode}`;
      picks.set(k, [...(picks.get(k) ?? []), a.answer]);
    }
  }
  const out = new Map<string, MyGame>();
  for (const r of inSpan) {
    const teams = new Set((Array.isArray(r.teams) ? r.teams : []).map((t: { id?: unknown }) => String(t?.id ?? "")).filter(Boolean));
    const named = (picks.get(`${r.league_id}|${r.episode}`) ?? []).flat().map(String).find((x) => teams.has(x)) ?? null;
    const had = out.get(r.event_id);
    // One row a game: the first game of yours on it, with a pick if any of them has one.
    if (!had) out.set(r.event_id, { league: r.league, event: r.event_id, seasonId: r.season_id, episode: r.episode, leagueId: r.league_id, pick: named });
    else if (!had.pick && named) had.pick = named;
  }
  return [...out.values()];
}

/** A sports season a game of yours or of your couches' is on, and its league ("football/nfl"). */
export interface SportSeason {
  seasonId: string;
  league: string;
}

/**
 * The sports seasons your games and your couches' games are on, each with its league (docs/PLAN-sports-couch.md A2: a league's card
 * in Your shows says what the couch has going in that league, so it needs to know which of the couch's games are in it). One small
 * read: your memberships and your couches' games, joined to their seasons' shows.
 */
export async function mySportSeasons(userId: string): Promise<SportSeason[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ss.id AS season_id, s.sports_league
       FROM leagues l
       ${LEAGUE_SEASON_JOIN}
      WHERE l.deleted_at IS NULL AND l.state->'settings'->>'archivedAt' IS NULL AND s.kind = 'sport' AND s.sports_league IS NOT NULL
        AND (l.id IN (SELECT league_id FROM league_memberships WHERE user_id = $1)
             OR l.couch_id IN (SELECT couch_id FROM couch_members WHERE user_id = $1))`,
    [userId]
  );
  // shows.sports_league is the provider's tag ("espn:football/nfl"): the league is its path.
  return rows.map((r) => ({ seasonId: r.season_id as string, league: String(r.sports_league).replace(/^[a-z]+:/, "") }));
}
