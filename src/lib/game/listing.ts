// TV listings, the pure half (docs/PLAN-new-design.md step 10 part 1): what TVmaze's answers (src/lib/server/listings.ts)
// become here. A search hit for Add a show's suggestions, the season someone means by "add this show" (the one on now,
// else the next, else the latest), its status and episodes, a first guess at the kind of show, and whether a show already
// here is the same show. Checked by tests/listing.test.js; nothing here reads the network or the database.
//
// TVmaze's data is CC BY-SA: wherever it's shown, it's credited with a link back (Add a show's foot).

export type ShowKind = "competition" | "series" | "talk" | "sport";

/** The parts of a TVmaze show the app reads. */
export interface TvShow {
  id: number;
  name: string;
  type?: string | null;
  language?: string | null;
  genres?: string[] | null;
  /** TVmaze's blurb (HTML): read only for whether a listed show is a competition (tv-listings.ts competitionOf). */
  summary?: string | null;
  status?: string | null;
  premiered?: string | null;
  ended?: string | null;
  url?: string | null;
  averageRuntime?: number | null;
  runtime?: number | null;
  schedule?: { time?: string | null; days?: string[] | null } | null;
  network?: { name?: string | null; country?: { code?: string | null; timezone?: string | null } | null } | null;
  webChannel?: { name?: string | null; country?: { code?: string | null; timezone?: string | null } | null } | null;
  image?: { medium?: string | null; original?: string | null } | null;
  /** Its ids elsewhere: how the show is found on TMDB (src/lib/server/show-art.ts). */
  externals?: { imdb?: string | null; thetvdb?: number | null } | null;
}

export interface TvSeason {
  id: number;
  number: number;
  name?: string | null;
  episodeOrder?: number | null;
  premiereDate?: string | null;
  endDate?: string | null;
  /** The season's own poster (the season's art until TMDB has one: show-art.ts). */
  image?: { medium?: string | null; original?: string | null } | null;
}

export interface TvEpisode {
  id?: number;
  season: number;
  number: number | null;
  type?: string | null;
  name?: string | null;
  airdate?: string | null;
  airtime?: string | null;
  airstamp?: string | null;
  runtime?: number | null;
}

/** A show as Add a show's suggestions show it (and what adding it stores in shows.listing). */
export interface ListingHit {
  tvmazeId: number;
  name: string;
  /** The kind it's guessed to be, from its type (Make it a game asks ChatGPT and offers Change: part 2). */
  kind: ShowKind;
  /** TVmaze's type ("Reality", "Scripted", "Talk Show"...). */
  type: string | null;
  /** Where it airs: the network, else the streaming service. */
  network: string | null;
  /** That network's country code ("US", "GB"), when it has one. */
  country: string | null;
  /** The year it first aired. */
  year: number | null;
  /** Still making new episodes. */
  running: boolean;
  /** Its poster (portrait), from TVmaze's image CDN (hotlinking is allowed): the show's art once added. The medium one
   *  (about 210 by 295, ~25 KB): TVmaze's other size is the upload itself (often over a megabyte). */
  art: string | null;
  /** The poster for a search row or a suggestion (the same medium one today). */
  thumb: string | null;
  /** The show's page on TVmaze: the link back the licence asks for. */
  url: string | null;
}

const TALK = new Set(["talk show", "variety", "award show", "panel show"]);
const SERIES = new Set(["scripted", "animation", "documentary", "news"]);

/**
 * A first guess at the kind of show from its listing. The listing can't tell a reality competition from a reality series
 * (TVmaze calls Survivor and Below Deck both "Reality"), so reality is taken as a competition, the kind most shows people
 * play are; Make it a game's review shows the kind as one line with Change.
 */
export function kindOf(type: string | null | undefined, genres: string[] | null | undefined = []): ShowKind {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "sports" || (genres ?? []).some((g) => g.toLowerCase() === "sports")) return "sport";
  if (TALK.has(t)) return "talk";
  if (SERIES.has(t)) return "series";
  return "competition";
}

const year = (date: string | null | undefined) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);

export function hitOf(show: TvShow): ListingHit {
  const where = show.network ?? show.webChannel ?? null;
  return {
    tvmazeId: show.id,
    name: show.name,
    kind: kindOf(show.type, show.genres),
    type: show.type ?? null,
    network: where?.name ?? null,
    country: (show.network?.country ?? show.webChannel?.country)?.code ?? null,
    year: year(show.premiered),
    running: (show.status ?? "").toLowerCase() !== "ended",
    art: show.image?.medium ?? show.image?.original ?? null,
    thumb: show.image?.medium ?? show.image?.original ?? null,
    url: show.url ?? null,
  };
}

/** The time zone a show's air times are in: its network's country's (a global streaming service has none). */
export function zoneOf(show: TvShow): string | null {
  return show.network?.country?.timezone ?? show.webChannel?.country?.timezone ?? null;
}

// ---------- which season, and how it's going ----------

const dayOf = (now: Date) => now.toISOString().slice(0, 10);

export type SeasonStatus = "upcoming" | "airing" | "completed";

/** A season's status on `now`'s date: no premiere yet (or none known) is upcoming; past its end date, completed. */
export function seasonStatus(season: TvSeason, now = new Date()): SeasonStatus {
  const today = dayOf(now);
  if (!season.premiereDate || season.premiereDate > today) return "upcoming";
  if (season.endDate && season.endDate < today) return "completed";
  return "airing";
}

/**
 * The season someone means by "add this show": the one on now (the latest, if two overlap), else the next to premiere,
 * else the latest that has aired, else (nothing dated) the first one listed. Null when the listing has no seasons.
 */
export function pickSeason(seasons: TvSeason[], now = new Date()): TvSeason | null {
  const dated = seasons.filter((s) => !!s.premiereDate).sort((a, b) => a.number - b.number);
  const airing = dated.filter((s) => seasonStatus(s, now) === "airing");
  if (airing.length) return airing[airing.length - 1];
  const next = dated.filter((s) => seasonStatus(s, now) === "upcoming").sort((a, b) => (a.premiereDate ?? "").localeCompare(b.premiereDate ?? ""));
  if (next.length) return next[0];
  if (dated.length) return dated[dated.length - 1];
  return [...seasons].sort((a, b) => a.number - b.number)[0] ?? null;
}

export interface ListedEpisode {
  number: number;
  /** UTC ISO start. */
  airAt: string | null;
  runtimeMin: number | null;
  title: string | null;
}

/** A season's regular episodes in order (specials carry no number, so they're left out), each with when it airs. */
export function episodesOf(episodes: TvEpisode[]): ListedEpisode[] {
  const out = new Map<number, ListedEpisode>();
  for (const e of episodes) {
    if (!Number.isInteger(e.number) || (e.number as number) < 1) continue;
    if (e.type && e.type !== "regular") continue;
    const at = e.airstamp ? new Date(e.airstamp) : null;
    out.set(e.number as number, {
      number: e.number as number,
      airAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
      runtimeMin: Number.isInteger(e.runtime) && (e.runtime as number) >= 1 && (e.runtime as number) <= 600 ? (e.runtime as number) : null,
      title: e.name?.trim() ? e.name.trim().slice(0, 200) : null,
    });
  }
  return [...out.values()].sort((a, b) => a.number - b.number);
}

/** How a season is released: every episode on one day (three or more) is a streaming drop, else weekly. */
export function releaseOf(episodes: TvEpisode[]): { release: "weekly" | "binge"; dropAt: string | null } {
  const regular = episodes.filter((e) => Number.isInteger(e.number) && (!e.type || e.type === "regular") && e.airdate);
  const days = new Set(regular.map((e) => e.airdate));
  if (regular.length >= 3 && days.size === 1) {
    const first = regular.map((e) => e.airstamp).find((s) => !!s);
    return { release: "binge", dropAt: first ? new Date(first).toISOString() : null };
  }
  return { release: "weekly", dropAt: null };
}

/** How many of these have started by `now`: what "where you are" can go up to. */
export function airedOf(episodes: ListedEpisode[], now = new Date()): number {
  let n = 0;
  for (const e of episodes) if (e.airAt && Date.parse(e.airAt) <= now.getTime()) n = Math.max(n, e.number);
  return n;
}

/** The air time a weekly season's episodes start at ("21:00"), from the listing's schedule. */
export function airTimeOf(show: TvShow): string | null {
  const t = show.schedule?.time ?? "";
  return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : null;
}

// ---------- is it the same show? ----------

/** A show's name for comparing: lower case, no "The", no parenthetical ("(US)"), letters and digits only. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

const COUNTRY_WORDS: [string, string][] = [
  ["us", "US"], ["usa", "US"], ["america", "US"], ["american", "US"], ["uk", "GB"], ["britain", "GB"], ["british", "GB"],
  ["australia", "AU"], ["australian", "AU"], ["canada", "CA"], ["nz", "NZ"],
];
const countryWord = (w: string) => COUNTRY_WORDS.find(([word]) => word === w)?.[1] ?? null;

/**
 * A show's name split into what identifies it and the country it's from, if the name says ("Love Island USA", "The Traitors
 * (US)", "The Amazing Race (American edition)", "Big Brother UK").
 */
export function nameParts(name: string): { key: string; country: string | null } {
  let country: string | null = null;
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    for (const w of m[1].toLowerCase().split(/[^a-z]+/)) country = country ?? countryWord(w);
  }
  const words = name.replace(/\([^)]*\)/g, " ").trim().split(/\s+/);
  const last = countryWord((words[words.length - 1] ?? "").toLowerCase().replace(/[^a-z]/g, ""));
  if (last && words.length > 1) {
    country = country ?? last;
    words.pop();
  }
  return { key: nameKey(words.join(" ")), country };
}

/**
 * Whether a show already here is this listing's show: the same name from the same country. A name that doesn't say its
 * country is taken as American (the shows the app was made with), so "Survivor" here is CBS's, "The Traitors (US)" is
 * Peacock's and not the BBC's, and "Love Island USA" is the American "Love Island".
 */
export function sameShow(name: string, hit: Pick<ListingHit, "name" | "country">): boolean {
  const ours = nameParts(name);
  const theirs = nameParts(hit.name);
  if (!ours.key || ours.key !== theirs.key) return false;
  const a = ours.country ?? "US";
  const b = theirs.country ?? hit.country ?? a;
  return a === b;
}

/** A slug for a new show (shows.slug, what leagues store): its name in lower case with hyphens. */
export function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "show"
  );
}
