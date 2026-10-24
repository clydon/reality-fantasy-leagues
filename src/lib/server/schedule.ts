import * as Air from "@/lib/game/air-schedule.js";
import { pool } from "./db";

// A season's episodes as the new design lists them (the show header, Up next, later the guide), on the same
// clock lineups lock by: air-schedule.js episodeAirTime over the season_air_dates view (research's exact
// starts, then the wiki's dates, then weekly from the premiere). With each episode's length (research), and
// its title and note (season_episodes, else the wiki's title). Nothing here is a spoiler: when it airs, how
// long it runs and the title the listings carry.
//
// Weekly guesses are computed here, never stored (db/migrations/0104 says why).

export interface ScheduledEpisode {
  number: number;
  /** When it starts (UTC ISO), or null when there's nothing to go on. */
  airAt: string | null;
  /** How long it runs: research's figure for this episode, else the season's episode length (0066). */
  runtimeMin: number | null;
  title: string | null;
  note: string | null;
}

export interface SeasonSchedule {
  release: "weekly" | "nightly" | "binge";
  dropAt: string | null;
  airTz: string;
  episodeCount: number | null;
  episodes: ScheduledEpisode[];
}

/** How long an episode is taken to run when neither research nor the season says (0066: null means an hour). */
export const DEFAULT_RUNTIME_MIN = 60;
// How far ahead a season with no episode count lists episodes, and its most.
const LOOKAHEAD_MS = 8 * 24 * 3600 * 1000;
const MAX_EPISODES = 100;

const keys = (o: Record<string, unknown> | null | undefined) => Object.keys(o || {}).map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** The schedules of these seasons, by season id (a season that doesn't exist is absent). */
export async function seasonSchedules(seasonIds: string[], now = new Date()): Promise<Map<string, SeasonSchedule>> {
  const out = new Map<string, SeasonSchedule>();
  const ids = [...new Set(seasonIds)];
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT ss.id, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            ss.release, ss.drop_at, ss.episode_count, ss.episode_minutes, ss.status, sad.air_dates, sad.runtimes,
            (SELECT jsonb_object_agg(se.number::text, jsonb_build_object('title', se.title, 'note', se.note))
               FROM season_episodes se WHERE se.season_id = ss.id AND (se.title IS NOT NULL OR se.note IS NOT NULL)) AS extra,
            (SELECT jsonb_object_agg(e->>'number', e->>'title')
               FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
              WHERE we.show_id = ss.show_id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                AND e->>'title' IS NOT NULL AND e->>'number' IS NOT NULL) AS wiki_titles
       FROM show_seasons ss LEFT JOIN season_air_dates sad ON sad.season_id = ss.id
      WHERE ss.id = ANY($1::uuid[])`,
    [ids]
  );
  for (const r of rows) {
    const season = { premiereDate: r.premiere_date, airTime: r.air_time, airTz: r.air_tz, release: r.release, dropAt: r.drop_at };
    const dates = (r.air_dates || {}) as Record<string, string>;
    const runtimes = (r.runtimes || {}) as Record<string, number>;
    const extra = (r.extra || {}) as Record<string, { title: string | null; note: string | null }>;
    const wikiTitles = (r.wiki_titles || {}) as Record<string, string>;
    const airAt = (n: number) => Air.episodeAirTime(season, n, dates);

    let last = r.episode_count as number | null;
    if (!last) {
      last = Math.max(0, ...keys(dates), ...keys(runtimes), ...keys(extra), ...keys(wikiTitles));
      // A season still on the air lists through what's coming up in the next week, so Up next has it.
      if (r.status !== "completed" && r.release !== "binge") {
        const horizon = now.getTime() + LOOKAHEAD_MS;
        for (let n = last + 1; n <= MAX_EPISODES; n++) {
          const at = airAt(n);
          if (!at) break;
          last = n;
          if (at.getTime() > horizon) break;
        }
      }
    }
    const episodes: ScheduledEpisode[] = [];
    for (let n = 1; n <= Math.min(last, MAX_EPISODES); n++) {
      const at = airAt(n);
      episodes.push({
        number: n,
        airAt: at ? at.toISOString() : null,
        runtimeMin: Number.isInteger(runtimes[n]) ? runtimes[n] : ((r.episode_minutes as number | null) ?? null),
        title: extra[n]?.title ?? wikiTitles[n] ?? null,
        note: extra[n]?.note ?? null,
      });
    }
    out.set(r.id, {
      release: r.release,
      dropAt: r.drop_at ? new Date(r.drop_at).toISOString() : null,
      airTz: r.air_tz,
      episodeCount: r.episode_count ?? null,
      episodes,
    });
  }
  return out;
}

/** The episode on now or coming up next (the first that hasn't finished), and whether it's on now. */
export function upNext(schedule: SeasonSchedule | undefined, now = new Date()): (ScheduledEpisode & { live: boolean }) | null {
  for (const ep of schedule?.episodes ?? []) {
    if (!ep.airAt) continue;
    const start = new Date(ep.airAt).getTime();
    const end = start + (ep.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000;
    if (end > now.getTime()) return { ...ep, live: start <= now.getTime() };
  }
  return null;
}

/** The latest episode that has aired (started), or 0. */
export function latestAired(schedule: SeasonSchedule | undefined, now = new Date()): number {
  let n = 0;
  for (const ep of schedule?.episodes ?? []) if (ep.airAt && new Date(ep.airAt).getTime() <= now.getTime()) n = ep.number;
  return n;
}
