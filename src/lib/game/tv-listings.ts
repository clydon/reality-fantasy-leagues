// All of TV, the pure half (docs/PLAN-new-design.md step 11 part 2): what TVmaze's schedule answers become in tv_listings
// (the daily job, src/lib/server/tv-listings.ts), and what the guide's "Also on" makes of the week's listings (in the
// browser, in the viewer's own time zone, by the guide's own days: src/lib/game/guide.ts). Checked by
// tests/tv-listings.test.js; nothing here reads the network or the database.
//
// Measured 2026-10-26: a US day is ~130 episodes, more than half of them news; streaming (/schedule/web) is every country's
// and language's. So the job keeps the evening (5 PM to 3 AM where it airs) and streaming drops, in English on a US or
// worldwide service, and never the news. Never an episode's title: the guide shows when things air, not what happens.

import { eveningAt } from "./guide";
import { kindOf, sameShow, type ListingHit, type TvEpisode, type TvShow } from "./listing";

/** A show as TVmaze's schedule embeds it: a listing's show, plus its popularity (0-100). */
export type TvScheduleShow = TvShow & { weight?: number | null };

/** One entry of /schedule (the show as `show`) or /schedule/web (the show as `_embedded.show`). */
export interface TvScheduleEntry extends TvEpisode {
  id: number;
  show?: TvScheduleShow | null;
  _embedded?: { show?: TvScheduleShow | null } | null;
}

/** A tv_listings row. */
export interface ListingRow {
  episodeId: number;
  day: string;
  tvmazeId: number;
  airAt: string;
  runtimeMin: number | null;
  season: number | null;
  number: number | null;
  binge: boolean;
  name: string;
  type: string | null;
  network: string | null;
  country: string | null;
  weight: number;
  artUrl: string | null;
}

/** Where a schedule's shows air from, for linking a show added by name (any of the day's shows but the news). */
export interface ScheduleShow {
  tvmazeId: number;
  name: string;
  country: string | null;
}

const ZONE = "America/New_York";

/** A day's date where the US networks are (TVmaze's schedule dates are theirs), `n` days on from `now`. */
export function easternDay(now = new Date(), n = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (!n) return today;
  return new Date(Date.parse(`${today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The days the job reads: today in the East and the seven after. */
export function listingDays(now = new Date(), days = 8): string[] {
  return Array.from({ length: days }, (_, i) => easternDay(now, i));
}

/** An evening's airing: from 5 PM to 3 AM where it airs (TVmaze's `airtime` is the network's own clock). */
export function eveningTime(airtime: string | null | undefined): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(airtime ?? "");
  if (!m) return false;
  const h = Number(m[1]);
  return h >= 17 || h < 3;
}

const showOf = (e: TvScheduleEntry): TvScheduleShow | null => e.show ?? e._embedded?.show ?? null;
const isNews = (s: TvScheduleShow) => (s.type ?? "").trim().toLowerCase() === "news";
const whereOf = (s: TvScheduleShow) => s.network ?? s.webChannel ?? null;
const minutes = (n: number | null | undefined) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 600 ? (n as number) : null);

/**
 * A day's two schedules as tv_listings rows: the networks' evening (/schedule?country=US) and streaming (/schedule/web) in
 * English on a US or worldwide service (a UK or New Zealand service's shows can't be watched here), evening airings and
 * drops (no air time), never the news. An episode on a network and its streaming service at once is one row (the
 * network's). `shows` is every show of the day but the news, for linking a show added by name.
 */
export function scheduleRows(day: string, us: TvScheduleEntry[], web: TvScheduleEntry[]): { rows: ListingRow[]; shows: ScheduleShow[] } {
  const rows = new Map<number, ListingRow>();
  const shows = new Map<number, ScheduleShow>();
  const take = (e: TvScheduleEntry, streaming: boolean) => {
    const s = showOf(e);
    if (!s?.id || !s.name || !Number.isInteger(e.id) || isNews(s)) return;
    const where = whereOf(s);
    const country = where?.country?.code ?? null;
    if (streaming && ((s.language ?? "") !== "English" || (country != null && country !== "US"))) return;
    if (!shows.has(s.id)) shows.set(s.id, { tvmazeId: s.id, name: s.name, country });
    const at = e.airstamp ? Date.parse(e.airstamp) : NaN;
    if (!Number.isFinite(at) || rows.has(e.id)) return;
    const drop = streaming && !e.airtime;
    if (!drop && !eveningTime(e.airtime)) return;
    rows.set(e.id, {
      episodeId: e.id,
      day,
      tvmazeId: s.id,
      airAt: new Date(at).toISOString(),
      runtimeMin: minutes(e.runtime) ?? minutes(s.averageRuntime),
      season: Number.isInteger(e.season) ? e.season : null,
      number: Number.isInteger(e.number) && (e.number as number) > 0 ? (e.number as number) : null,
      binge: drop,
      name: s.name.slice(0, 120),
      type: s.type ?? null,
      network: where?.name ?? null,
      country,
      weight: Number.isFinite(s.weight) ? Math.max(0, Math.min(100, Math.round(s.weight as number))) : 0,
      artUrl: s.image?.medium ?? s.image?.original ?? null,
    });
  };
  for (const e of us) take(e, false);
  for (const e of web) take(e, true);
  return { rows: [...rows.values()], shows: [...shows.values()] };
}

// ---------- the week, as the guide reads it (/api/listings/week) ----------

/** An airing in the week's listings: a show's episodes starting together (a drop's, or a double episode) are one. */
export interface WeekListing {
  tvmazeId: number;
  name: string;
  network: string | null;
  /** Where its network or service is ("US"; null for a worldwide one). */
  country: string | null;
  type: string | null;
  art: string | null;
  weight: number;
  airAt: string;
  runtimeMin: number | null;
  season: number | null;
  numbers: number[];
  binge: boolean;
}

/** The rows as airings: one per show and start, in time order. */
export function weekListings(
  rows: Pick<ListingRow, "tvmazeId" | "name" | "network" | "country" | "type" | "artUrl" | "weight" | "airAt" | "runtimeMin" | "season" | "number" | "binge">[]
): WeekListing[] {
  const out = new Map<string, WeekListing>();
  for (const r of rows) {
    const key = `${r.tvmazeId}@${r.airAt}`;
    const had = out.get(key);
    if (had) {
      if (r.number != null && !had.numbers.includes(r.number)) had.numbers.push(r.number);
      had.runtimeMin = Math.max(had.runtimeMin ?? 0, r.runtimeMin ?? 0) || null;
      continue;
    }
    out.set(key, {
      tvmazeId: r.tvmazeId,
      name: r.name,
      network: r.network,
      country: r.country,
      type: r.type,
      art: r.artUrl,
      weight: r.weight,
      airAt: r.airAt,
      runtimeMin: r.runtimeMin,
      season: r.season,
      numbers: r.number != null ? [r.number] : [],
      binge: r.binge,
    });
  }
  return [...out.values()].map((l) => ({ ...l, numbers: l.numbers.sort((a, b) => a - b) })).sort((a, b) => a.airAt.localeCompare(b.airAt) || b.weight - a.weight || a.name.localeCompare(b.name));
}

// ---------- Also on (the browser) ----------

export interface AlsoOnItem extends WeekListing {
  key: string;
  at: number;
  endsAt: number;
}

export interface AlsoOnDay {
  offset: number;
  /** The evening's most watched few, in time order. */
  few: AlsoOnItem[];
  /** The whole evening, in time order (drops first): "N more on TV". */
  all: AlsoOnItem[];
}

/** How many of an evening's listings show under your shows; the rest are "N more on TV". */
export const ALSO_ON_FEW = 3;
const RUNTIME_MIN = 60;

/** What Also on leaves out: your shows, the couch's and what you've hidden, by their listing, and (a show here that hasn't
 *  one yet) by name. */
export interface AlsoOnExclude {
  ids: Set<number>;
  names: string[];
}

/**
 * Each guide day's evening on TV, less what's excluded. A day is the guide's (from 3 AM: guide.ts), its evening from 5 PM to
 * its end, and a drop counts all day. Today leaves out what's already over. The few are the most watched (TVmaze's weight),
 * shown in time order.
 */
export function alsoOn(listings: WeekListing[], days: { offset: number; start: number }[], exclude: AlsoOnExclude, now: number, few = ALSO_ON_FEW): AlsoOnDay[] {
  const items: AlsoOnItem[] = listings
    .filter((l) => !exclude.ids.has(l.tvmazeId) && !exclude.names.some((name) => sameShow(name, l)))
    .map((l) => {
      const at = Date.parse(l.airAt);
      return { ...l, key: `${l.tvmazeId}@${l.airAt}`, at, endsAt: at + (l.runtimeMin ?? RUNTIME_MIN) * 60_000 };
    })
    .filter((l) => Number.isFinite(l.at));
  return days.map((d, i) => {
    const end = days[i + 1]?.start ?? d.start + 24 * 3600_000;
    const all = items
      .filter((l) => l.at >= d.start && l.at < end && (l.binge || eveningAt(l.at)))
      .filter((l) => d.offset !== 0 || l.binge || l.endsAt > now)
      .sort((a, b) => Number(b.binge) - Number(a.binge) || a.at - b.at || b.weight - a.weight);
    const top = new Set([...all].sort((a, b) => b.weight - a.weight || a.at - b.at).slice(0, few).map((l) => l.key));
    return { offset: d.offset, few: all.filter((l) => top.has(l.key)), all };
  });
}

/** "S35 · ABC", "Netflix · 3 episodes", "Special · NBC": never a title. TVmaze numbers a daily show's seasons by year. */
export function listingLine(l: Pick<WeekListing, "season" | "numbers" | "binge" | "network">): string {
  const parts: string[] = [];
  if (!l.numbers.length) parts.push("Special");
  else if (l.season != null && l.season < 1900) parts.push(`S${l.season}`);
  if (l.network) parts.push(l.network);
  if (l.binge && l.numbers.length > 1) parts.push(`${l.numbers.length} episodes`);
  return parts.join(" · ") || "On TV";
}

/** A week listing as Add a show's listing path takes it (where you are is read from the listing's season). */
export function hitOfListing(l: Pick<WeekListing, "tvmazeId" | "name" | "type" | "network" | "country" | "art">): ListingHit {
  return {
    tvmazeId: l.tvmazeId,
    name: l.name,
    kind: kindOf(l.type),
    type: l.type,
    network: l.network,
    country: l.country,
    year: null,
    running: true,
    art: l.art,
    thumb: l.art,
    url: `https://www.tvmaze.com/shows/${l.tvmazeId}`,
  };
}
