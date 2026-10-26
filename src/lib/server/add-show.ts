import type { PoolClient } from "pg";
import {
  airTimeOf,
  episodesOf,
  hitOf,
  nameParts,
  pickSeason,
  releaseOf,
  sameShow,
  seasonStatus,
  slugOf,
  zoneOf,
  type ListingHit,
  type ShowKind,
  type TvSeason,
  type TvShow,
} from "@/lib/game/listing";
import { pool, HttpError } from "./db";
import { setFollow } from "./follows";
import { latestAired, seasonSchedules } from "./schedule";
import { ListingsUnavailable, seasonListing, showListing } from "./listings";

// Add a show (docs/PLAN-new-design.md step 10 part 1; the mock's refine.js addShowSheet): follow a show from its TV listing,
// or by name when the listings don't have it. A show is made once for everyone: found by its TVmaze id, else by its name
// (a show an admin set up before the listings came in is matched and linked, never made twice), else made from the
// listing: its name, art and a first guess at its kind, the season on now (else the next, else the latest) with every
// episode's air time as season_episodes rows. A show made here is "Not a game yet" (shows.set_up_at NULL) until someone
// makes it one (step 10 part 2). Then it's followed, openly, with where you are (never past what's aired).
//
// A season that was already here keeps its schedule (the couch's games lock lineups by it); only a season made from its
// listing reads its episodes again, when someone adds it a day or more after the last read.

/** New shows one person can make in a day (each is one more in everyone's search). */
export const NEW_SHOWS_A_DAY = 10;
const REFRESH_MS = 24 * 3600 * 1000;

export interface AddedShow {
  seasonId: string;
  /** "Love Island 8", for the toast. */
  label: string;
  /** Made just now (nobody had added it before). */
  made: boolean;
  /** Set up as a game (false: "Not a game yet"). */
  ready: boolean;
  /** Episodes aired so far: what where you are can go up to. */
  aired: number;
  seenThrough: number;
}

type Db = Pick<PoolClient, "query">;

const terms = (kind: ShowKind) =>
  kind === "competition" ? { castaway: "Contestant", tribe: "Team" } : kind === "sport" ? { castaway: "Athlete", tribe: "Team" } : { castaway: "Cast member", tribe: "Group" };

async function newSlug(db: Db, name: string): Promise<string> {
  const base = slugOf(name);
  const { rows } = await db.query("SELECT slug FROM shows WHERE slug = $1 OR slug LIKE $2", [base, `${base}-%`]);
  const taken = new Set(rows.map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function madeToday(userId: string): Promise<number> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM shows WHERE created_by = $1 AND created_at > now() - interval '1 day'", [userId]);
  return rows[0].n as number;
}

async function makeShow(
  db: Db,
  userId: string,
  name: string,
  listing: { hit: ListingHit; fetchedAt: string } | null
): Promise<string> {
  if ((await madeToday(userId)) >= NEW_SHOWS_A_DAY) throw new HttpError(429, `You've added ${NEW_SHOWS_A_DAY} new shows today. Try again tomorrow.`);
  const kind = listing?.hit.kind ?? "competition";
  const t = terms(kind);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await newSlug(db, name);
    const { rows } = await db.query(
      `INSERT INTO shows (slug, name, castaway_term, tribe_term, kind, art_url, created_by, set_up_at, tvmaze_id, listing)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9)
       ON CONFLICT DO NOTHING RETURNING id`,
      [slug, name.slice(0, 120), t.castaway, t.tribe, kind, listing?.hit.art ?? null, userId, listing?.hit.tvmazeId ?? null, listing ? JSON.stringify({ ...listing.hit, fetchedAt: listing.fetchedAt }) : null]
    );
    if (rows.length) return rows[0].id as string;
    // Someone else made it a moment ago (its TVmaze id), or took the slug: look again.
    if (listing) {
      const { rows: again } = await db.query("SELECT id FROM shows WHERE tvmaze_id = $1", [listing.hit.tvmazeId]);
      if (again.length) return again[0].id as string;
    }
  }
  throw new HttpError(409, "Couldn't add that show just now. Try again.");
}

/** The show already here that this listing is: by its TVmaze id, else by name and country (and then it's linked). */
async function showForListing(hit: ListingHit, fetchedAt: string): Promise<string | null> {
  const { rows } = await pool.query("SELECT id FROM shows WHERE tvmaze_id = $1", [hit.tvmazeId]);
  if (rows.length) return rows[0].id as string;
  const { rows: named } = await pool.query("SELECT id, name, created_by IS NULL AS curated FROM shows WHERE tvmaze_id IS NULL AND archived = false");
  const match = named.filter((s) => sameShow(s.name, hit)).sort((a, b) => Number(b.curated) - Number(a.curated))[0];
  if (!match) return null;
  // Linked, so the next person finds it by its id. A show an admin named keeps its name and art; it only gains the link.
  await pool.query("UPDATE shows SET tvmaze_id = $2, listing = $3, updated_at = now() WHERE id = $1 AND tvmaze_id IS NULL", [
    match.id,
    hit.tvmazeId,
    JSON.stringify({ ...hit, fetchedAt }),
  ]);
  return match.id as string;
}

/** The season of an existing show to follow, when one's here: the listing's season by number, else the show's own on now
 *  or coming up (an admin's numbering wins over the listing's), else null (make it from the listing). */
async function seasonHere(showId: string, number: number | null): Promise<{ id: string; listingId: number | null; fetchedAt: Date | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, season_number, status, listing_id, listing_fetched_at FROM show_seasons WHERE show_id = $1 ORDER BY season_number DESC`,
    [showId]
  );
  const pick = (number != null ? rows.find((r) => r.season_number === number) : null) ?? rows.find((r) => r.status !== "completed" && r.listing_id == null);
  return pick ? { id: pick.id, listingId: pick.listing_id, fetchedAt: pick.listing_fetched_at } : null;
}

/** A season's row from its listing (status, dates, how it's released, its air time and zone). */
function seasonRow(show: TvShow, season: TvSeason, episodes: ReturnType<typeof episodesOf>, raw: Parameters<typeof releaseOf>[0], now: Date) {
  const status = seasonStatus(season, now);
  const { release, dropAt } = releaseOf(raw);
  const count = season.episodeOrder && season.episodeOrder > 0 ? season.episodeOrder : status === "completed" && episodes.length ? episodes.length : null;
  return {
    status,
    premiere: season.premiereDate ?? null,
    finale: season.endDate ?? null,
    release,
    dropAt,
    count,
    airTime: airTimeOf(show),
    tz: zoneOf(show) ?? "America/New_York",
  };
}

/** Write a listing season's episodes (only its own rows research hasn't reported on: research and an admin win). */
async function writeEpisodes(db: Db, seasonId: string, episodes: ReturnType<typeof episodesOf>) {
  for (const e of episodes) {
    await db.query(
      `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, title, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'listing', now())
       ON CONFLICT (season_id, number) DO UPDATE SET air_at = EXCLUDED.air_at, runtime_min = EXCLUDED.runtime_min, title = EXCLUDED.title, updated_at = now()
       WHERE season_episodes.source = 'listing' AND season_episodes.reported_in IS NULL`,
      [seasonId, e.number, e.airAt, e.runtimeMin, e.title]
    );
  }
}

/** Make (or read again) a season from its listing. */
async function listedSeason(showId: string, show: TvShow, season: TvSeason, base: string, now: Date, existing: string | null): Promise<string> {
  const raw = await seasonListing(season.id, base);
  const episodes = episodesOf(raw);
  const row = seasonRow(show, season, episodes, raw, now);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    let id = existing;
    if (!id) {
      const { rows } = await c.query(
        `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, finale_date, episode_count, release, drop_at, air_time, air_tz, listing_id, listing_fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
         ON CONFLICT (show_id, season_number) DO NOTHING RETURNING id`,
        [showId, season.number, season.name?.trim() || null, row.status, row.premiere, row.finale, row.count, row.release, row.dropAt, row.airTime, row.tz, season.id]
      );
      id = rows[0]?.id ?? (await c.query("SELECT id FROM show_seasons WHERE show_id = $1 AND season_number = $2", [showId, season.number])).rows[0].id;
    } else {
      await c.query(
        `UPDATE show_seasons SET status = $2, premiere_date = $3, finale_date = $4, episode_count = $5, release = $6, drop_at = $7,
                air_time = COALESCE($8, air_time), listing_fetched_at = now(), updated_at = now()
          WHERE id = $1 AND listing_id IS NOT NULL`,
        [id, row.status, row.premiere, row.finale, row.count, row.release, row.dropAt, row.airTime]
      );
    }
    await writeEpisodes(c, id!, episodes);
    await c.query("COMMIT");
    return id!;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** A show's season to follow when it has no listing (added by name): its own on now or coming up, else its latest, else a
 *  first season with nothing known about it yet. */
async function seasonByName(showId: string): Promise<string> {
  const { rows } = await pool.query("SELECT id, status FROM show_seasons WHERE show_id = $1 ORDER BY season_number DESC", [showId]);
  const pick = rows.find((r) => r.status !== "completed") ?? rows[0];
  if (pick) return pick.id as string;
  const { rows: made } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 1, 'upcoming')
     ON CONFLICT (show_id, season_number) DO UPDATE SET updated_at = now() RETURNING id`,
    [showId]
  );
  return made[0].id as string;
}

async function followAt(userId: string, seasonId: string, seen: number | undefined): Promise<AddedShow> {
  const now = new Date();
  const [schedules, { rows }] = await Promise.all([
    seasonSchedules([seasonId], now),
    pool.query(
      `SELECT s.name, ss.season_number, s.set_up_at IS NOT NULL AS ready FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
      [seasonId]
    ),
  ]);
  const aired = latestAired(schedules.get(seasonId), now);
  const want = Number.isInteger(seen) && (seen as number) > 0 ? Math.min(seen as number, aired) : 0;
  let mark = want;
  try {
    mark = (await setFollow(userId, seasonId, { following: true, seenThrough: want })).seenThrough;
  } catch (e) {
    // You play it: where you are moves with your games' reveals, so it's only followed.
    if (!(e instanceof HttpError) || e.status !== 409) throw e;
    mark = (await setFollow(userId, seasonId, { following: true })).seenThrough;
  }
  const r = rows[0];
  // As people say it: "The Traitors", not "The Traitors (US)" (way-in.ts plainShow).
  const show = r.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || r.name;
  return { seasonId, label: `${show}${r.season_number ? ` ${r.season_number}` : ""}`, made: false, ready: !!r.ready, aired, seenThrough: mark };
}

/**
 * Add a show to your shows (POST /api/me/shows): `{ listing: <TVmaze id> }` or `{ name }`, with where you are
 * (`seenThrough`, capped at what's aired). Returns the season it follows.
 */
export async function addShow(userId: string, body: { listing?: unknown; name?: unknown; seenThrough?: unknown }, base: string, now = new Date()): Promise<AddedShow> {
  const seen = Number.isInteger(body.seenThrough) ? (body.seenThrough as number) : undefined;
  if (body.listing !== undefined) {
    const id = body.listing;
    if (!Number.isInteger(id) || (id as number) < 1) throw new HttpError(400, "Which show? (a TV listing's id)");
    let found: Awaited<ReturnType<typeof showListing>>;
    try {
      found = await showListing(id as number, base);
    } catch (e) {
      if (!(e instanceof ListingsUnavailable)) throw e;
      // The listings are down: a show that's already here can still be followed (its season on now, else its latest).
      const { rows } = await pool.query(
        `SELECT ss.id FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.tvmaze_id = $1
          ORDER BY (ss.status <> 'completed') DESC, ss.season_number DESC LIMIT 1`,
        [id]
      );
      if (!rows.length) throw new HttpError(503, "TV listings aren't answering. Try again in a minute.");
      return followAt(userId, rows[0].id, seen);
    }
    if (!found) throw new HttpError(404, "That show isn't in the TV listings");
    const hit = hitOf(found.show);
    const fetchedAt = now.toISOString();
    const season = pickSeason(found.seasons, now);
    let showId = await showForListing(hit, fetchedAt);
    const made = !showId;
    if (!showId) showId = await makeShow(pool, userId, hit.name, { hit, fetchedAt });
    const here = await seasonHere(showId, season?.number ?? null);
    let seasonId: string;
    if (here) {
      seasonId = here.id;
      // A season made from its listing is read again when it's a day old; one that was already here keeps its schedule.
      const stale = here.listingId != null && season && here.listingId === season.id && (!here.fetchedAt || now.getTime() - here.fetchedAt.getTime() > REFRESH_MS);
      if (stale) await listedSeason(showId, found.show, season!, base, now, here.id).catch((e) => console.error("[add-show] refresh:", e));
    } else if (season) {
      seasonId = await listedSeason(showId, found.show, season, base, now, null);
    } else {
      seasonId = await seasonByName(showId);
    }
    return { ...(await followAt(userId, seasonId, seen)), made };
  }
  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) throw new HttpError(400, "A show's name, 2 to 80 letters");
    const { rows } = await pool.query("SELECT id, name, created_by IS NULL AS curated FROM shows WHERE archived = false");
    const key = nameParts(name);
    const match = rows.filter((s) => sameShow(s.name, { name, country: key.country })).sort((a, b) => Number(b.curated) - Number(a.curated))[0];
    const showId = match?.id ?? (await makeShow(pool, userId, name, null));
    return { ...(await followAt(userId, await seasonByName(showId), seen)), made: !match };
  }
  throw new HttpError(400, "Which show? A TV listing or a name");
}
