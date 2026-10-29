import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient } from "pg";
import { after } from "next/server";
import { frameFor, type Frame } from "@/lib/art-frame";
export { cleanArtLink } from "@/lib/art-frame";
import {
  artCandidates,
  isFormulaOne,
  matchCredit,
  normName,
  pickArt,
  replaceablePhoto,
  tmdbCredits,
  tvmazeCredits,
  wikiHitIs,
  wikiTitle,
  type ArtCandidate,
  type Credit,
  type TmdbAggregateCast,
  type TmdbImages,
} from "@/lib/game/show-art";
import { pool, withLeagueLock } from "./db";
import { episodeGuestCast, ListingsUnavailable, seasonListing, showListing } from "./listings";
import { applyApprovedCastToLeagues, seasonCastRows } from "./season-cast";

// Show and season art and cast photos, found on their own (docs/RESEARCH-show-art-and-cast-photos.md; migration 0139; the
// pure half is src/lib/game/show-art.ts). When a show or season is made, its cast arrives, an admin asks, or the daily
// listings job finds something unchecked, this asks:
//
//   * TMDB (free key, non-commercial: TMDB_READ_TOKEN; without it this part is off) for a show's poster, backdrop and logo,
//     a season's poster and a season's cast photos. Images are hotlinked from image.tmdb.org and stored as plain URLs, so
//     removing TMDB later is one UPDATE on that host. TMDB's data may be kept six months: the daily job re-asks before then.
//   * TVmaze (no key, already the listings) for a season's poster (written where seasons are made, add-show.ts) and, where
//     TMDB has nobody, the premiere's guest cast.
//   * Wikipedia (no key) for a sport's athletes: only freely licensed photos, through Jolpica's links for Formula 1, else a
//     search by name and the sport. Wikimedia rate-limits bursts, so it's asked in batches, one call at a time.
//
// An admin's choice is never changed (each frame's own: shows.art_by_hand for the poster, backdrop_by_hand for the header,
// show_seasons.art_by_hand; a photo the finder didn't bring: replaceablePhoto), and a show with art_off gets nothing.
// Spoilers: only names and photos are read from a season's credits.

const TMDB = "https://api.themoviedb.org/3";
const WIKI = "https://en.wikipedia.org/w/api.php?format=json&formatversion=2";
const WIKIDATA = "https://www.wikidata.org/w/api.php?format=json";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const UA = { "User-Agent": "GameYourShow/1.0 (https://gameyourshow.com)" };
const TIMEOUT_MS = 8000;
/** TMDB's data may be kept six months; re-ask a little before. */
export const RECHECK_DAYS = 150;

/** A check's TMDB stand-in for what runs inside withTmdbFor (scripts/dev-test/fake-tmdb.js). */
const standIn = new AsyncLocalStorage<string>();

/**
 * Runs `fn` asking TMDB, or (`next dev` only, a loopback address) a check's stand-in named by the request's `x-gys-tmdb`
 * header, so checks never depend on TMDB. Production never reads the header.
 */
export function withTmdbFor<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const asked = process.env.NODE_ENV === "development" ? req.headers.get("x-gys-tmdb") : null;
  if (asked) {
    try {
      const u = new URL(asked);
      if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return standIn.run(u.origin, fn);
    } catch {
      /* not a URL: TMDB, as for anyone */
    }
  }
  return fn();
}

export const tmdbOn = () => !!standIn.getStore() || !!process.env.TMDB_READ_TOKEN;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) {
      if (res.status !== 404) console.error(`[show-art] ${new URL(url).host} answered ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[show-art] ${new URL(url).host} didn't answer (${(e as Error).name})`);
    return null;
  }
}

const tmdb = <T>(path: string) => {
  const base = standIn.getStore();
  if (base) return getJson<T>(base + path);
  return tmdbOn() ? getJson<T>(TMDB + path, { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` }) : Promise.resolve(null);
};

// ---------- the show on TMDB ----------

interface ShowRow {
  id: string;
  name: string;
  kind: string | null;
  tmdb_id: number | null;
  tvmaze_id: number | null;
  country: string | null;
  art_by_hand: boolean;
  art_off: boolean;
}

async function showRow(showId: string): Promise<ShowRow | null> {
  const { rows } = await pool.query(
    `SELECT id, name, kind, tmdb_id, tvmaze_id, listing->>'country' AS country, art_by_hand, art_off FROM shows WHERE id = $1`,
    [showId]
  );
  return rows[0] ?? null;
}

interface TmdbTvHit {
  id: number;
  name?: string;
  original_name?: string;
  origin_country?: string[];
  popularity?: number;
}

/** The show's TMDB id: already known, else from TVmaze's IMDb or TheTVDB id, else by its name (and country). */
export async function linkTmdb(show: ShowRow, listingsBase?: string): Promise<number | null> {
  if (show.tmdb_id) return show.tmdb_id;
  if (!tmdbOn()) return null;
  let id: number | null = null;
  if (show.tvmaze_id) {
    const found = await showListing(show.tvmaze_id, listingsBase).catch((e) => (e instanceof ListingsUnavailable ? null : Promise.reject(e)));
    const ext = found?.show.externals;
    for (const [value, source] of [
      [ext?.imdb, "imdb_id"],
      [ext?.thetvdb, "tvdb_id"],
    ] as const) {
      if (id || !value) continue;
      const r = await tmdb<{ tv_results?: TmdbTvHit[] }>(`/find/${encodeURIComponent(String(value))}?external_source=${source}`);
      id = r?.tv_results?.[0]?.id ?? null;
    }
  }
  if (!id) {
    const name = show.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const r = await tmdb<{ results?: TmdbTvHit[] }>(`/search/tv?query=${encodeURIComponent(name)}`);
    const same = (r?.results ?? []).filter((h) => [h.name, h.original_name].some((n) => n && normName(n) === normName(name)));
    const here = show.country ? same.filter((h) => h.origin_country?.includes(show.country!)) : [];
    id = [...(here.length ? here : same)].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0]?.id ?? null;
  }
  if (id) await pool.query("UPDATE shows SET tmdb_id = $2 WHERE id = $1 AND tmdb_id IS NULL", [show.id, id]);
  return id;
}

// ---------- art ----------

/** A show's art from TMDB (poster, backdrop, logo), each unless an admin chose it, or none while it's off. */
export async function fillShowArt(showId: string, listingsBase?: string): Promise<boolean> {
  const show = await showRow(showId);
  if (!show || show.art_off || !tmdbOn()) return false;
  const tmdbId = await linkTmdb(show, listingsBase);
  const picked = tmdbId ? pickArt(await tmdb<TmdbImages>(`/tv/${tmdbId}/images?include_image_language=en,null`)) : null;
  await pool.query(
    `UPDATE shows SET art_url = CASE WHEN art_by_hand THEN art_url ELSE COALESCE($2, art_url) END,
            backdrop_url = CASE WHEN backdrop_by_hand THEN backdrop_url ELSE COALESCE($3, backdrop_url) END,
            logo_url = COALESCE($4, logo_url),
            art_checked_at = now()
      WHERE id = $1`,
    [showId, picked?.poster ?? null, picked?.backdrop ?? null, picked?.logo ?? null]
  );
  return !!picked?.poster;
}

interface SeasonRow {
  id: string;
  show_id: string;
  slug: string;
  show_name: string;
  kind: string | null;
  season_number: number;
  tmdb_season: number | null;
  tmdb_id: number | null;
  tvmaze_id: number | null;
  listing_id: number | null;
  premiere: string | null;
  art_off: boolean;
  art_by_hand: boolean;
  cast_approved_at: Date | null;
  tribes_from_episode: number | null;
}

async function seasonRow(seasonId: string): Promise<SeasonRow | null> {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.show_id, s.slug, s.name AS show_name, s.kind, ss.season_number, ss.tmdb_season, s.tmdb_id, s.tvmaze_id, ss.listing_id,
            to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere, s.art_off, ss.art_by_hand, ss.cast_approved_at, ss.tribes_from_episode
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  return rows[0] ?? null;
}

const tmdbSeason = (s: SeasonRow) => s.tmdb_season ?? s.season_number;

/** A season's row with its show linked to TMDB (a cast can arrive before anyone looked for the show's art). */
async function linkedSeason(seasonId: string, listingsBase?: string): Promise<SeasonRow | null> {
  const s = await seasonRow(seasonId);
  if (s && !s.tmdb_id && !s.art_off && tmdbOn()) {
    const show = await showRow(s.show_id);
    if (show) s.tmdb_id = await linkTmdb(show, listingsBase);
  }
  return s;
}

/** A season's poster from TMDB, unless an admin chose it or the show's art is off. */
export async function fillSeasonArt(seasonId: string, listingsBase?: string): Promise<boolean> {
  const s = await linkedSeason(seasonId, listingsBase);
  if (!s || s.art_off || s.art_by_hand || !s.tmdb_id || !tmdbOn()) return false;
  const picked = pickArt(await tmdb<TmdbImages>(`/tv/${s.tmdb_id}/season/${tmdbSeason(s)}/images?include_image_language=en,null`));
  if (!picked.poster) return false;
  await pool.query("UPDATE show_seasons SET art_url = $2 WHERE id = $1 AND NOT art_by_hand", [seasonId, picked.poster]);
  return true;
}

// ---------- cast photos ----------

/** TMDB's cast of a season (hosts and guests left out). */
async function tmdbSeasonCredits(s: SeasonRow): Promise<Credit[]> {
  if (!s.tmdb_id) return [];
  const r = await tmdb<{ cast?: TmdbAggregateCast[] }>(`/tv/${s.tmdb_id}/season/${tmdbSeason(s)}/aggregate_credits`);
  return tmdbCredits(r?.cast);
}

/** TVmaze's guest cast of a season's first two episodes (how it lists a reality season's people). */
async function tvmazeSeasonCredits(s: SeasonRow, base?: string): Promise<Credit[]> {
  if (!s.listing_id) return [];
  try {
    const episodes = (await seasonListing(s.listing_id, base)).filter((e) => e.id && e.number != null).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    // The same person is in both episodes: one credit each (else the matcher sees two and calls it unclear).
    const byPerson = new Map<string, Credit>();
    for (const e of episodes.slice(0, 2)) {
      for (const c of tvmazeCredits(await episodeGuestCast(e.id!, base))) {
        const had = byPerson.get(normName(c.names[0]));
        if (!had) byPerson.set(normName(c.names[0]), c);
        else if (!had.photo && c.photo) had.photo = c.photo;
      }
    }
    return [...byPerson.values()];
  } catch (e) {
    if (e instanceof ListingsUnavailable) return [];
    throw e;
  }
}

interface WikiPage {
  title: string;
  missing?: boolean;
  thumbnail?: { source: string };
  pageprops?: { wikibase_item?: string };
}

/** Pages' free photos (Wikipedia's page image API returns freely licensed ones only) and Wikidata ids, 40 titles a call. */
async function wikiPages(titles: string[]): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const d = await getJson<{ query?: { pages?: WikiPage[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } }>(
      `${WIKI}&action=query&redirects=1&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=330&titles=${encodeURIComponent(batch.join("|"))}`
    );
    const back = new Map<string, string>();
    for (const n of [...(d?.query?.normalized ?? []), ...(d?.query?.redirects ?? [])]) back.set(n.to, n.from);
    for (const p of d?.query?.pages ?? []) {
      let key = p.title;
      for (let hops = 0; back.has(key) && hops < 3; hops++) key = back.get(key)!;
      out.set(key, p);
    }
  }
  return out;
}

/** Which Wikidata items are people (P31 = human): a search hit has to be one. */
async function people(qids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < qids.length; i += 50) {
    const d = await getJson<{ entities?: Record<string, { claims?: { P31?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[] } }> }>(
      `${WIKIDATA}&action=wbgetentities&props=claims&ids=${qids.slice(i, i + 50).join("|")}`
    );
    for (const [id, e] of Object.entries(d?.entities ?? {})) if ((e.claims?.P31 ?? []).some((c) => c.mainsnak?.datavalue?.value?.id === "Q5")) out.add(id);
  }
  return out;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The Wikipedia page of an athlete, by a search for their name and what they're part of (their team, else the show): one clear
 *  hit or nothing. */
async function wikiSearch(name: string, context: string): Promise<string | null> {
  const d = await getJson<{ query?: { search?: { title: string }[] } }>(
    `${WIKI}&action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(`${name} ${context}`)}`
  );
  const hits = (d?.query?.search ?? []).filter((h) => wikiHitIs(name, h.title));
  return hits[0]?.title ?? null;
}

/** Formula 1's field for a year, with each driver's Wikipedia page (Jolpica: free, no key). */
async function formulaOneField(year: number): Promise<{ names: string[]; title: string | null }[]> {
  const d = await getJson<{ MRData?: { DriverTable?: { Drivers?: { givenName: string; familyName: string; url?: string }[] } } }>(`${JOLPICA}/${year}/drivers/?limit=100`);
  return (d?.MRData?.DriverTable?.Drivers ?? []).map((x) => ({ names: [`${x.givenName} ${x.familyName}`], title: wikiTitle(x.url) }));
}

/** The most searches one sweep makes (Wikipedia rate-limits bursts); the rest wait for the next. A roster just filled in
 *  (rosters.ts) looks for everyone at once, a little slower. */
const SEARCHES_A_SWEEP = 30;
const SEARCHES_A_ROSTER = 150;

/**
 * Free athlete photos from Wikipedia, by name: Jolpica's links for Formula 1, else one search each, by their team (season_cast's
 * group: "Kevin Cash Tampa Bay Rays" finds the manager, where the show's name alone can find someone else) and else the show.
 */
async function sportPhotos(s: SeasonRow, want: { name: string; group: string | null }[], cap = SEARCHES_A_SWEEP): Promise<Map<string, string>> {
  const names = want.map((w) => w.name);
  const groupOf = new Map(want.map((w) => [w.name, w.group]));
  const show = s.show_name.replace(/\s*\([^)]*\)\s*$/, "");
  const titles = new Map<string, { title: string; searched: boolean }>();
  if (isFormulaOne(s.show_name)) {
    const year = s.premiere ? Number(s.premiere.slice(0, 4)) : s.season_number > 1900 ? s.season_number : new Date().getFullYear();
    const field = await formulaOneField(year);
    for (const n of names) {
      const hit = matchCredit(n, field);
      if (hit?.title) titles.set(n, { title: hit.title, searched: false });
    }
  }
  let searches = 0;
  for (const n of names) {
    if (titles.has(n) || searches >= cap) continue;
    searches++;
    const group = groupOf.get(n);
    // A team's name is the best context; a group that isn't one ("Officials", "Field") goes with the show's.
    const t = await wikiSearch(n, group ? `${group} ${show}` : show);
    if (t) titles.set(n, { title: t, searched: true });
    await pause(cap > SEARCHES_A_SWEEP ? 300 : 400);
  }
  const pages = await wikiPages([...new Set([...titles.values()].map((t) => t.title))]);
  const searchedIds = [...titles.values()].filter((t) => t.searched).map((t) => pages.get(t.title)?.pageprops?.wikibase_item).filter((x): x is string => !!x);
  const humans = searchedIds.length ? await people(searchedIds) : new Set<string>();
  const out = new Map<string, string>();
  for (const [n, t] of titles) {
    const p = pages.get(t.title);
    if (!p?.thumbnail?.source || p.missing) continue;
    if (t.searched && !humans.has(p.pageprops?.wikibase_item ?? "")) continue;
    out.set(n, p.thumbnail.source);
  }
  return out;
}

export interface PhotosFound {
  looked: number;
  found: number;
  from: Record<string, number>;
}

/**
 * Photos for a season's cast (season_cast) where there's none yet or only a finder's worse one: TMDB's credits, then TVmaze's
 * premiere guest cast; a sport's from Wikipedia. Then every league on the season gets them (an approved cast only, as an
 * admin's photo change would).
 */
export async function fillCastPhotos(seasonId: string, listingsBase?: string, opts: { roster?: boolean; only?: string[] } = {}): Promise<PhotosFound> {
  const result: PhotosFound = { looked: 0, found: 0, from: {} };
  const s = await linkedSeason(seasonId, listingsBase);
  if (!s || s.art_off) return result;
  const { rows: cast } = await pool.query("SELECT id, name, tribe_name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [seasonId]);
  // `only`: just these people (a sport's cast growing from its games looks only for who it just added).
  const only = opts.only ? new Set(opts.only.map((n) => n.toLowerCase())) : null;
  const want = cast.filter((c) => replaceablePhoto(c.photo_url) && (!only || only.has((c.name as string).toLowerCase())));
  result.looked = want.length;
  const found = new Map<string, { url: string; from: string }>();
  if (want.length) {
    if (s.kind === "sport") {
      const people = want.map((c) => ({ name: c.name as string, group: (c.tribe_name as string | null) ?? null }));
      for (const [name, url] of await sportPhotos(s, people, opts.roster ? SEARCHES_A_ROSTER : SEARCHES_A_SWEEP)) found.set(name, { url, from: "wikipedia" });
    } else {
      const match = (credits: Credit[], from: string) => {
        for (const c of want) {
          if (found.has(c.name)) continue;
          const hit = matchCredit(c.name, credits);
          if (hit?.photo) found.set(c.name, { url: hit.photo, from });
        }
      };
      if (s.tmdb_id && tmdbOn()) match(await tmdbSeasonCredits(s), "tmdb");
      if (want.some((c) => !found.has(c.name))) match(await tvmazeSeasonCredits(s, listingsBase), "tvmaze");
    }
  }
  let changed = 0;
  for (const c of want) {
    const f = found.get(c.name);
    if (!f || f.url === c.photo_url) continue;
    const { rowCount } = await pool.query(
      "UPDATE season_cast SET photo_url = $2 WHERE id = $1 AND photo_url IS NOT DISTINCT FROM $3",
      [c.id, f.url, c.photo_url]
    );
    if (rowCount) {
      changed++;
      result.from[f.from] = (result.from[f.from] ?? 0) + 1;
    }
  }
  result.found = changed;
  await pool.query("UPDATE show_seasons SET photos_checked_at = now() WHERE id = $1", [seasonId]);
  if (changed && s.cast_approved_at) {
    await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(seasonId), s.tribes_from_episode ?? null);
  }
  return result;
}

/** A season's credits as castPhotosFor reads them: TMDB's, and TVmaze's once a name needed them. Kept a few minutes. */
const credited = new Map<string, { at: number; season: SeasonRow | null; tmdb: Credit[]; tvmaze: Credit[] | null }>();
const CREDITS_KEPT_MS = 10 * 60_000;

/**
 * Photos for a cast nobody has saved yet (Make it a game's review, before Looks right): each name's photo from the season's
 * credits, found the way fillCastPhotos finds them (TMDB's, then TVmaze's premiere guest cast), by name. Nothing is written
 * but the show's TMDB link. A sport's are left to the sweep (a Wikipedia search each). Never throws: none found is an empty map.
 */
export async function castPhotosFor(seasonId: string, names: string[], listingsBase?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!names.length) return out;
  try {
    let kept = credited.get(seasonId);
    if (!kept || Date.now() - kept.at > CREDITS_KEPT_MS) {
      const season = await linkedSeason(seasonId, listingsBase);
      const usable = !!season && !season.art_off && season.kind !== "sport";
      kept = { at: Date.now(), season: usable ? season : null, tmdb: usable && season!.tmdb_id && tmdbOn() ? await tmdbSeasonCredits(season!) : [], tvmaze: null };
      if (credited.size > 50) credited.clear();
      credited.set(seasonId, kept);
    }
    if (!kept.season) return out;
    const match = (credits: Credit[]) => {
      for (const n of names) {
        if (out.has(n)) continue;
        const hit = matchCredit(n, credits);
        if (hit?.photo) out.set(n, hit.photo);
      }
    };
    match(kept.tmdb);
    if (names.some((n) => !out.has(n))) {
      kept.tvmaze ??= await tvmazeSeasonCredits(kept.season, listingsBase);
      match(kept.tvmaze);
    }
  } catch (e) {
    console.error("[show-art] cast photos for a review:", e);
  }
  return out;
}

// ---------- when it runs ----------

/** Everything for one show: its art, then each season's poster and cast photos (newest five). */
export async function findArtForShow(showId: string, listingsBase?: string) {
  const art = await fillShowArt(showId, listingsBase);
  const { rows } = await pool.query("SELECT id FROM show_seasons WHERE show_id = $1 ORDER BY season_number DESC LIMIT 5", [showId]);
  let seasons = 0;
  let photos = 0;
  for (const r of rows) {
    if (await fillSeasonArt(r.id, listingsBase)) seasons++;
    photos += (await fillCastPhotos(r.id, listingsBase)).found;
  }
  return { art, seasons, photos };
}

/** After the answer is sent (no one waits on it): a show just made or linked, or a season's cast just set. */
export function findArtLater(what: { showId?: string; seasonId?: string }, listingsBase?: string) {
  if (!what.showId && !what.seasonId) return;
  // Outside a request (a script, a test) there's no "after": the daily sweep finds it instead.
  try {
    after(task);
  } catch {
    /* not in a request */
  }
  async function task() {
    try {
      if (what.showId) await fillShowArt(what.showId, listingsBase);
      if (what.seasonId) {
        await fillSeasonArt(what.seasonId, listingsBase);
        await fillCastPhotos(what.seasonId, listingsBase);
      }
    } catch (e) {
      console.error("[show-art] later:", e);
    }
  }
}

export interface ArtSweep {
  shows: number;
  seasons: number;
  photos: number;
}

/**
 * The daily listings job's part (tv-listings.ts): a few shows never asked about or due a re-ask (TMDB's six months), and a
 * few seasons whose cast photos haven't been looked for (an airing season's weekly: TMDB fills in as it airs). Bounded, so
 * a day's run stays short; the rest is the next day's.
 */
export async function sweepArt(listingsBase?: string): Promise<ArtSweep> {
  const out: ArtSweep = { shows: 0, seasons: 0, photos: 0 };
  if (tmdbOn()) {
    const { rows: shows } = await pool.query(
      `SELECT id FROM shows WHERE archived = false AND NOT art_off
          AND (art_checked_at IS NULL OR art_checked_at < now() - make_interval(days => $1))
        ORDER BY art_checked_at NULLS FIRST, created_at DESC LIMIT 6`,
      [RECHECK_DAYS]
    );
    for (const s of shows) {
      await fillShowArt(s.id, listingsBase);
      out.shows++;
      const { rows: seasons } = await pool.query(
        "SELECT id FROM show_seasons WHERE show_id = $1 AND NOT art_by_hand ORDER BY season_number DESC LIMIT 3",
        [s.id]
      );
      for (const ss of seasons) if (await fillSeasonArt(ss.id, listingsBase)) out.seasons++;
    }
    // A season made since its show was looked at (the listings job makes the next one): TMDB's poster in place of TVmaze's.
    const { rows: seasons } = await pool.query(
      `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
        WHERE s.tmdb_id IS NOT NULL AND s.archived = false AND NOT s.art_off AND NOT ss.art_by_hand AND ss.status <> 'completed'
          AND (ss.art_url IS NULL OR ss.art_url LIKE 'https://static.tvmaze.com/%')
        ORDER BY random() LIMIT 4`
    );
    for (const ss of seasons) if (await fillSeasonArt(ss.id, listingsBase)) out.seasons++;
  }
  const { rows: casts } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.archived = false AND NOT s.art_off AND EXISTS (SELECT 1 FROM season_cast sc WHERE sc.season_id = ss.id)
        AND (ss.photos_checked_at IS NULL
             OR (ss.status <> 'completed' AND ss.photos_checked_at < now() - interval '7 days')
             OR ss.photos_checked_at < now() - make_interval(days => $1))
      ORDER BY ss.photos_checked_at NULLS FIRST LIMIT 4`,
    [RECHECK_DAYS]
  );
  for (const c of casts) out.photos += (await fillCastPhotos(c.id, listingsBase)).found;
  return out;
}

// ---------- Choose art (the desk) ----------

export interface ArtChoices {
  tmdb: boolean;
  linked: boolean;
  show: ArtCandidate[];
  season: ArtCandidate[];
}

/** What an admin can choose from: the show's TMDB images and (with a season) the season's posters. */
export async function artChoices(showId: string, seasonId: string | null, listingsBase?: string): Promise<ArtChoices> {
  const show = await showRow(showId);
  if (!show || !tmdbOn()) return { tmdb: tmdbOn(), linked: false, show: [], season: [] };
  const tmdbId = await linkTmdb(show, listingsBase);
  if (!tmdbId) return { tmdb: true, linked: false, show: [], season: [] };
  const s = seasonId && /^[0-9a-f-]{36}$/i.test(seasonId) ? await seasonRow(seasonId) : null;
  const [showImages, seasonImages] = await Promise.all([
    tmdb<TmdbImages>(`/tv/${tmdbId}/images?include_image_language=en,null`),
    s && s.show_id === showId ? tmdb<TmdbImages>(`/tv/${tmdbId}/season/${tmdbSeason(s)}/images?include_image_language=en,null`) : Promise.resolve(null),
  ]);
  return { tmdb: true, linked: true, show: artCandidates(showImages), season: artCandidates({ posters: seasonImages?.posters }) };
}

// ---------- the desk: what a show has, per frame; Choose art, TMDB on its own, a link, framing, the off switch ----------

/** The header (shows.backdrop_url: its page and Up next) and the cards (a season's poster, else the show's: Your shows and the
 *  guide), each with where it's from and its framing (docs/PLAN-desk-parity.md part 7b, Noticed x). */
export type ArtFrameKey = "header" | "cards";
export const ART_FRAMES: readonly ArtFrameKey[] = ["header", "cards"];

/** TMDB's or TVmaze's, found on their own; chosen from TMDB by hand; a link by hand; or nothing. */
export type ArtSource = "tmdb" | "tvmaze" | "chosen" | "link" | "none";

export interface DeskFrame {
  /** The image drawn: the header's backdrop (null: its page shows the cards' instead), the newest season's cards. */
  url: string | null;
  source: ArtSource;
  /** Its framing; null is as it comes (art-frame.ts UNFRAMED). */
  frame: Frame | null;
  /** The cards': the season whose own poster it is ("Survivor 51"), null for the show's own. */
  season: string | null;
  /** Something in it is chosen or linked by hand, so the finder leaves it alone (TMDB, on its own lets it go). */
  held: boolean;
}

export interface DeskArt {
  /** TMDB_READ_TOKEN is set (else only TVmaze's posters arrive). */
  tmdb: boolean;
  /** The show is linked to TMDB. */
  linked: boolean;
  poster: string | null;
  backdrop: string | null;
  byHand: boolean;
  off: boolean;
  checkedAt: string | null;
  seasons: { id: string; poster: string | null; byHand: boolean }[];
  header: DeskFrame;
  cards: DeskFrame;
  /** Each season's cast photos, newest first: how many of its cast have one. */
  photos: { id: string; name: string; number: number; cast: number; with: number }[];
}

const onTmdb = (url: string | null | undefined) => !!url && /^https:\/\/image\.tmdb\.org\//.test(url);
const onTvmaze = (url: string | null | undefined) => !!url && /^https:\/\/static\.tvmaze\.com\//.test(url);
const found = (url: string): ArtSource => (onTvmaze(url) ? "tvmaze" : "tmdb");
const handPicked = (url: string): ArtSource => (onTmdb(url) ? "chosen" : "link");

interface ArtShow {
  name: string;
  tmdb_id: number | null;
  art_url: string | null;
  backdrop_url: string | null;
  art_by_hand: boolean;
  backdrop_by_hand: boolean;
  art_link: boolean;
  art_off: boolean;
  art_style: unknown;
  backdrop_style: unknown;
  art_checked_at: Date | null;
}
interface ArtSeason {
  id: string;
  name: string;
  season_number: number;
  art_url: string | null;
  art_by_hand: boolean;
}

/** The header as the app draws it: the show's backdrop, framed. */
function headerOf(s: ArtShow): DeskFrame {
  const url = s.art_off ? null : s.backdrop_url || null;
  return {
    url,
    source: !url ? "none" : s.backdrop_by_hand ? handPicked(url) : found(url),
    frame: frameFor(s.backdrop_style, url, url),
    season: null,
    held: s.backdrop_by_hand,
  };
}

/** The cards as the app draws them for the newest season (art-sql.ts cardArtSql): the show's link over every season's own
 *  poster, else the season's own, else the show's. */
function cardsOf(s: ArtShow, newest: ArtSeason | undefined, seasons: ArtSeason[] = []): DeskFrame {
  const own = s.art_off ? null : s.art_url || null;
  const season = !s.art_off && !s.art_link && newest?.art_url ? newest : null;
  const url = season ? season.art_url : own;
  const source: ArtSource = !url
    ? "none"
    : s.art_link
      ? "link"
      : season
        ? season.art_by_hand
          ? "chosen"
          : found(url)
        : s.art_by_hand
          ? handPicked(url)
          : found(url);
  return { url, source, frame: frameFor(s.art_style, url, s.art_url), season: season?.name ?? null, held: s.art_by_hand || s.art_link || seasons.some((x) => x.art_by_hand) };
}

const ART_COLUMNS = "name, tmdb_id, art_url, backdrop_url, art_by_hand, backdrop_by_hand, art_link, art_off, art_style, backdrop_style, art_checked_at";

async function artRows(showId: string, db: Pick<PoolClient, "query"> = pool, lock = false): Promise<{ show: ArtShow; seasons: ArtSeason[] }> {
  const { rows } = await db.query(`SELECT ${ART_COLUMNS} FROM shows WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [showId]);
  if (!rows.length) throw new Error("Show not found");
  const { rows: seasons } = await db.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.season_number, ss.art_url, ss.art_by_hand
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1 ORDER BY ss.season_number DESC`,
    [showId]
  );
  return { show: rows[0], seasons };
}

export async function deskArt(showId: string): Promise<DeskArt> {
  const [{ show: s, seasons }, { rows: photos }] = await Promise.all([
    artRows(showId),
    pool.query(
      `SELECT ss.id, count(sc.id)::int AS cast_n, count(sc.id) FILTER (WHERE COALESCE(sc.photo_url, '') <> '')::int AS with_n
         FROM show_seasons ss LEFT JOIN season_cast sc ON sc.season_id = ss.id WHERE ss.show_id = $1 GROUP BY ss.id`,
      [showId]
    ),
  ]);
  const castOf = new Map(photos.map((p) => [p.id as string, p]));
  return {
    tmdb: tmdbOn(),
    linked: !!s.tmdb_id,
    poster: s.art_url || null,
    backdrop: s.backdrop_url || null,
    byHand: s.art_by_hand || s.backdrop_by_hand,
    off: s.art_off,
    checkedAt: s.art_checked_at ? s.art_checked_at.toISOString() : null,
    seasons: seasons.map((x) => ({ id: x.id, poster: x.art_url || null, byHand: x.art_by_hand })),
    header: headerOf(s),
    cards: cardsOf(s, seasons[0], seasons),
    photos: seasons.map((x) => ({ id: x.id, name: x.name, number: x.season_number, cast: castOf.get(x.id)?.cast_n ?? 0, with: castOf.get(x.id)?.with_n ?? 0 })),
  };
}

/** Everything the desk's art changes touch, to put back on Undo (desk-show-art.ts) and to tell whether it moved since. */
export interface ArtSnapshot {
  show: Omit<ArtShow, "name" | "tmdb_id" | "art_checked_at"> & { logo_url: string | null };
  seasons: [string, string | null, boolean][];
}

export async function artSnapshot(showId: string, db: Pick<PoolClient, "query"> = pool): Promise<ArtSnapshot> {
  const { rows } = await db.query(
    "SELECT art_url, backdrop_url, logo_url, art_by_hand, backdrop_by_hand, art_link, art_off, art_style, backdrop_style FROM shows WHERE id = $1",
    [showId]
  );
  const { rows: seasons } = await db.query("SELECT id, art_url, art_by_hand FROM show_seasons WHERE show_id = $1 ORDER BY id", [showId]);
  return { show: rows[0], seasons: seasons.map((x) => [x.id, x.art_url, x.art_by_hand]) };
}

export async function putArtBack(showId: string, was: ArtSnapshot, db: Pick<PoolClient, "query"> = pool) {
  const w = was.show;
  await db.query(
    `UPDATE shows SET art_url = $2, backdrop_url = $3, logo_url = $4, art_by_hand = $5, backdrop_by_hand = $6, art_link = $7, art_off = $8,
            art_style = $9::jsonb, backdrop_style = $10::jsonb, updated_at = now() WHERE id = $1`,
    [showId, w.art_url, w.backdrop_url, w.logo_url, w.art_by_hand, w.backdrop_by_hand, w.art_link, w.art_off, w.art_style == null ? null : JSON.stringify(w.art_style), w.backdrop_style == null ? null : JSON.stringify(w.backdrop_style)]
  );
  for (const [id, url, byHand] of was.seasons) await db.query("UPDATE show_seasons SET art_url = $3, art_by_hand = $4 WHERE id = $2 AND show_id = $1", [showId, id, url, byHand]);
}

/** Only TMDB's own image host may be chosen through Choose art (a link is the frame's own: setArtLink). */
const chosen = (url: unknown) => (typeof url === "string" && /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9_]+\/[\w.-]+$/i.test(url) ? url : null);

/** The cards' style without any framing (classic's colour and strength stay), as SQL: a new show poster starts unframed,
 *  classic's framing of the old one too. */
const CARDS_UNFRAMED = "NULLIF(COALESCE(art_style, '{}'::jsonb) - 'frame' - 'x' - 'y' - 'zoom', '{}'::jsonb)";
/** Without the desk's framing only (art_style.frame): the show's own poster is unchanged, so classic's framing of it stays. */
const DESK_UNFRAMED = "NULLIF(COALESCE(art_style, '{}'::jsonb) - 'frame', '{}'::jsonb)";

/** Choose art: the header's image, the show's poster or a season's, chosen by hand (the finder leaves that frame alone after;
 *  a poster chosen puts the cards back on posters, from a link). Its framing starts over. */
export async function chooseArt(showId: string, body: { poster?: unknown; backdrop?: unknown; seasonId?: unknown; seasonPoster?: unknown }): Promise<string> {
  const poster = chosen(body.poster);
  const backdrop = chosen(body.backdrop);
  const seasonPoster = chosen(body.seasonPoster);
  if (backdrop) {
    await pool.query("UPDATE shows SET backdrop_url = $2, backdrop_by_hand = true, backdrop_style = NULL, art_off = false, updated_at = now() WHERE id = $1", [showId, backdrop]);
    return "the header's image";
  }
  if (poster) {
    await pool.query(`UPDATE shows SET art_url = $2, art_by_hand = true, art_link = false, art_style = ${CARDS_UNFRAMED}, art_off = false, updated_at = now() WHERE id = $1`, [showId, poster]);
    return "the cards' poster";
  }
  if (seasonPoster && typeof body.seasonId === "string" && /^[0-9a-f-]{36}$/i.test(body.seasonId)) {
    const { rowCount } = await pool.query("UPDATE show_seasons SET art_url = $3, art_by_hand = true WHERE id = $2 AND show_id = $1", [showId, body.seasonId, seasonPoster]);
    if (rowCount) {
      await pool.query(`UPDATE shows SET art_link = false, art_style = ${DESK_UNFRAMED}, updated_at = now() WHERE id = $1`, [showId]);
      return "the season's poster";
    }
  }
  throw new Error("Pick one of TMDB's images");
}

/** TMDB, on its own, for one frame: nothing in it chosen or linked by hand any more (a link goes), and the finder looks now.
 *  Throws when the frame is on its own already. */
export async function artFromTmdb(showId: string, key: ArtFrameKey, listingsBase?: string) {
  if (key === "header") {
    const { rowCount } = await pool.query(
      // A link goes; a backdrop chosen from TMDB stays until TMDB's own pick replaces it (as the cards' poster does), so a TMDB
      // that doesn't answer never leaves the header empty.
      `UPDATE shows SET backdrop_by_hand = false, backdrop_url = CASE WHEN backdrop_url ~ '^https://image\\.tmdb\\.org/' THEN backdrop_url END,
              updated_at = now() WHERE id = $1 AND backdrop_by_hand`,
      [showId]
    );
    if (!rowCount) throw new Error("Its header is on TMDB, on its own already");
    await fillShowArt(showId, listingsBase);
    return;
  }
  const { rows } = await pool.query(
    "SELECT art_by_hand OR art_link OR EXISTS (SELECT 1 FROM show_seasons ss WHERE ss.show_id = s.id AND ss.art_by_hand) AS held FROM shows s WHERE s.id = $1",
    [showId]
  );
  if (!rows[0]?.held) throw new Error("Its cards are on TMDB, on its own already");
  // A link (anything not TMDB's or TVmaze's) goes; a poster chosen from TMDB stays until TMDB's own pick replaces it.
  await pool.query(
    `UPDATE shows SET art_by_hand = false, art_link = false,
            art_url = CASE WHEN art_url ~ '^https://(image\\.tmdb\\.org|static\\.tvmaze\\.com)/' THEN art_url END, updated_at = now() WHERE id = $1`,
    [showId]
  );
  await pool.query("UPDATE show_seasons SET art_by_hand = false WHERE show_id = $1", [showId]);
  await fillShowArt(showId, listingsBase);
  const { rows: seasons } = await pool.query("SELECT id FROM show_seasons WHERE show_id = $1 ORDER BY season_number DESC LIMIT 5", [showId]);
  for (const ss of seasons) await fillSeasonArt(ss.id, listingsBase);
}

/** A link for one frame (art-frame.ts cleanArtLink: the desk loaded it before sending it): the header's image, or the cards'
 *  on every season over their own posters. Kept as the frame's, so TMDB never changes it, and its framing starts over. */
export async function setArtLink(showId: string, key: ArtFrameKey, url: string) {
  await pool.query(
    key === "header"
      ? "UPDATE shows SET backdrop_url = $2, backdrop_by_hand = true, backdrop_style = NULL, updated_at = now() WHERE id = $1"
      : `UPDATE shows SET art_url = $2, art_by_hand = true, art_link = true, art_style = ${CARDS_UNFRAMED}, updated_at = now() WHERE id = $1`,
    [showId, url]
  );
}

/** The framing of one frame, on the image it's drawn with now (`url`, as the desk saw it: refused when it changed since).
 *  The cards' sits in art_style beside classic's colour and strength, which stay. */
export async function setArtFrame(showId: string, key: ArtFrameKey, f: Frame, url: string): Promise<void> {
  const { show, seasons } = await artRows(showId);
  const now = key === "header" ? headerOf(show) : cardsOf(show, seasons[0]);
  if (!now.url || now.url !== url) throw new Error("Its art changed since: look again");
  if (key === "header") {
    await pool.query("UPDATE shows SET backdrop_style = $2::jsonb, updated_at = now() WHERE id = $1", [showId, JSON.stringify({ ...f, url })]);
    return;
  }
  // Under `frame`, beside classic's own (its framing of the show's poster, drawn wherever that poster is) and its look.
  await pool.query("UPDATE shows SET art_style = COALESCE(art_style, '{}'::jsonb) || jsonb_build_object('frame', $2::jsonb), updated_at = now() WHERE id = $1", [
    showId,
    JSON.stringify({ ...f, url }),
  ]);
}

/** A photo a finder brought (TMDB, TVmaze, the wiki, Wikipedia): what the off switch takes down. Chosen ones stay. */
const foundPhoto = (url: string | null) => !!url && (replaceablePhoto(url) || /^https:\/\/(image\.tmdb\.org|upload\.wikimedia\.org)\//.test(url));

/**
 * The per-show switch (e.g. for a removal request). On: the show's art, its seasons' posters and the cast photos a finder
 * brought are taken down (leagues on an approved cast lose them too) and nothing is looked for again. Off: it looks again.
 */
export async function setArtOff(showId: string, off: boolean, listingsBase?: string): Promise<{ photos: number }> {
  if (!off) {
    await pool.query("UPDATE shows SET art_off = false, updated_at = now() WHERE id = $1", [showId]);
    await findArtForShow(showId, listingsBase);
    return { photos: 0 };
  }
  await pool.query(
    "UPDATE shows SET art_off = true, art_url = NULL, backdrop_url = NULL, logo_url = NULL, art_by_hand = false, backdrop_by_hand = false, art_link = false, updated_at = now() WHERE id = $1",
    [showId]
  );
  await pool.query("UPDATE show_seasons SET art_url = NULL, art_by_hand = false WHERE show_id = $1", [showId]);
  let photos = 0;
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, s.slug, ss.season_number, ss.cast_approved_at, ss.tribes_from_episode FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1`,
    [showId]
  );
  for (const ss of seasons) {
    const { rows: cast } = await pool.query("SELECT id, photo_url FROM season_cast WHERE season_id = $1", [ss.id]);
    const down = cast.filter((c) => foundPhoto(c.photo_url)).map((c) => c.id);
    if (!down.length) continue;
    await pool.query("UPDATE season_cast SET photo_url = NULL WHERE id = ANY($1::uuid[])", [down]);
    photos += down.length;
    // syncSeasonCast only copies a photo that's there, so a league's copy is cleared by hand here.
    if (ss.cast_approved_at) await clearLeaguePhotos(ss.slug, ss.season_number, down);
  }
  return { photos };
}

/** Take the photos of these season_cast rows out of every league on the season (their linked castaways'). */
async function clearLeaguePhotos(slug: string, seasonNumber: number, seasonCastIds: string[]) {
  const ids = new Set(seasonCastIds);
  const { rows: leagues } = await pool.query(
    "SELECT id FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2",
    [slug, String(seasonNumber)]
  );
  for (const l of leagues) {
    await withLeagueLock(l.id, (state) => {
      for (const c of state.castaways) if (c.seasonCastId && ids.has(c.seasonCastId) && foundPhoto(c.photoUrl ?? null)) c.photoUrl = "";
    }).catch((e) => console.error("[show-art] clearing a league's photos:", e));
  }
}
