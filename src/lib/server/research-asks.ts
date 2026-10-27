import { ASKED_SLOT, RUNNING_STALE_MS, askedNext } from "@db/bot-research.js";
import { tellBotClock } from "./ask-bot";
import { pool, HttpError } from "./db";
import { latestEnded, seasonSchedules } from "./schedule";

// Results looked up for a show you watch (db/migrations/0152): a show made a game that nobody plays a game on, whose aired
// episodes have no results from anyone. Fill in what happened (episode-recaps.ts) asks for them along with its recaps: queued
// here and run by the bot's clock one at a time, each episode's full research complete before the next, in episode order
// (each one's question asks only about who's still in after the ones before it), two tries each (db/bot-research.js
// seasonAskNext). What's being asked now, and how far its answer has got, comes with the rest (the bot streams it:
// ask-bot.ts, 0153). Its
// answer is filed like a scheduled run's (bot-results.ts), so what's trusted becomes the season's results: the Cast tab counts
// stats from them and the Episodes tab shows them, to each person only as far as they've seen. Whoever asked hears as each
// one comes in (the cron route, push-events.ts notifyResearched).
//
// An episode looked up already can be asked again (0154; docs/PLAN-maker-scoring.md step 5): after its maker adds a moment
// with a question of its own, for just the new question ("missing") or everything ("full"), in the same queue and roll call.
//
// A season someone plays a game on is left to its games (Backstage, One tap, Autopilot): the people running them decide
// when results come in, and an answer filed here would reach every one of those games. A sport's results come from its
// sports data (sports/), never our bot.

/** Episodes one person may ask about in a day. */
export const ASKS_A_DAY = 60;

export type AskStatus = "waiting" | "asking" | "done" | "failed";

export interface AskedEpisode {
  episode: number;
  /** Its turn still to come, being looked up now, in, or not found after two tries. */
  status: AskStatus;
  /** How many results reached the season, once it's in. */
  found: number | null;
  /** Asked again, after it was looked up: for just the new question(s), or everything; null for its first ask. */
  again: "missing" | "full" | null;
}

/** What our bot is asking about right now, and how far it's got (db/bot-research.js progressFor, 0153). */
export interface ResearchNow {
  episode: number;
  stage: "waiting" | "opening" | "sending" | "asking" | "writing";
  /** People answered so far, of those asked about: only for someone who has seen the episode (how many are still in by
   *  then would give earlier exits away; episode-recaps.ts leaves them out for anyone else). */
  done: number | null;
  of: number | null;
  /** How far through it is, 0 to 1, for everyone (no head count in it). */
  share: number | null;
}

export interface ResultsResearch {
  /** Aired episodes with no results from anyone that nobody has asked about. */
  missing: number[];
  /** What's been asked, by episode. */
  asked: AskedEpisode[];
  now: ResearchNow | null;
}

interface Season {
  showId: string;
  seasonNumber: number;
}

/** The season, when results can be looked up for it here: a show made a game, not a sport, with a cast, that nobody plays. */
async function researchable(seasonId: string): Promise<Season | null> {
  const { rows } = await pool.query(
    `SELECT s.id AS show_id, ss.season_number, s.kind, s.set_up_at IS NOT NULL AS ready,
            EXISTS (SELECT 1 FROM season_cast sc WHERE sc.season_id = ss.id) AS has_cast,
            EXISTS (SELECT 1 FROM leagues l WHERE l.deleted_at IS NULL AND l.state->'settings'->>'showId' = s.slug
                       AND l.state->'settings'->>'wikiSeason' = ss.season_number::text) AS played
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  const r = rows[0];
  if (!r || !r.ready || r.kind === "sport" || !r.has_cast || r.played) return null;
  return { showId: r.show_id, seasonNumber: r.season_number };
}

/** Of these episodes, the ones nobody has sent any results for (a withdrawn answer doesn't count). */
async function withoutResults(seasonId: string, s: Season, episodes: number[]): Promise<number[]> {
  if (!episodes.length) return [];
  const { rows } = await pool.query(
    `SELECT n FROM unnest($4::int[]) AS n
      WHERE NOT EXISTS (SELECT 1 FROM episode_research er WHERE er.show_id = $2 AND er.season_number = $3 AND er.episode_number = n
                           AND er.source <> 'combined' AND er.withdrawn_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM season_decisions d WHERE d.season_id = $1 AND d.episode_number = n)
      ORDER BY n`,
    [seasonId, s.showId, s.seasonNumber, episodes]
  );
  return rows.map((r) => r.n as number);
}

interface AskRow {
  episode_number: number;
  mode: "missing" | "full" | null;
  asked_at: Date;
  done_at: Date | null;
  ok: boolean | null;
  found: number | null;
  tries: { started_at: string; ok: boolean | null }[];
}

/** Each ask's status: done or given up when it says so; else being asked while a try runs, given up once both tries failed
 *  (one cut off counts), else waiting its turn (or to try again). */
function statusOf(a: AskRow, now: Date): AskStatus {
  if (a.done_at) return a.ok ? "done" : "failed";
  if (!askedNext(a.asked_at, a.tries, now)) return "failed";
  const t = now.getTime();
  return a.tries.some((h) => h.ok == null && new Date(h.started_at).getTime() + RUNNING_STALE_MS > t) ? "asking" : "waiting";
}

const STAGES = new Set(["waiting", "opening", "sending", "asking", "writing"]);

/** Results for this season: what's missing and what's been asked; null where that isn't ours to do. */
export async function resultsResearch(seasonId: string, now = new Date()): Promise<ResultsResearch | null> {
  const s = await researchable(seasonId);
  if (!s) return null;
  const [schedules, { rows }, { rows: going }] = await Promise.all([
    seasonSchedules([seasonId], now),
    pool.query<AskRow>(
      `SELECT a.episode_number, a.mode, a.asked_at, a.done_at, a.ok, a.found,
              COALESCE(json_agg(json_build_object('started_at', r.started_at, 'ok', r.ok)) FILTER (WHERE r.id IS NOT NULL), '[]') AS tries
         FROM research_asks a
         LEFT JOIN bot_research_runs r ON r.season_id = a.season_id AND r.episode_number = a.episode_number AND r.slot = $2 AND r.started_at >= a.asked_at
        WHERE a.season_id = $1
        GROUP BY a.season_id, a.episode_number, a.mode, a.asked_at, a.done_at, a.ok, a.found
        ORDER BY a.episode_number`,
      [seasonId, ASKED_SLOT]
    ),
    // The run going now, with how far it's got.
    pool.query(
      `SELECT episode_number, progress FROM bot_research_runs
        WHERE season_id = $1 AND slot = $2 AND finished_at IS NULL AND started_at > $3
        ORDER BY started_at DESC LIMIT 1`,
      [seasonId, ASKED_SLOT, new Date(now.getTime() - RUNNING_STALE_MS)]
    ),
  ]);
  const schedule = schedules.get(seasonId);
  const ended = latestEnded(schedule, now);
  const aired = (schedule?.episodes ?? []).filter((e) => e.number >= 1 && e.number <= ended).map((e) => e.number);
  const asked = new Set(rows.map((r) => r.episode_number));
  const g = going[0];
  const p = (g?.progress ?? {}) as { stage?: string; done?: number; of?: number };
  return {
    missing: await withoutResults(seasonId, s, aired.filter((n) => !asked.has(n))),
    asked: rows.map((r) => {
      const status = statusOf(r, now);
      return { episode: r.episode_number, status, found: status === "done" ? r.found : null, again: r.mode ?? null };
    }),
    now: g
      ? {
          episode: g.episode_number,
          stage: (p.stage && STAGES.has(p.stage) ? p.stage : "sending") as ResearchNow["stage"],
          done: Number.isInteger(p.done) ? p.done! : null,
          of: Number.isInteger(p.of) ? p.of! : null,
          share: Number.isInteger(p.done) && Number.isInteger(p.of) && p.of! > 0 ? Math.min(1, p.done! / p.of!) : null,
        }
      : null,
  };
}

/**
 * Asks for every aired episode with no results, and again for any that failed; answers how many it asked about (0: none to
 * ask). The bot's clock is told at once (production's; a development server's check calls the cron route itself).
 */
export async function askResults(userId: string, seasonId: string, now = new Date()): Promise<number> {
  const r = await resultsResearch(seasonId, now);
  if (!r) return 0;
  const failed = r.asked.filter((a) => a.status === "failed").map((a) => a.episode);
  const episodes = [...r.missing, ...failed].sort((a, b) => a - b);
  if (!episodes.length) return 0;
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM research_asks WHERE asked_by = $1 AND asked_at > now() - interval '1 day'", [userId]);
  if (rows[0].n + episodes.length > ASKS_A_DAY) throw new HttpError(429, `That's more than ${ASKS_A_DAY} episodes' results in a day. Try again tomorrow.`);
  // One that failed starts over (its tries count from now); one waiting or being asked by now is left as it is.
  await pool.query(
    `INSERT INTO research_asks (season_id, episode_number, asked_by) SELECT $1, unnest($2::int[]), $3
     ON CONFLICT (season_id, episode_number) DO UPDATE
        SET asked_by = EXCLUDED.asked_by, asked_at = now(), done_at = NULL, ok = NULL, found = NULL, message = NULL
      WHERE research_asks.ok IS NOT TRUE AND research_asks.episode_number = ANY($4::int[])`,
    [seasonId, episodes, userId, failed]
  );
  await tellBotClock(now);
  return episodes.length;
}

/** Each episode with stored answers (the season's combined research), with the questions they have an answer to. */
export async function lookedUp(seasonId: string): Promise<{ episode: number; keys: string[] }[]> {
  const { rows } = await pool.query(
    `SELECT er.episode_number AS episode,
            ARRAY(SELECT DISTINCT k FROM jsonb_array_elements(CASE WHEN jsonb_typeof(er.payload->'castaways') = 'array' THEN er.payload->'castaways' ELSE '[]' END) c,
                         jsonb_object_keys(CASE WHEN jsonb_typeof(c) = 'object' THEN c ELSE '{}' END) k) AS keys
       FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE ss.id = $1 AND er.source = 'combined'
      ORDER BY 1`,
    [seasonId]
  );
  return rows as { episode: number; keys: string[] }[];
}

/**
 * Asks again about episodes looked up already: for just what their answers have nothing for ("missing", worked out when each
 * runs) or everything ("full"). One done or given up starts over; one waiting or being asked keeps its turn, everything again
 * winning over just what's new (its first ask is everything already). Answers how many it asked about.
 */
export async function askAgain(userId: string, seasonId: string, episodes: number[], mode: "missing" | "full", now = new Date()): Promise<number> {
  const r = await resultsResearch(seasonId, now);
  if (!r || !episodes.length) return 0;
  const open = r.asked.filter((a) => a.status === "waiting" || a.status === "asking").map((a) => a.episode);
  const fresh = episodes.filter((n) => !open.includes(n));
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM research_asks WHERE asked_by = $1 AND asked_at > now() - interval '1 day'", [userId]);
  if (rows[0].n + fresh.length > ASKS_A_DAY) throw new HttpError(429, `That's more than ${ASKS_A_DAY} episodes' results in a day. Try again tomorrow.`);
  await pool.query(
    `INSERT INTO research_asks (season_id, episode_number, asked_by, mode) SELECT $1, unnest($2::int[]), $3, $4
     ON CONFLICT (season_id, episode_number) DO UPDATE
        SET asked_by = EXCLUDED.asked_by,
            asked_at = CASE WHEN research_asks.episode_number = ANY($5::int[]) THEN research_asks.asked_at ELSE now() END,
            done_at = NULL, ok = NULL, found = NULL, message = NULL,
            mode = CASE WHEN research_asks.episode_number = ANY($5::int[]) AND research_asks.mode IS DISTINCT FROM 'missing' THEN research_asks.mode
                        ELSE EXCLUDED.mode END`,
    [seasonId, episodes, userId, mode, open]
  );
  await tellBotClock(now);
  return episodes.length;
}
