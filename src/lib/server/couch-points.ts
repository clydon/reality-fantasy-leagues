import type { PointCount, PointKind } from "@/lib/game/couch-standings";
import { pool } from "./db";

// Couch points (the user, 2026-10-31; what each is worth: couch-standings.ts COUCH_POINTS): what everyone on a couch has done, by
// kind, counted from what the database already keeps, for the hub's power rankings (couch-hub.ts). In one read when the hub
// opens, never polled.
//
// On the couch itself whenever it was: joining it, starting and joining its games (not a stage inside one, not a deleted one),
// moves in them (a game's answers once an episode a seat, a blind draft's picks, a waiver claim with something in it), what's said
// in its chats (10 a day count), its polls, answering its watch along plans, reactions in its watch alongs (5 an episode count).
// On your own since you joined it: shows you follow openly (a private follow isn't the couch's to count), trivia rounds, bingo
// cards you've marked, Call it answers, episode ratings, days you opened the app (user_days, 0157). A day and a year are Eastern's
// (as desk-couches.ts counts a month), DST and all.

const ZONE = "America/New_York";

export interface CouchPointCounts {
  counts: PointCount[];
  /** The last seven days are all in this calendar year (so the year's table can say who moved since a week ago). */
  weekInYear: boolean;
}

export async function couchPointCounts(couchId: string, people: string[]): Promise<CouchPointCounts> {
  if (!people.length) return { counts: [], weekInYear: true };
  const { rows } = await pool.query(
    `WITH members AS (SELECT user_id, joined_at FROM couch_members WHERE couch_id = $1 AND user_id = ANY($2::text[])),
          games AS (SELECT id, created_by, created_at, stage_of FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL),
          seats AS (SELECT s.league_id, s.player_id, s.user_id, s.created_at FROM league_memberships s JOIN games g ON g.id = s.league_id JOIN members USING (user_id)),
          acts AS (
            SELECT user_id, 'couch' AS kind, joined_at AS at FROM members
            UNION ALL SELECT g.created_by, 'started', g.created_at FROM games g JOIN members m ON m.user_id = g.created_by WHERE g.stage_of IS NULL
            UNION ALL SELECT s.user_id, 'joined', s.created_at FROM seats s JOIN games g ON g.id = s.league_id WHERE g.stage_of IS NULL
            UNION ALL SELECT f.user_id, 'follow', f.created_at FROM show_follows f JOIN members USING (user_id) WHERE f.following AND NOT f.private
            UNION ALL SELECT t.user_id, 'trivia', t.played_at FROM trivia_plays t JOIN members m USING (user_id) WHERE t.played_at >= m.joined_at
            UNION ALL SELECT c.user_id, 'bingo', c.created_at FROM bingo_cards c JOIN members m USING (user_id)
                       WHERE c.created_at >= m.joined_at AND EXISTS (SELECT 1 FROM bingo_marks k WHERE k.card_id = c.id)
            UNION ALL SELECT p.user_id, 'plan', p.answered_at FROM watch_plan_people p JOIN watch_plans w ON w.id = p.plan_id JOIN members USING (user_id)
                       WHERE w.couch_id = $1 AND p.answered_at IS NOT NULL
            -- A move: a game's answers once an episode a seat (however many questions), by whoever answered (a shared seat's two
            -- each their own), else the seat's people.
            UNION ALL SELECT x.user_id, 'move', x.at FROM (
                        SELECT COALESCE(a.answered_by, s.user_id) AS user_id, min(a.created_at) AS at FROM game_answers a JOIN games g ON g.id = a.league_id
                          LEFT JOIN seats s ON s.league_id = a.league_id AND s.player_id = a.player_id
                         GROUP BY a.league_id, a.player_id, a.episode, COALESCE(a.answered_by, s.user_id)) x JOIN members USING (user_id)
            UNION ALL SELECT s.user_id, 'move', b.locked_at FROM blind_draft_picks b JOIN seats s ON s.league_id = b.league_id AND s.player_id = b.player_id
            UNION ALL SELECT s.user_id, 'move', w.updated_at FROM waiver_claims w JOIN seats s ON s.league_id = w.league_id AND s.player_id = w.player_id
                       WHERE w.pairs <> '[]'::jsonb OR w.pickup_ids <> '[]'::jsonb OR w.add_ids <> '[]'::jsonb
            UNION ALL SELECT c.user_id, 'call', c.created_at FROM episode_calls c JOIN members m USING (user_id) WHERE c.created_at >= m.joined_at
            UNION ALL SELECT v.user_id, 'poll', v.voted_at FROM couch_poll_votes v JOIN couch_polls p ON p.id = v.poll_id JOIN members USING (user_id) WHERE p.couch_id = $1
            UNION ALL SELECT r.user_id, 'rating', r.created_at FROM episode_ratings r JOIN members m USING (user_id) WHERE r.created_at >= m.joined_at
            UNION ALL SELECT user_id, 'chat', at FROM (
                        SELECT c.user_id, c.created_at AS at,
                               row_number() OVER (PARTITION BY c.user_id, (c.created_at AT TIME ZONE '${ZONE}')::date ORDER BY c.created_at) AS n
                          FROM chat_messages c JOIN members USING (user_id)
                         WHERE c.type = 'message' AND (c.league_id IN (SELECT id FROM games) OR (c.league_id IS NULL AND c.couch_id = $1))) x WHERE n <= 10
            UNION ALL SELECT user_id, 'reaction', at FROM (
                        SELECT r.user_id, r.created_at AS at, row_number() OVER (PARTITION BY r.user_id, r.season_id, r.episode ORDER BY r.created_at) AS n
                          FROM watch_reactions r JOIN members USING (user_id) WHERE r.couch_id = $1) x WHERE n <= 5
            UNION ALL SELECT d.user_id, 'day', d.day::timestamp AT TIME ZONE '${ZONE}' FROM user_days d JOIN members m USING (user_id)
                       WHERE d.day >= (m.joined_at AT TIME ZONE '${ZONE}')::date
          ),
          bounds AS (SELECT date_trunc('year', now() AT TIME ZONE '${ZONE}') AT TIME ZONE '${ZONE}' AS year_start)
     SELECT a.user_id, a.kind, count(*)::int AS "all",
            count(*) FILTER (WHERE a.at >= b.year_start)::int AS year,
            count(*) FILTER (WHERE a.at > now() - interval '7 days')::int AS week,
            bool_and(now() - interval '7 days' >= b.year_start) AS week_in_year
       FROM acts a CROSS JOIN bounds b
      GROUP BY a.user_id, a.kind`,
    [couchId, people]
  );
  return {
    counts: rows.map((r) => ({ userId: r.user_id as string, kind: r.kind as PointKind, all: r.all as number, year: r.year as number, week: r.week as number })),
    weekInYear: rows.length ? !!rows[0].week_in_year : true,
  };
}
