import { SportsUnavailable, type BoxScore, type Competitor, type EventState, type Found, type League, type Person, type RosterPlayer, type SeasonLine, type SeasonStage, type SportsEvent, type SportsProvider, type StatTable, type Team } from "./types";

// ESPN (docs/PLAN-sports-data.md, docs/HOSTING.md): free, no key, but unofficial and undocumented, with no stated rate limit or
// terms, so it's asked little (every call is cached: cache.ts) and credited in Credits. Three hosts:
//   site.api.espn.com       a league's scoreboard on a day, a team's roster, a game's summary (its box score)
//   site.web.api.espn.com   search (teams and leagues by name), an athlete's stats by season
//   sports.core.api.espn.com the index of every sport and league
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
}
interface RawEvent {
  id?: string | number;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { year?: number; type?: number; slug?: string };
  status?: RawStatus;
  competitions?: RawCompetition[];
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
  rosters?: { team?: RawTeam; roster?: (RawStatRow & { stats?: { abbreviation?: string; shortDisplayName?: string; displayValue?: string }[] })[] }[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const idOf = (v: unknown) => str(v) ?? "";

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

/** A scoreboard's events (site.api …/scoreboard). An event in parts (an F1 weekend) keeps each part's field on the part. */
export function readScoreboard(league: string, raw: { events?: RawEvent[] } | null): SportsEvent[] {
  const out: SportsEvent[] = [];
  for (const e of raw?.events ?? []) {
    const id = idOf(e.id);
    if (!id) continue;
    const comps = e.competitions ?? [];
    const whole = stateOf(e.status ?? comps[0]?.status);
    const parts =
      comps.length > 1
        ? comps.map((c) => ({ id: idOf(c.id), name: str(c.type?.abbreviation) ?? str(c.type?.name), at: str(c.date), state: stateOf(c.status).state, competitors: (c.competitors ?? []).map(readCompetitor) }))
        : [];
    out.push({
      id,
      league,
      name: str(e.name) ?? "",
      short: str(e.shortName),
      at: str(e.date) ?? str(comps[0]?.date),
      state: whole.state,
      final: whole.final,
      season: Number.isInteger(e.season?.year) ? (e.season!.year as number) : null,
      stage: stageOf(e.season),
      note: str(comps[0]?.notes?.[0]?.headline),
      competitors: comps.length === 1 ? (comps[0].competitors ?? []).map(readCompetitor) : [],
      parts,
    });
  }
  return out;
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
  return { event: idOf(raw.header.id), state, final, teams };
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
  async function get<T>(url: string): Promise<T | null> {
    let res: Response;
    try {
      res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch (e) {
      throw new SportsUnavailable(`ESPN didn't answer (${(e as Error).name})`);
    }
    // No such league, team, game or athlete.
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new SportsUnavailable(`ESPN answered ${res.status}`);
    try {
      return (await res.json()) as T;
    } catch {
      throw new SportsUnavailable("ESPN's answer wasn't JSON");
    }
  }
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
    async roster(league, team) {
      const raw = await get<Parameters<typeof readRoster>[0]>(`${site}/apis/site/v2/sports/${path(league)}/teams/${encodeURIComponent(team)}/roster`);
      return raw ? readRoster(raw) : null;
    },
    async boxScore(league, event) {
      return readBoxScore(await get(`${site}/apis/site/v2/sports/${path(league)}/summary?event=${encodeURIComponent(event)}`));
    },
    async seasonStats(league, athlete, season) {
      return readSeasonStats(await get(`${web}/apis/common/v3/sports/${path(league)}/athletes/${encodeURIComponent(athlete)}/stats?season=${season}`), season);
    },
  };
}
