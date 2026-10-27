import { ASKED_QUICK_SLOT, ASKED_SLOT, RUNNING_STALE_MS, askedNext } from "@db/bot-research.js";
import { tellBotClock } from "./ask-bot";
import { pool, HttpError } from "./db";
import { latestEnded, seasonSchedules } from "./schedule";

// Results looked up for a show you watch (db/migrations/0152): a show made a game that nobody plays a game on, whose aired
// episodes have no results from anyone. Fill in what happened (episode-recaps.ts) asks for them along with its recaps: queued
// here and run by the bot's clock one at a time, who went home in each first (a short question each, so who's out shows
// across the season within minutes), then each episode's full research in episode order (each one's question asks only about
// who's still in after the ones before it), two tries each (db/bot-research.js seasonAskNext). What's being asked now, and
// how far its answer has got, comes with the rest (the bot streams it: ask-bot.ts, 0153). Its
// answer is filed like a scheduled run's (bot-results.ts), so what's trusted becomes the season's results: the Cast tab counts
// stats from them and the Episodes tab shows them, to each person only as far as they've seen. Whoever asked hears as each
// one comes in (the cron route, push-events.ts notifyResearched).
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
  /** Who went home in it is in (its short question first, or any results), so the Cast tab shows who's out; everyone's
   *  results may still be to come. */
  out: boolean;
  /** Its who-went-home question has been asked, whatever it found: an answer of nobody (or one it couldn't be sure of)
   *  applies nothing on its own, and the full results settle it. */
  checked: boolean;
  /** How many results reached the season, once it's in. */
  found: number | null;
}

/** What our bot is asking about right now, and how far it's got (db/bot-research.js progressFor, 0153). */
export interface ResearchNow {
  episode: number;
  /** Who went home (a short question) or everyone's results. */
  part: "who" | "full";
  stage: "waiting" | "opening" | "sending" | "asking" | "writing";
  /** Everyone's results: people answered so far, of those asked about. */
  done: number | null;
  of: number | null;
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
  asked_at: Date;
  done_at: Date | null;
  ok: boolean | null;
  found: number | null;
  tries: { started_at: string; ok: boolean | null }[];
  quick_tries: { started_at: string; ok: boolean | null }[];
  has_results: boolean;
}

/** Each ask's status: done or given up when it says so; else being asked while a try runs (who went home's or the full
 *  one's), given up once both full tries failed (one cut off counts), else waiting its turn (or to try again). */
function statusOf(a: AskRow, now: Date): AskStatus {
  if (a.done_at) return a.ok ? "done" : "failed";
  if (!askedNext(a.asked_at, a.tries, now)) return "failed";
  const t = now.getTime();
  const running = (h: { started_at: string; ok: boolean | null }) => h.ok == null && new Date(h.started_at).getTime() + RUNNING_STALE_MS > t;
  return a.tries.some(running) || a.quick_tries.some(running) ? "asking" : "waiting";
}

const STAGES = new Set(["waiting", "opening", "sending", "asking", "writing"]);

/** Results for this season: what's missing and what's been asked; null where that isn't ours to do. */
export async function resultsResearch(seasonId: string, now = new Date()): Promise<ResultsResearch | null> {
  const s = await researchable(seasonId);
  if (!s) return null;
  const [schedules, { rows }, { rows: going }] = await Promise.all([
    seasonSchedules([seasonId], now),
    pool.query<AskRow>(
      `SELECT a.episode_number, a.asked_at, a.done_at, a.ok, a.found,
              COALESCE(json_agg(json_build_object('started_at', r.started_at, 'ok', r.ok)) FILTER (WHERE r.slot = $2), '[]') AS tries,
              COALESCE(json_agg(json_build_object('started_at', r.started_at, 'ok', r.ok)) FILTER (WHERE r.slot = $3), '[]') AS quick_tries,
              EXISTS (SELECT 1 FROM episode_research er WHERE er.show_id = $4 AND er.season_number = $5 AND er.episode_number = a.episode_number
                         AND er.source <> 'combined' AND er.withdrawn_at IS NULL) AS has_results
         FROM research_asks a
         LEFT JOIN bot_research_runs r ON r.season_id = a.season_id AND r.episode_number = a.episode_number AND r.slot IN ($2, $3) AND r.started_at >= a.asked_at
        WHERE a.season_id = $1
        GROUP BY a.season_id, a.episode_number, a.asked_at, a.done_at, a.ok, a.found
        ORDER BY a.episode_number`,
      [seasonId, ASKED_SLOT, ASKED_QUICK_SLOT, s.showId, s.seasonNumber]
    ),
    // The run going now, with how far it's got.
    pool.query(
      `SELECT episode_number, slot, progress FROM bot_research_runs
        WHERE season_id = $1 AND slot IN ($2, $3) AND finished_at IS NULL AND started_at > $4
        ORDER BY started_at DESC LIMIT 1`,
      [seasonId, ASKED_SLOT, ASKED_QUICK_SLOT, new Date(now.getTime() - RUNNING_STALE_MS)]
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
      const checked = r.has_results || r.quick_tries.some((h) => h.ok != null) || r.tries.length > 0;
      return { episode: r.episode_number, status, out: r.has_results, checked, found: status === "done" ? r.found : null };
    }),
    now: g
      ? {
          episode: g.episode_number,
          part: g.slot === ASKED_QUICK_SLOT ? "who" : "full",
          stage: (p.stage && STAGES.has(p.stage) ? p.stage : "sending") as ResearchNow["stage"],
          done: Number.isInteger(p.done) ? p.done! : null,
          of: Number.isInteger(p.of) ? p.of! : null,
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
