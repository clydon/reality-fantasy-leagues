import { readOdds, type EspnOdds } from "@/lib/sports/matchup";
// One copy of the sports' classes (the index's): `instanceof` reads them alike wherever they're imported from.
import { FieldSport, LiveEvent, TeamSport, feedOf, idOf, sportOf, storedCard, storedField, storedGame, str, type BoutAnswer, type BoutSport, type EspnSummary, type EventFeed, type FieldAnswer, type Play, type StoredCard, type StoredField } from "@/lib/sports";
import type { CalendarStage, CalendarWeek, LeagueCalendar } from "@/lib/sports/slate";
import { SportsUnavailable, type LeagueName, type LeagueTeams, type BoxScore, type Competitor, type EventState, type Found, type League, type Person, type RosterPlayer, type SeasonLine, type SeasonStage, type SportsEvent, type SportsProvider, type StatTable, type Team } from "./types";

// ESPN (docs/PLAN-sports-data.md, docs/HOSTING.md): free, no key, but unofficial and undocumented, with no stated rate limit or
// terms, so it's asked little (every call is cached: cache.ts) and credited in Credits. Three hosts:
//   site.api.espn.com       a league's scoreboard on a day (with its line before a game), a team's roster and schedule, a game's
//                           summary (its box score, and its line in pickcenter)
//   site.web.api.espn.com   search (teams and leagues by name), an athlete's stats by season
//   sports.core.api.espn.com the index of every sport and league
// and, for a field's or a card's final (L3 part 3: eventFinal), the calls the phone's poller makes for it, asked once.
// A league's id is ESPN's own path for it ("baseball/mlb", "australian-football/afl", "soccer/eng.1", "racing/f1"), read from
// its answers (search's sport and league slug, the index's refs), never from a table here. The readers below turn ESPN's
// answers into the provider shapes (types.ts) and are pure, so tests feed them trimmed real answers (tests/sports-espn.test.js).

const SITE = "https://site.api.espn.com";
const WEB = "https://site.web.api.espn.com";
const CORE = "https://sports.core.api.espn.com";
// No URL in it: site.api.espn.com answers 403 to a User-Agent with one (2026-10-27).
const UA = { "User-Agent": "GameYourShow/1.0" };
const TIMEOUT_MS = 8000;

/* ESPN's answers, only the parts read. */
interface RawTeam {
  id?: string | number;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  nickname?: string;
  location?: string;
  abbreviation?: string;
  logo?: string;
  logos?: { href?: string }[];
  color?: string;
  isActive?: boolean;
}
interface RawAthlete {
  id?: string | number;
  displayName?: string;
  fullName?: string;
  position?: { displayName?: string; name?: string };
  headshot?: { href?: string } | string;
  jersey?: string;
}
interface RawStatus {
  type?: { state?: string; completed?: boolean };
}
interface RawCompetitor {
  homeAway?: string;
  team?: RawTeam;
  athlete?: RawAthlete;
  score?: string | number | { displayValue?: string };
  winner?: boolean;
  order?: number;
}
interface RawCompetition {
  id?: string | number;
  date?: string;
  type?: { abbreviation?: string; name?: string };
  status?: RawStatus;
  competitors?: RawCompetitor[];
  notes?: { headline?: string }[];
  /** A playoff series' record (a scoreboard's and a schedule's): how many games it is at most, each side's wins. */
  series?: { type?: string; totalCompetitions?: number };
  /** The line, on a scoreboard before the game. */
  odds?: RawOdds[];
}
/** A sportsbook's line: a scoreboard's `odds[]`, a summary's `pickcenter[]` (read by matchup.ts's readOdds). */
type RawOdds = EspnOdds;
interface RawEvent {
  id?: string | number;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { year?: number; type?: number; slug?: string };
  /** A team schedule's word for the stage (its `season` has only the year). */
  seasonType?: { type?: number };
  status?: RawStatus;
  competitions?: RawCompetition[];
  /** A soccer team's schedule names each game's competition (a club's cups are other leagues). */
  league?: RawLeague;
}
/** A scoreboard's league ("English Premier League", abbreviation "Premier League"; "National Basketball Association", "NBA"). */
interface RawLeague {
  name?: string;
  abbreviation?: string;
  slug?: string;
  /** L8: a bare scoreboard's season now and its calendar: days (ISO instants), or weeks by stage (football's). */
  season?: { year?: number; displayName?: string; type?: { type?: number } };
  calendarType?: string;
  calendar?: (string | { value?: string; entries?: { label?: string; detail?: string; startDate?: string; endDate?: string }[] })[];
}
/** L8: one of a season's types (the core's …/seasons/{year}/types/{n}): its stage and bounds. */
interface RawSeasonType {
  type?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
}
interface RawStatRow {
  athlete?: RawAthlete;
  position?: { displayName?: string; name?: string };
  starter?: boolean;
  stats?: (string | number)[];
}
interface RawStatTable {
  name?: string;
  type?: string;
  labels?: string[];
  totals?: (string | number)[];
  athletes?: RawStatRow[];
}
interface RawSummary {
  header?: { id?: string | number; competitions?: RawCompetition[] };
  boxscore?: { players?: { team?: RawTeam; statistics?: RawStatTable[] }[] };
  pickcenter?: RawOdds[];
  rosters?: { team?: RawTeam; roster?: (RawStatRow & { stats?: { abbreviation?: string; shortDisplayName?: string; displayValue?: string }[] })[] }[];
}


/** A league's id from ESPN's sport and league slugs. */
export const leagueId = (sport: string, league: string) => `${sport}/${league}`;

function stateOf(s: RawStatus | undefined): { state: EventState; final: boolean } {
  const st = s?.type?.state;
  return { state: st === "in" || st === "post" ? st : "pre", final: s?.type?.completed === true };
}

/**
 * The stage of its season an event is in, from ESPN's season slug ("regular-season", "post-season", "preseason"), else its type
 * (1, 2, 3); a soccer league's season has its own slug ("2026-27-english-premier-league"), which says none.
 */
export function stageOf(s: { type?: number; slug?: string } | undefined): SeasonStage | null {
  const slug = s?.slug ?? "";
  if (/^post-?season$/.test(slug)) return "post";
  if (/^regular-?season$/.test(slug)) return "regular";
  if (/^pre-?season$/.test(slug)) return "pre";
  if (slug) return null;
  return s?.type === 3 ? "post" : s?.type === 2 ? "regular" : s?.type === 1 ? "pre" : null;
}

export function readTeam(t: RawTeam): Team {
  const name = str(t.displayName) ?? str(t.name) ?? "";
  const also = [t.shortDisplayName, t.nickname, t.name, t.location].map(str).filter((x): x is string => !!x && x.length >= 3 && x.toLowerCase() !== name.toLowerCase());
  return { id: idOf(t.id), name, also: [...new Set(also)], abbreviation: str(t.abbreviation), logo: str(t.logo) ?? str(t.logos?.[0]?.href) };
}

/**
 * A headshot at the size a face is shown (a 160 px square, ~36 KB), through ESPN's own resizer: its full headshots are ~210 KB
 * each, a team's roster megabytes. Any other address as it is.
 */
export function sizedHeadshot(url: string | null): string | null {
  const m = /^https?:\/\/a\.espncdn\.com(\/i\/headshots\/[^?#]+)$/.exec(url ?? "");
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=160&h=160&scale=crop` : url;
}

function readPerson(a: RawAthlete, position?: { displayName?: string; name?: string }): Person {
  const shot = typeof a.headshot === "string" ? a.headshot : a.headshot?.href;
  return {
    id: idOf(a.id),
    name: str(a.displayName) ?? str(a.fullName) ?? "",
    position: str(a.position?.displayName) ?? str(a.position?.name) ?? str(position?.displayName) ?? str(position?.name),
    headshot: sizedHeadshot(str(shot)),
  };
}

function readCompetitor(c: RawCompetitor): Competitor {
  const score = typeof c.score === "object" && c.score ? str(c.score.displayValue) : str(c.score);
  return {
    team: c.team ? readTeam(c.team) : null,
    person: c.athlete ? readPerson(c.athlete) : null,
    home: c.homeAway === "home" ? true : c.homeAway === "away" ? false : null,
    score,
    winner: typeof c.winner === "boolean" ? c.winner : null,
    place: Number.isInteger(c.order) ? (c.order as number) : null,
  };
}

/** A sportsbook's line (src/lib/sports/matchup.ts, shared with the phone's poller). */
export { readOdds };

/**
 * A scoreboard's events (site.api …/scoreboard), or a team's schedule's (site.api …/teams/{id}/schedule: the same events, its
 * stage in `seasonType`, its scores as { value, displayValue }). An event in parts (an F1 weekend) keeps each part's field on
 * the part.
 */
export function readScoreboard(league: string, raw: { events?: RawEvent[]; leagues?: RawLeague[] } | null): SportsEvent[] {
  const out: SportsEvent[] = [];
  // Its league as ESPN names it: the event's own (a soccer schedule's), else the scoreboard's of the same slug.
  const slug = league.split("/").pop();
  const named = (l: RawLeague | undefined): LeagueName | null => {
    const name = str(l?.name) ?? str(l?.abbreviation);
    return name ? { name, short: str(l?.abbreviation) } : null;
  };
  const board = named(raw?.leagues?.find((l) => l.slug === slug) ?? (raw?.leagues?.length === 1 ? raw.leagues[0] : undefined));
  for (const e of raw?.events ?? []) {
    const id = idOf(e.id);
    if (!id) continue;
    const comps = e.competitions ?? [];
    const whole = stateOf(e.status ?? comps[0]?.status);
    const parts =
      comps.length > 1
        ? comps.map((c) => ({ id: idOf(c.id), name: str(c.type?.abbreviation) ?? str(c.type?.name), at: str(c.date), state: stateOf(c.status).state, competitors: (c.competitors ?? []).map(readCompetitor) }))
        : [];
    // An event of parts (a racing weekend's sessions) is over once every part is: ESPN's own status is its last part over's, final
    // from FP1's end with FP2 to the race to come (Mexico City 2026, recorded live).
    const partsOn = parts.some((p) => p.state !== "post");
    out.push({
      id,
      league,
      name: str(e.name) ?? "",
      short: str(e.shortName),
      at: str(e.date) ?? str(comps[0]?.date),
      state: whole.state === "post" && partsOn ? "in" : whole.state,
      final: whole.final && !partsOn,
      season: Number.isInteger(e.season?.year) ? (e.season!.year as number) : null,
      stage: stageOf({ ...e.season, type: e.season?.type ?? e.seasonType?.type }),
      note: str(comps[0]?.notes?.[0]?.headline),
      bestOf: comps[0]?.series?.type === "playoff" && Number.isInteger(comps[0].series.totalCompetitions) ? (comps[0].series.totalCompetitions as number) : null,
      competitors: comps.length === 1 ? (comps[0].competitors ?? []).map(readCompetitor) : [],
      parts,
      odds: readOdds(comps[0]?.odds?.[0]),
      leagueName: (e.league && (!e.league.slug || e.league.slug === slug) ? named(e.league) : null) ?? board,
    });
  }
  return out;
}

/**
 * L8: a league's season now (a bare scoreboard's league: its year, name, stage and calendar) with its stages' bounds (the core's
 * season types); null when the scoreboard names no season.
 */
export function readCalendar(raw: { leagues?: RawLeague[] } | null, types: RawSeasonType[]): LeagueCalendar | null {
  const l = raw?.leagues?.[0];
  const season = l?.season?.year;
  if (!l || !Number.isInteger(season)) return null;
  const iso = (x: unknown) => (typeof x === "string" && !Number.isNaN(Date.parse(x)) ? x : null);
  const stages: CalendarStage[] = [];
  for (const t of types) {
    const from = iso(t.startDate);
    const to = iso(t.endDate);
    if (!Number.isInteger(t.type) || !from || !to) continue;
    // ESPN's 1 to 3; a soccer league's season is one type of its own number (14308): its whole season (null); the off season (4)
    // and the NBA's play-in (5) are neither.
    stages.push({ stage: stageOf({ type: t.type }) ?? (t.type! > 5 ? null : "other"), type: t.type!, name: str(t.name) ?? "", from, to });
  }
  const days: string[] = [];
  const weeks: CalendarWeek[] = [];
  for (const c of l.calendar ?? []) {
    if (typeof c === "string") {
      if (iso(c)) days.push(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(c)));
      continue;
    }
    const type = Number(c.value);
    for (const w of c.entries ?? []) {
      const from = iso(w.startDate);
      const to = iso(w.endDate);
      if (Number.isInteger(type) && from && to) weeks.push({ type, label: str(w.label) ?? "", detail: str(w.detail), from, to });
    }
  }
  const name = str(l.name) ?? str(l.abbreviation);
  return { season: season!, label: str(l.season?.displayName) ?? String(season), now: l.season?.type?.type ?? 2, stages, days: [...new Set(days)].sort(), weeks, leagueName: name ? { name, short: str(l.abbreviation) } : null };
}

/** Search's teams and leagues (site.web …/search/v2), each with ESPN's league path; anything without one is left out. */
export function readSearch(raw: { results?: { type?: string; contents?: { uid?: string; displayName?: string; sport?: string; defaultLeagueSlug?: string }[] }[] } | null): Found[] {
  const out: Found[] = [];
  for (const r of raw?.results ?? []) {
    if (r.type !== "team" && r.type !== "league") continue;
    for (const c of r.contents ?? []) {
      const name = str(c.displayName);
      const sport = str(c.sport);
      const slug = str(c.defaultLeagueSlug);
      if (!name || !sport || !slug) continue;
      const league = leagueId(sport, slug);
      if (r.type === "league") out.push({ kind: "league", id: league, name, league });
      else {
        const team = /(?:^|~)t:(\d+)/.exec(c.uid ?? "")?.[1];
        if (team) out.push({ kind: "team", id: team, name, league });
      }
    }
  }
  return out;
}

/**
 * A league's teams (site.api …/{sport}/{league}/teams?limit=1000; L7): the active ones, each with its names, logo and colour, and
 * the league's names; null when the answer has no league (ESPN answers an unknown league's list with none).
 */
export function readTeams(league: string, raw: { sports?: { leagues?: (RawLeague & { shortName?: string; teams?: { team?: RawTeam }[] })[] }[] } | null): LeagueTeams | null {
  const l = raw?.sports?.[0]?.leagues?.[0];
  if (!l) return null;
  const name = str(l.name) ?? str(l.abbreviation);
  const teams = (l.teams ?? [])
    .map((x) => x.team)
    .filter((t): t is RawTeam => !!t && t.isActive !== false && !!idOf(t.id))
    .map((t) => ({ ...readTeam(t), color: str(t.color) }));
  return { league, name: name ? { name, short: str(l.abbreviation) ?? str(l.shortName) } : null, teams };
}

/** A team's roster (site.api …/teams/{id}/roster): grouped by position (baseball) or one list; players only (its coaches are separate). */
export function readRoster(raw: { athletes?: (RawAthlete & { position?: unknown; items?: RawAthlete[] })[] } | null): RosterPlayer[] {
  const out: RosterPlayer[] = [];
  const seen = new Set<string>();
  const add = (a: RawAthlete, group: string | null) => {
    const p = readPerson(a);
    if (!p.id || !p.name || seen.has(p.id)) return;
    seen.add(p.id);
    out.push({ ...p, group, jersey: str(a.jersey) });
  };
  for (const g of raw?.athletes ?? []) {
    if (Array.isArray(g.items)) for (const a of g.items) add(a, str(g.position));
    else add(g, null);
  }
  return out;
}

/**
 * A game's box score (site.api …/summary): each team's tables in ESPN's own columns. Most sports have `boxscore.players`
 * (baseball's batting and pitching, AFL's one table); soccer's match sheet has each player's stats on `rosters` instead, read
 * as one table whose columns are the stats' abbreviations in the order they first appear. Null when the game has neither.
 */
export function readBoxScore(raw: RawSummary | null): BoxScore | null {
  if (!raw?.header) return null;
  const comp = raw.header.competitions?.[0];
  const { state, final } = stateOf(comp?.status);
  const sides = new Map((comp?.competitors ?? []).filter((c) => c.team).map((c) => [idOf(c.team!.id), readCompetitor(c)]));
  const teams: BoxScore["teams"] = [];
  const side = (t: RawTeam, tables: StatTable[]) => {
    const team = readTeam(t);
    const c = sides.get(team.id);
    teams.push({ team: c?.team ?? team, score: c?.score ?? null, winner: c?.winner ?? null, tables });
  };
  for (const p of raw.boxscore?.players ?? []) {
    if (!p.team) continue;
    const tables = (p.statistics ?? []).map((t) => ({
      name: str(t.name) ?? str(t.type),
      labels: (t.labels ?? []).map((l) => String(l)),
      rows: (t.athletes ?? []).filter((a) => a.athlete).map((a) => ({ person: readPerson(a.athlete!, a.position), values: (a.stats ?? []).map((v) => String(v)), starter: typeof a.starter === "boolean" ? a.starter : null })),
      totals: Array.isArray(t.totals) && t.totals.length ? t.totals.map((v) => String(v)) : null,
    }));
    side(p.team, tables.filter((t) => t.rows.length));
  }
  if (!teams.length) {
    for (const r of raw.rosters ?? []) {
      if (!r.team) continue;
      const labels: string[] = [];
      const lines = (r.roster ?? []).filter((a) => a.athlete).map((a) => {
        const byLabel = new Map<string, string>();
        for (const s of Array.isArray(a.stats) ? a.stats : []) {
          const label = str(s.abbreviation) ?? str(s.shortDisplayName);
          if (!label) continue;
          if (!labels.includes(label)) labels.push(label);
          byLabel.set(label, str(s.displayValue) ?? "");
        }
        return { person: readPerson(a.athlete!, a.position), byLabel, starter: typeof a.starter === "boolean" ? a.starter : null };
      });
      const rows = lines.filter((l) => l.byLabel.size).map((l) => ({ person: l.person, values: labels.map((x) => l.byLabel.get(x) ?? ""), starter: l.starter }));
      side(r.team, rows.length ? [{ name: null, labels, rows, totals: null }] : []);
    }
  }
  if (!teams.some((t) => t.tables.length)) return null;
  return { event: idOf(raw.header.id), state, final, teams, odds: readOdds(raw.pickcenter?.[0]) };
}

/**
 * An athlete's regular-season lines for one season (site.web …/athletes/{id}/stats): every category ESPN shows by default (its
 * regular season), that year's row, its postseason categories ("postseason-batting") left out: they hold the playoff games
 * themselves. A traded player has a row per team.
 */
export function readSeasonStats(raw: { categories?: { name?: string; displayName?: string; labels?: string[]; statistics?: { season?: { year?: number; displayName?: string }; teamSlug?: string; stats?: (string | number)[] }[] }[] } | null, season: number): SeasonLine[] | null {
  if (!raw) return null;
  const out: SeasonLine[] = [];
  for (const c of raw.categories ?? []) {
    const category = str(c.name);
    if (!category || /^post-?season/i.test(category)) continue;
    for (const row of c.statistics ?? []) {
      if (row.season?.year !== season) continue;
      out.push({ category, name: str(c.displayName) ?? category, season: str(row.season.displayName) ?? String(season), labels: (c.labels ?? []).map((l) => String(l)), values: (row.stats ?? []).map((v) => String(v)), team: str(row.teamSlug) });
    }
  }
  return out.length ? out : null;
}

/**
 * One of ESPN's answers: its body, or null for its "none" (404 or 400: no such league, team, game, athlete or event). ESPN not
 * answering, answering otherwise than 2xx, or with something that isn't JSON: SportsUnavailable.
 */
async function answerOf(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new SportsUnavailable(`ESPN didn't answer (${(e as Error).name})`);
  }
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new SportsUnavailable(`ESPN answered ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new SportsUnavailable("ESPN's answer wasn't JSON");
  }
}

/**
 * A field's or a card's final (L3 part 3), from the calls the phone's poller makes (live-event.ts's feed for its sport: golf's
 * board and leaderboard; a race weekend's board, then its core's lists, statistics and F1's statuses; a tennis event's board; a
 * card's board and FightCenter, then its rounds, each bout's plays and each fighter's statistics), asked once, in the feed's
 * rounds, each answer as answerOf reads it. Final once ESPN says so and the feed has nothing left to ask (a counted series'
 * statistics filled in, a card's settled) and every call answered. Null when ESPN has no such event (a first call's "none", or
 * answers with no event in them); ESPN failing a first call (its board: an outage) is SportsUnavailable; failing a later one (a
 * driver's statistics) keeps what's had as not final, so one call never holds the event up for good (saveFinals keeps it as far
 * as it is once it's old).
 */
async function eventFinal(sport: FieldSport | BoutSport, league: string, event: string, hosts: { site: string; core: string; web: string }): Promise<StoredField | StoredCard | null> {
  const feed = feedOf(sport);
  if (!feed) return null;
  let down: SportsUnavailable | null = null;
  let none = false;
  let short = false;
  const ask = async <A, P extends Play, E, S>(f: EventFeed<A, P, E, S>): Promise<{ answer: A | null; had: A | null; done: boolean; error: string | null }> => {
    const live: LiveEvent<A, P, E, S> = new LiveEvent({
      feed: f,
      league,
      event,
      base: hosts.site,
      core: hosts.core,
      web: hosts.web,
      fetch: async (url) => {
        // A first call (its board; not an optional one, a card's FightCenter) or a later round's.
        const key = Object.entries(live.urls).find(([, u]) => u === url)?.[0];
        const first = key != null && !(f.optional ?? []).includes(key);
        try {
          const body = await answerOf(url);
          if (body === null) {
            if (first) none = true;
            return { ok: false, status: 404, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => body };
        } catch (e) {
          if (first) down ??= e as SportsUnavailable;
          else short = true;
          throw e;
        }
      },
    });
    await live.poll();
    return { answer: live.answer, had: live.answer ?? f.answer(live.had, new Date().toISOString()), done: live.done, error: live.lastError };
  };
  const got = sport instanceof FieldSport ? await ask(feed as EventFeed<FieldAnswer, Play, unknown, unknown>) : await ask(feed as EventFeed<BoutAnswer, Play, unknown, unknown>);
  if (down) throw down;
  if (none || !got.had) return null;
  // Answers with an event the sport's reader couldn't read.
  if (!got.answer) throw new Error(got.error ?? "ESPN's answer couldn't be read");
  const g = sport instanceof FieldSport ? storedField(sport, got.answer as FieldAnswer) : storedCard(sport, got.answer as BoutAnswer);
  return g && { ...g, final: g.final && got.done && !short };
}

/** The index's refs ("http://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb?lang=en") to the slug after `after`. */
const slugsOf = (raw: { items?: { $ref?: string }[] } | null, after: string) =>
  (raw?.items ?? []).map((i) => new RegExp(`/${after}/([^/?]+)`).exec(i.$ref ?? "")?.[1]).filter((x): x is string => !!x);

/**
 * ESPN as a provider. `base` (a check's stand-in, scripts/dev-test/fake-espn.js) answers for all three hosts at one origin;
 * without it, ESPN itself. Not cached: cache.ts's withCache wraps it, and everything in the app asks through that.
 */
export function espn(base?: string): SportsProvider {
  const site = base ?? SITE;
  const web = base ?? WEB;
  const core = base ?? CORE;
  const get = async <T,>(url: string): Promise<T | null> => (await answerOf(url)) as T | null;
  const path = (league: string) => league.split("/").map(encodeURIComponent).join("/");
  return {
    id: "espn",
    name: "ESPN",
    async leagues(): Promise<League[]> {
      const sports = slugsOf(await get(`${core}/v2/sports?limit=100`), "sports");
      const out: League[] = [];
      for (const sport of sports) {
        for (const slug of slugsOf(await get(`${core}/v2/sports/${encodeURIComponent(sport)}/leagues?limit=1000`), "leagues")) out.push({ id: leagueId(sport, slug), sport, name: null });
      }
      return out;
    },
    async find(text) {
      return readSearch(await get(`${web}/apis/search/v2?query=${encodeURIComponent(text)}&limit=10`));
    },
    async eventsOn(league, date) {
      return readScoreboard(league, await get(`${site}/apis/site/v2/sports/${path(league)}/scoreboard?dates=${date.replace(/-/g, "")}&limit=300`));
    },
    // L8: a month's games at once (ESPN answers a month, "202611", where it refuses a range of days); a month of MLB's is ~400.
    async eventsIn(league, month) {
      return readScoreboard(league, await get(`${site}/apis/site/v2/sports/${path(league)}/scoreboard?dates=${month.replace(/-/g, "")}&limit=1000`));
    },
    async calendar(league) {
      const raw = await get<{ leagues?: RawLeague[] }>(`${site}/apis/site/v2/sports/${path(league)}/scoreboard`);
      const year = raw?.leagues?.[0]?.season?.year;
      if (!raw || !Number.isInteger(year)) return null;
      // Its stages' bounds, one call each (the core lists them as refs, at ESPN's own host: asked at ours).
      const [sport, slug] = league.split("/").map(encodeURIComponent);
      const refs = await get<{ items?: { $ref?: string }[] }>(`${core}/v2/sports/${sport}/leagues/${slug}/seasons/${year}/types?limit=20`);
      const types = await Promise.all(
        (refs?.items ?? []).map((r) => {
          const at = /\/v2\/sports\/[^?]+/.exec(r.$ref ?? "")?.[0];
          return at ? get<RawSeasonType>(`${core}${at}`) : Promise.resolve(null);
        })
      );
      return readCalendar(raw, types.filter((t): t is RawSeasonType => !!t));
    },
    async schedule(league, team, opts = {}) {
      const q = [opts.season ? `season=${opts.season}` : "", opts.type ? `seasontype=${opts.type}` : ""].filter(Boolean).join("&");
      const raw = await get<{ events?: RawEvent[] }>(`${site}/apis/site/v2/sports/${path(league)}/teams/${encodeURIComponent(team)}/schedule${q ? `?${q}` : ""}`);
      return raw ? readScoreboard(league, raw).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")) : null;
    },
    async teams(league) {
      return readTeams(league, await get(`${site}/apis/site/v2/sports/${path(league)}/teams?limit=1000`));
    },
    async roster(league, team) {
      const raw = await get<Parameters<typeof readRoster>[0]>(`${site}/apis/site/v2/sports/${path(league)}/teams/${encodeURIComponent(team)}/roster`);
      return raw ? readRoster(raw) : null;
    },
    async boxScore(league, event) {
      return readBoxScore(await get(`${site}/apis/site/v2/sports/${path(league)}/summary?event=${encodeURIComponent(event)}`));
    },
    async game(league, event) {
      const sport = sportOf(league);
      if (!sport) return null;
      if (!(sport instanceof TeamSport)) return eventFinal(sport, league, event, { site, core, web });
      const raw = await get<EspnSummary>(`${site}/apis/site/v2/sports/${path(league)}/summary?event=${encodeURIComponent(event)}`);
      return raw ? storedGame(sport, raw) : null;
    },
    async seasonStats(league, athlete, season) {
      return readSeasonStats(await get(`${web}/apis/common/v3/sports/${path(league)}/athletes/${encodeURIComponent(athlete)}/stats?season=${season}`), season);
    },
  };
}
