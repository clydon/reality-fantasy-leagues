import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { hitOf, kindOf, pickSeason, sameShow, type TvSeason } from "@/lib/game/listing";
import { easternDay, listingDays, scheduleRows, weekListings, type ListingRow, type ScheduleShow, type WeekListing } from "@/lib/game/tv-listings";
import { listedSeason, termsOf } from "./add-show";
import { sweepArt, type ArtSweep } from "./show-art";
import { pool } from "./db";
import { isTvmaze, ListingsUnavailable, scheduleDay, showListing, updatedShows, webScheduleDay } from "./listings";

// All of TV and the daily listings job (docs/PLAN-new-design.md step 11 part 2; docs/HOSTING.md). Once a day:
//   1. the week on TV: eight days of TVmaze's US schedule and streaming into tv_listings (the evening and drops, in English,
//      never the news: src/lib/game/tv-listings.ts), which the guide's Also on reads through /api/listings/week;
//   2. listing seasons kept current: a season made from its listing reads its episodes again when TVmaze says its show
//      changed (/updates/shows), and its status moves on by date; a listed show's next season is made when the listings
//      announce it (dated), playing by last season's rulebook when the show is a game (ensureSeasonRulebook);
//   3. a show here with no listing is linked to one in the week's schedule with the same name (sameShow, one listing only):
//      a show someone added by name, whose empty first season then takes the listing's, or one an admin set up before the
//      listings came in, which only gains the link (as Add a show links it: add-show.ts showForListing), so the guide knows it.
// Research's and an admin's rows are never written over (add-show.ts listedSeason). It runs at most once a day (an Eastern
// day), after the response of a bot clock call that ran no bot job (/api/cron/bot-research: the VM calls it at least every
// six hours, and that call has woken the database anyway), or by hand (/api/cron/listings). Its last run is app_settings
// 'listings'.

const KEY = "listings";
/** Shows read again in one run (a call each, and one per season read). */
const MAX_SHOWS = 40;
/** A finished season is still read for a fortnight after its finale (late corrections to its air times). */
const FINISHED_DAYS = 14;
/** Calls to TVmaze itself are spaced so a run stays under its limit (20 calls every 10 seconds). */
const GAP_MS = 700;

export interface ListingsRun {
  /** The Eastern day it ran for. */
  day: string;
  at: string;
  done: string | null;
  ok: boolean | null;
  how: "clock" | "hand" | "cron";
  /** Days read, and any TVmaze didn't answer for (their old rows are kept). */
  days?: number;
  failedDays?: string[];
  rows?: number;
  /** Listing seasons whose status moved on by date. */
  statuses?: number;
  /** Shows TVmaze said changed that are listing shows here; seasons read again; seasons made. */
  updated?: number;
  seasons?: number;
  made?: number;
  /** Shows here with no listing, now linked to one by name. */
  linked?: number;
  /** When listing seasons were last kept current (carried from run to run until a run does it). */
  keptAt?: string;
  /** Shows and seasons given art, and cast photos found (show-art.ts sweepArt). */
  art?: ArtSweep;
  errors?: string[];
}

/** The last run (or the one running), or null when it has never run. */
export async function lastRun(): Promise<(ListingsRun & { updatedAt: string }) | null> {
  const { rows } = await pool.query("SELECT value, updated_at FROM app_settings WHERE key = $1", [KEY]);
  return rows[0] ? { ...(rows[0].value as ListingsRun), updatedAt: (rows[0].updated_at as Date).toISOString() } : null;
}

/** Whether today's run is still to do: none yet today (Eastern), or the last failed (or stopped) over an hour ago. */
export async function listingsDue(now = new Date()): Promise<boolean> {
  const last = await lastRun();
  if (!last) return true;
  if (last.day !== easternDay(now)) return true;
  return last.ok !== true && now.getTime() - Date.parse(last.updatedAt) > 3600_000;
}

/** Take the day's run (one at a time: a run that started under five minutes ago and hasn't finished holds it). */
async function claim(run: ListingsRun, force: boolean): Promise<boolean> {
  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      WHERE NOT (app_settings.value->>'done' IS NULL AND app_settings.updated_at > now() - interval '5 minutes')
        AND ($4 OR app_settings.value->>'day' IS DISTINCT FROM $3
             OR (COALESCE(app_settings.value->>'ok', 'false') = 'false' AND app_settings.updated_at < now() - interval '1 hour'))
     RETURNING key`,
    [KEY, JSON.stringify(run), run.day, force]
  );
  return rows.length > 0;
}

function pacer(base: string) {
  if (!isTvmaze(base)) return async () => {};
  let last = 0;
  return async () => {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  };
}

/** The days read replace their rows; days gone by (before yesterday) go. */
async function writeRows(rows: ListingRow[], read: string[], keepFrom: string): Promise<number> {
  const one = [...new Map(rows.map((r) => [r.episodeId, r])).values()];
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM tv_listings WHERE day = ANY($1::date[]) OR day < $2::date", [read, keepFrom]);
    if (one.length) {
      await c.query(
        `INSERT INTO tv_listings (episode_id, day, tvmaze_id, air_at, runtime_min, season, number, binge, name, type, network, country, weight, art_url)
         SELECT "episodeId", day, "tvmazeId", "airAt", "runtimeMin", season, number, binge, name, type, network, country, weight, "artUrl"
           FROM jsonb_to_recordset($1::jsonb) AS r("episodeId" int, day date, "tvmazeId" int, "airAt" timestamptz, "runtimeMin" smallint, season int,
                number int, binge boolean, name text, type text, network text, country text, weight smallint, "artUrl" text)
         ON CONFLICT (episode_id) DO UPDATE SET day = EXCLUDED.day, tvmaze_id = EXCLUDED.tvmaze_id, air_at = EXCLUDED.air_at,
           runtime_min = EXCLUDED.runtime_min, season = EXCLUDED.season, number = EXCLUDED.number, binge = EXCLUDED.binge, name = EXCLUDED.name,
           type = EXCLUDED.type, network = EXCLUDED.network, country = EXCLUDED.country, weight = EXCLUDED.weight, art_url = EXCLUDED.art_url,
           fetched_at = now()`,
        [JSON.stringify(one)]
      );
    }
    await c.query("COMMIT");
    return one.length;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** A listing season's status by date, as seasonStatus says (listing.ts): no TVmaze call. */
async function statusesByDate(now: Date): Promise<number> {
  const status = `CASE WHEN premiere_date IS NULL OR premiere_date > $1::date THEN 'upcoming'
                       WHEN finale_date IS NOT NULL AND finale_date < $1::date THEN 'completed' ELSE 'airing' END`;
  const { rowCount } = await pool.query(
    `UPDATE show_seasons SET status = ${status}, updated_at = now() WHERE listing_id IS NOT NULL AND status IS DISTINCT FROM ${status}`,
    [now.toISOString().slice(0, 10)]
  );
  return rowCount ?? 0;
}

type OurSeason = { id: string; number: number; listingId: number | null; status: string; finale: string | null };

/**
 * Listing shows TVmaze says changed since the last upkeep: their seasons still going read again, and a season the listings
 * announce made. Runs are once an Eastern day on the clock's six-hourly calls, so up to ~30 hours apart: TVmaze is asked for
 * the day's changes, or the week's when the last upkeep was longer ago, and only shows changed since then are read.
 */
async function keepSeasons(base: string, now: Date, pace: () => Promise<void>, run: ListingsRun) {
  const { rows: ours } = await pool.query(
    `SELECT s.id, s.tvmaze_id, s.set_up_at IS NOT NULL AS "setUp",
            json_agg(json_build_object('id', ss.id, 'number', ss.season_number, 'listingId', ss.listing_id, 'status', ss.status, 'finale', ss.finale_date)
                     ORDER BY ss.season_number) AS seasons
       FROM shows s JOIN show_seasons ss ON ss.show_id = s.id
      WHERE s.tvmaze_id IS NOT NULL AND s.archived = false
      GROUP BY s.id HAVING bool_or(ss.listing_id IS NOT NULL)`
  );
  run.updated = run.seasons = run.made = 0;
  if (!ours.length) {
    run.keptAt = now.toISOString();
    return;
  }
  const from = run.keptAt ? Date.parse(run.keptAt) - 3600_000 : null;
  await pace();
  const changed = await updatedShows(base, from != null && now.getTime() - from <= 24 * 3600_000 ? "day" : "week");
  const due = ours.filter((s) => changed.has(s.tvmaze_id) && (from == null || changed.get(s.tvmaze_id)! * 1000 >= from)).slice(0, MAX_SHOWS);
  run.updated = due.length;
  const since = new Date(now.getTime() - FINISHED_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const show of due) {
    await pace();
    const found = await showListing(show.tvmaze_id, base);
    if (!found) continue;
    const seasons = show.seasons as OurSeason[];
    for (const s of seasons) {
      if (s.listingId == null || (s.status === "completed" && (!s.finale || s.finale < since))) continue;
      const theirs = found.seasons.find((t) => t.id === s.listingId);
      if (!theirs) continue;
      await pace();
      await listedSeason(show.id, found.show, theirs, base, now, s.id);
      run.seasons++;
    }
    // Its seasons come from the listings (its newest was made from one): a dated season after it is made too.
    const newest = seasons[seasons.length - 1];
    if (newest.listingId == null) continue;
    const next = found.seasons.filter((t: TvSeason) => t.number > newest.number && !!t.premiereDate).sort((a, b) => a.number - b.number);
    for (const t of next) {
      await pace();
      const id = await listedSeason(show.id, found.show, t, base, now, null);
      // A game's next season plays by last season's rulebook (step 10 part 3), as the desk's New season does.
      if (show.setUp) await ensureSeasonRulebook(pool, id);
      run.made++;
    }
  }
  run.keptAt = now.toISOString();
}

/** Shows here with no listing that the week's schedule has by the same name (one listing, no show here already on it): linked. */
async function linkByName(shows: ScheduleShow[], base: string, now: Date, pace: () => Promise<void>): Promise<number> {
  const { rows: named } = await pool.query("SELECT id, slug, name FROM shows WHERE tvmaze_id IS NULL AND archived = false");
  let linked = 0;
  for (const n of named) {
    const ids = [...new Set(shows.filter((x) => sameShow(n.name, x)).map((x) => x.tvmazeId))];
    if (ids.length !== 1) continue;
    const id = ids[0];
    if ((await pool.query("SELECT 1 FROM shows WHERE tvmaze_id = $1", [id])).rows.length) continue;
    await pace();
    const found = await showListing(id, base);
    if (!found) continue;
    const hit = hitOf(found.show);
    const kind = kindOf(found.show.type, found.show.genres);
    const t = termsOf(kind);
    // The show gains the link and its art; one that isn't a game yet takes the listing's kind too (Make it a game shows it,
    // with Change). Its name stays as it was added.
    const { rowCount } = await pool
      .query(
        `UPDATE shows SET tvmaze_id = $2, listing = $3, art_url = COALESCE(art_url, $4),
                kind = CASE WHEN set_up_at IS NULL THEN $5 ELSE kind END,
                castaway_term = CASE WHEN set_up_at IS NULL THEN $6 ELSE castaway_term END,
                tribe_term = CASE WHEN set_up_at IS NULL THEN $7 ELSE tribe_term END, updated_at = now()
          WHERE id = $1 AND tvmaze_id IS NULL`,
        [n.id, id, JSON.stringify({ ...hit, fetchedAt: now.toISOString() }), hit.art, kind, t.castaway, t.tribe]
      )
      .catch((e) => {
        if ((e as { code?: string }).code === "23505") return { rowCount: 0 }; // someone linked that listing a moment ago
        throw e;
      });
    if (!rowCount) continue;
    linked++;
    // A show added by name has one season with nothing known about it (no premiere, air time or episodes): it takes the
    // listing's, its number (unless a game is on it, which names the season by number) and every episode's air time. A
    // season with a schedule (an admin's, or research's) is never touched.
    const season = pickSeason(found.seasons, now);
    if (!season) continue;
    const { rows: ss } = await pool.query(
      `SELECT ss.id, ss.season_number, ss.listing_id, ss.premiere_date IS NULL AND ss.air_time IS NULL AND ss.episode_count IS NULL AS blank,
              (SELECT count(*)::int FROM season_episodes e WHERE e.season_id = ss.id) AS episodes
         FROM show_seasons ss WHERE ss.show_id = $1`,
      [n.id]
    );
    if (ss.length !== 1 || ss[0].listing_id != null || !ss[0].blank || ss[0].episodes > 0) continue;
    const { rows: played } = await pool.query(
      "SELECT 1 FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2 LIMIT 1",
      [n.slug, String(ss[0].season_number)]
    );
    await pool.query("UPDATE show_seasons SET listing_id = $2, season_number = $3, name = COALESCE(name, $4), updated_at = now() WHERE id = $1", [
      ss[0].id,
      season.id,
      played.length ? ss[0].season_number : season.number,
      season.name?.trim() || null,
    ]);
    await pace();
    await listedSeason(n.id, found.show, season, base, now, ss[0].id);
  }
  return linked;
}

/**
 * The daily listings job. Runs when today's run is still to do (or `force`: a run by hand), one at a time; null when it
 * didn't run. Each part goes on if another fails; a day TVmaze didn't answer keeps its old rows and the run is tried again
 * an hour on (at the clock's next call).
 */
export async function refreshListings(base: string, opts: { now?: Date; force?: boolean; how?: ListingsRun["how"] } = {}): Promise<ListingsRun | null> {
  const now = opts.now ?? new Date();
  const prev = await lastRun();
  const run: ListingsRun = { day: easternDay(now), at: now.toISOString(), done: null, ok: null, how: opts.how ?? "clock", keptAt: prev?.keptAt };
  if (!(await claim(run, !!opts.force))) return null;
  const pace = pacer(base);
  const errors: string[] = [];
  const failed: string[] = [];
  const note = (what: string, e: unknown) => {
    if (!(e instanceof ListingsUnavailable)) console.error(`[listings] ${what}:`, e);
    errors.push(`${what}: ${(e as Error).message}`.slice(0, 200));
  };
  let shows: ScheduleShow[] = [];
  try {
    const rows: ListingRow[] = [];
    const named = new Map<number, ScheduleShow>();
    const read: string[] = [];
    for (const day of listingDays(now)) {
      try {
        await pace();
        const us = await scheduleDay(day, base);
        await pace();
        const web = await webScheduleDay(day, base);
        const got = scheduleRows(day, us, web);
        rows.push(...got.rows);
        for (const s of got.shows) named.set(s.tvmazeId, s);
        read.push(day);
      } catch (e) {
        if (!(e instanceof ListingsUnavailable)) throw e;
        failed.push(day);
      }
    }
    shows = [...named.values()];
    run.days = read.length;
    run.failedDays = failed;
    run.rows = await writeRows(rows, read, easternDay(now, -1));
  } catch (e) {
    note("the week", e);
  }
  try {
    run.statuses = await statusesByDate(now);
    await keepSeasons(base, now, pace, run);
  } catch (e) {
    note("listing seasons", e);
  }
  try {
    run.linked = await linkByName(shows, base, now, pace);
  } catch (e) {
    note("shows by name", e);
  }
  try {
    // Art and cast photos for a few shows and seasons nobody's looked for yet (or due TMDB's six-month re-ask): show-art.ts.
    run.art = await sweepArt(base);
  } catch (e) {
    note("art", e);
  }
  run.errors = errors;
  run.ok = !errors.length && !failed.length;
  run.done = new Date().toISOString();
  await pool.query("UPDATE app_settings SET value = $2::jsonb, updated_at = now() WHERE key = $1", [KEY, JSON.stringify(run)]);
  console.log(
    `[listings] ${run.day} (${run.how}): ${run.ok ? "ok" : "not all"}; ${run.rows ?? 0} listings over ${run.days ?? 0} days` +
      `${failed.length ? ` (${failed.length} unanswered)` : ""}, ${run.seasons ?? 0} seasons read again, ${run.made ?? 0} made, ${run.linked ?? 0} linked` +
      `${run.art ? `; art for ${run.art.shows} shows, ${run.art.seasons} seasons, ${run.art.photos} photos` : ""}` +
      `${errors.length ? `; ${errors.join("; ")}` : ""}`
  );
  return run;
}

/** The week on TV as the guide reads it (/api/listings/week): the same for everyone, from yesterday on. */
export async function listingsWeek(now = new Date()): Promise<{ listings: WeekListing[] }> {
  const { rows } = await pool.query(
    `SELECT tvmaze_id AS "tvmazeId", name, network, country, type, art_url AS "artUrl", weight, air_at AS "airAt", runtime_min AS "runtimeMin", season, number, binge
       FROM tv_listings WHERE day >= $1::date ORDER BY air_at, episode_id`,
    [easternDay(now, -1)]
  );
  return { listings: weekListings(rows.map((r) => ({ ...r, airAt: (r.airAt as Date).toISOString() }))) };
}

/** What a check (or someone by hand) sees: the last run and the rows per day. */
export async function listingsStatus() {
  const [last, { rows }] = await Promise.all([
    lastRun(),
    pool.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, count(*)::int AS n FROM tv_listings GROUP BY day ORDER BY day`),
  ]);
  return { last, days: rows as { day: string; n: number }[] };
}
