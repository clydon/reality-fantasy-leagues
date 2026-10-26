import { airedOf, episodesOf, hitOf, pickSeason, seasonStatus, type ListingHit, type TvEpisode, type TvSeason, type TvShow } from "@/lib/game/listing";
import type { TvCastRow } from "@/lib/game/make-game";

// TV listings from TVmaze (docs/PLAN-new-design.md step 10 part 1; docs/HOSTING.md): free, no key, CC BY-SA (credited with
// a link back wherever it's shown), at least 20 calls every 10 seconds per IP. Asked only when someone searches Add a show
// or adds a show (never on a timer: step 11's daily schedule job is 11's), from the server so the browser talks only to us
// and the answers can sit in Vercel's edge cache. The pure half (what the answers become) is src/lib/game/listing.ts.

const TVMAZE = "https://api.tvmaze.com";
const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };
const TIMEOUT_MS = 8000;

/** TVmaze didn't answer (down, slow, or asking us to slow down): Add a show still has the shows already here. */
export class ListingsUnavailable extends Error {}

/**
 * Where to ask: TVmaze, or (`next dev` only, a loopback address) a check's stand-in named by the request's `x-gys-listings`
 * header (scripts/dev-test/fake-listings.js), so checks never depend on TVmaze. Production never reads the header.
 */
export function listingsFor(req: Request): string {
  if (process.env.NODE_ENV !== "development") return TVMAZE;
  const asked = req.headers.get("x-gys-listings");
  if (!asked) return TVMAZE;
  try {
    const u = new URL(asked);
    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u.origin;
  } catch {
    /* not a URL: TVmaze, as for anyone */
  }
  return TVMAZE;
}

async function tv<T>(base: string, path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(base + path, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new ListingsUnavailable(`TV listings didn't answer (${(e as Error).name})`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ListingsUnavailable(`TV listings answered ${res.status}`);
  return (await res.json()) as T;
}

/** Shows whose names match, best first (TVmaze's fuzzy search, up to ten). */
export async function searchListings(q: string, base = TVMAZE): Promise<ListingHit[]> {
  const found = await tv<{ score: number; show: TvShow }[]>(base, `/search/shows?q=${encodeURIComponent(q)}`);
  return (found ?? []).filter((r) => r?.show?.id && r.show.name).map((r) => hitOf(r.show));
}

/** A show and its seasons, or null when TVmaze has no such show. */
export async function showListing(id: number, base = TVMAZE): Promise<{ show: TvShow; seasons: TvSeason[] } | null> {
  const show = await tv<TvShow & { _embedded?: { seasons?: TvSeason[] } }>(base, `/shows/${id}?embed=seasons`);
  if (!show) return null;
  const { _embedded, ...rest } = show;
  return { show: rest, seasons: _embedded?.seasons ?? [] };
}

/** One season's episodes. */
export async function seasonListing(tvSeasonId: number, base = TVMAZE): Promise<TvEpisode[]> {
  return (await tv<TvEpisode[]>(base, `/seasons/${tvSeasonId}/episodes`)) ?? [];
}

/** A show's main cast (TVmaze's /shows/:id/cast: people and the characters they play), for Make it a game (step 10 part 2a). */
export async function showCast(id: number, base = TVMAZE): Promise<TvCastRow[]> {
  return (await tv<TvCastRow[]>(base, `/shows/${id}/cast`)) ?? [];
}

export interface ListingSeason {
  hit: ListingHit;
  /** The season adding it would follow (on now, else the next, else the latest), or null with none listed. */
  season: { number: number; name: string | null; status: "upcoming" | "airing" | "completed"; premiere: string | null; aired: number; episodeCount: number | null } | null;
}

/** What adding a show from its listing would follow, for where you are before it's added (first run, Add a show). */
export async function listingSeason(id: number, base = TVMAZE, now = new Date()): Promise<ListingSeason | null> {
  const found = await showListing(id, base);
  if (!found) return null;
  const season = pickSeason(found.seasons, now);
  if (!season) return { hit: hitOf(found.show), season: null };
  const episodes = episodesOf(await seasonListing(season.id, base));
  const status = seasonStatus(season, now);
  return {
    hit: hitOf(found.show),
    season: {
      number: season.number,
      name: season.name?.trim() || null,
      status,
      premiere: season.premiereDate ?? null,
      aired: airedOf(episodes, now),
      episodeCount: season.episodeOrder && season.episodeOrder > 0 ? season.episodeOrder : status === "completed" ? episodes.length || null : null,
    },
  };
}
