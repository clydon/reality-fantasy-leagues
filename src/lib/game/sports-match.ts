import { easternDay } from "./tv-listings";

// Which provider event an episode of a sport shows (docs/PLAN-sports-data.md step 2; src/lib/server/sports/link.ts), for any
// sport, from the listing alone: its air date and its title. A game between teams fits when both teams are named in the title
// ("Game 1: Tampa Bay Rays at Milwaukee Brewers" names the Rays and the Brewers, by any name the provider gives them: "Rays",
// "Tampa Bay"); an event with a field (a race, a tournament) fits by the words its name shares with the title ("United States
// Grand Prix" and ESPN's "MSC Cruises United States Grand Prix"). Nothing here knows a sport: the words that only say when or
// join two names ("Game", "Week", "at", "vs") are a small generic list, as show-words.ts keeps one.

/** Structurally the provider's shapes (src/lib/server/sports/types.ts), only what matching reads. */
export interface MatchTeam {
  id: string;
  name: string;
  also: string[];
}
export interface MatchEvent {
  id: string;
  name: string;
  short: string | null;
  at: string | null;
  competitors: { team: MatchTeam | null }[];
  parts: { id: string; name: string | null; at: string | null }[];
}
export interface MatchEpisode {
  number: number;
  airAt: string | null;
  title: string | null;
}

/** An event starts no more than this far from the episode's air time (a delayed broadcast, a listing a day out). */
export const NEAR_MS = 36 * 3600_000;

// Words that say when or join two names, never what (a team, a place, a race).
const FILLER = new Set(["the", "a", "an", "of", "and", "at", "vs", "v", "versus", "in", "on", "live", "coverage", "game", "games", "week", "round", "day", "night", "part", "episode", "season", "no", "if", "necessary"]);
const CONNECTOR = /\s+(?:at|vs\.?|v\.?|versus|@)\s+/i;

/** A name's words: lowercase, accents and punctuation gone ("Brighton & Hove Albion" -> brighton hove albion). */
export function wordsOf(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Whether `needle`'s words appear together, in order, in `hay`. */
function contains(hay: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > hay.length) return false;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * The two sides a title names ("Game 1: Tampa Bay Rays at Milwaukee Brewers" -> Tampa Bay Rays, Milwaukee Brewers), or null
 * when it isn't a matchup. A label before a colon and anything in brackets or after a dash are left off each side.
 */
export function matchupOf(title: string | null): [string, string] | null {
  if (!title) return null;
  for (const part of [...title.split(":").reverse(), title]) {
    const clean = part.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    const sides = clean.split(CONNECTOR);
    if (sides.length !== 2) continue;
    const [a, b] = sides.map((s) => s.split(/\s+[-–—]\s+/)[0].trim());
    if (wordsOf(a).length && wordsOf(b).length) return [a, b];
  }
  return null;
}

/** The sides a season's titles name, most often named first (what to ask the provider's search for). */
export function sidesOf(titles: (string | null)[], max = 4): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const t of titles) {
    for (const side of matchupOf(t) ?? []) {
      const key = wordsOf(side).join(" ");
      const c = count.get(key) ?? { name: side, n: 0 };
      c.n++;
      count.set(key, c);
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max).map((c) => c.name);
}

/** How strongly a title names a team: the most words of any of its names found together in it (0: not named). */
export function named(team: MatchTeam, title: string[]): number {
  let best = 0;
  for (const n of [team.name, ...team.also]) {
    const w = wordsOf(n);
    if (w.length > best && contains(title, w)) best = w.length;
  }
  return best;
}

/** A title's words that say what, not when: no filler, no bare numbers, none of the show's own name. */
function telling(words: string[], show: Set<string>): string[] {
  return words.filter((w) => !FILLER.has(w) && !/^\d+$/.test(w) && !show.has(w));
}

/**
 * How well an event fits an episode's title (0: it doesn't). A game between teams: every team named (by how strongly). A
 * field: the telling words the title shares with the event's name. `seasonTeams` (the teams of the season's games already
 * linked) lets a title that names no one ("Game 5") take a game between those teams; `show` is the show's name (its words
 * never count: "Formula 1" is in every race's title).
 */
export function fitOf(event: MatchEvent, title: string | null, opts: { seasonTeams?: Set<string>; show?: string } = {}): number {
  const words = wordsOf(title ?? "");
  const teams = event.competitors.map((c) => c.team).filter((t): t is MatchTeam => !!t);
  if (teams.length >= 2) {
    const scores = teams.map((t) => named(t, words));
    if (scores.every((s) => s > 0)) return 10 + scores.reduce((a, b) => a + b, 0);
    const namesNoOne = scores.every((s) => s === 0) && !matchupOf(title);
    if (namesNoOne && opts.seasonTeams?.size && teams.every((t) => opts.seasonTeams!.has(t.id))) return 1;
    return 0;
  }
  const show = new Set(wordsOf(opts.show ?? ""));
  const mine = new Set(telling(words, show));
  const theirs = new Set(telling(wordsOf(`${event.name} ${event.short ?? ""}`), show));
  let shared = 0;
  for (const w of mine) if (theirs.has(w)) shared++;
  return shared;
}

const distance = (a: string | null, b: string | null) => (a && b ? Math.abs(Date.parse(a) - Date.parse(b)) : NEAR_MS);

/**
 * The event an episode shows, from the events on its day: the best fit starting within NEAR_MS of its air time (the nearest,
 * between equal fits: a doubleheader), and the part it shows when the event has several (the one that starts nearest before
 * it airs: a race weekend's race, not its practice). Null when nothing fits.
 */
export function pickEvent<E extends MatchEvent>(events: E[], ep: MatchEpisode, opts: { seasonTeams?: Set<string>; show?: string } = {}): { event: E; part: string | null; fit: number } | null {
  let best: { event: E; fit: number; gap: number } | null = null;
  for (const event of events) {
    const gap = distance(event.at, ep.airAt);
    const nearestPart = event.parts.length ? Math.min(...event.parts.map((p) => distance(p.at, ep.airAt))) : gap;
    if (Math.min(gap, nearestPart) > NEAR_MS) continue;
    const fit = fitOf(event, ep.title, opts);
    if (fit <= 0) continue;
    if (!best || fit > best.fit || (fit === best.fit && gap < best.gap)) best = { event, fit, gap };
  }
  if (!best) return null;
  return { event: best.event, part: partOf(best.event, ep.airAt), fit: best.fit };
}

/** The part of an event in parts an episode shows: the last to start by the time it airs (else the first). */
function partOf(event: MatchEvent, airAt: string | null): string | null {
  if (!event.parts.length || !airAt) return null;
  const air = Date.parse(airAt) + 15 * 60_000;
  const started = event.parts.filter((p) => p.at && Date.parse(p.at) <= air).sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!));
  return (started[0] ?? event.parts[0]).id || null;
}

/**
 * The days to ask for an episode's event, most likely first: the day it airs where the US networks are (the providers'
 * scoreboards go by it), then the day before (a delayed broadcast) and after.
 */
export function daysFor(airAt: string): string[] {
  const at = new Date(airAt);
  return [...new Set([easternDay(at), easternDay(at, -1), easternDay(at, 1)])];
}
