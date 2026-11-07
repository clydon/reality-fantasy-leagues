import { allSports, sportOf, TeamSport } from "@/lib/sports";
import { MAX_GAMES, MAX_SEASON, leagueName, matchupKey, matchupName, seasonKey } from "@/lib/sports/matchup";
import type { Cadence, SlateStage } from "@/lib/sports/slate";
import { FITS, findLeagues, findTeams, scheduleOf, seasonName, teamHit, teamScore, wordsOf, type LeagueHit, type MatchupHit, type ScheduleGame, type Series, type TeamHit, type TeamList } from "@/lib/sports/teams";
import { NEW_SHOWS_A_DAY } from "../add-show";
import { HttpError, pool } from "../db";
import { setFollow } from "../follows";
import { sportsProviders } from "./index";
import { matchupSeason } from "./matchup";
import { makeSlate, SlateRefused, type Slate } from "./slate";
import { SportsUnavailable, type SportsEvent, type SportsProvider } from "./types";

// Finding a game (docs/PLAN-start-a-game-gpt.md track L, L7; docs/PLAN-sports-add.md): the data the screens read to add sports by
// team or by league (U0, U1 build them; no screen here), through /api/sports/search, /api/sports/schedule, /api/sports/league
// and /api/sports/add.
//   searchTeams    the teams some words name, matched here against each league's team list (the provider's, a week in the
//                  cache: names, nicknames, cities, abbreviations, logos, colours), and two teams of one league in any order as a
//                  matchup, and the leagues they name (L8 part 2: by the lists' names for them); ESPN's own search when the lists
//                  find no one ("sixers", "Premier League"); each of the first few teams with its next game.
//   teamSchedule   a team's season, past and coming (its regular season and its postseason, as the provider lists them), its
//                  series, its meetings with one opponent, and what adding each makes, with the season already made for it.
//   addGames       one game, a few (a series, their meetings: up to 30) or a team's regular season (up to 200), made (or found)
//                  as their matchup's season (matchup.ts matchupSeason: shared by everyone who adds the same games) and followed.
//   addSlate       a league's slate (L8 part 2: slate.ts makeSlate; what it can be is slate.ts leagueSlates), made or found and
//                  followed, under the same day's cap.
// Nothing here knows a league: the leagues searched are the ones the app's sports read (each sport's own leagues), and any
// league a matchup's been made for (a soccer league found through ESPN's search, say).

type Queryable = { query: typeof pool.query };

/** The leagues a search reads the team lists of: each team sport's own ("football/nfl", "basketball/mens-college-basketball"). */
export function teamLeagues(): string[] {
  return allSports().flatMap((s) => (s instanceof TeamSport && s.leagues ? s.leagues.map((l) => `${s.id}/${l}`) : []));
}

/** The leagues a matchup has been made for (shows.sports_league: "espn:soccer/eng.1"), for the provider; a check's with its prefix. */
async function madeLeagues(provider: string, prefix: string, db: Queryable = pool): Promise<string[]> {
  const { rows } = await db.query("SELECT sports_league FROM shows WHERE sports_league LIKE $1", [`${prefix}${provider}:%`]);
  return rows.map((r) => (r.sports_league as string).slice(`${prefix}${provider}:`.length));
}

/** A league's list as the matcher reads it: null when the provider has none, "down" when it didn't answer. */
async function listOrDown(p: SportsProvider, league: string): Promise<TeamList | null | "down"> {
  try {
    const t = await p.teams(league);
    return t ? { league, name: t.name, teams: t.teams } : null;
  } catch (e) {
    if (e instanceof SportsUnavailable) return "down";
    throw e;
  }
}
async function listOf(p: SportsProvider, league: string): Promise<TeamList | null> {
  const l = await listOrDown(p, league);
  return l === "down" ? null : l;
}

/** The lists, read once a few minutes in a warm server (they're kept a week; a search reads them all). */
let memo: { key: string; at: number; lists: TeamList[] } | null = null;
const MEMO_MS = 10 * 60_000;

async function listsOf(p: SportsProvider, leagues: string[], share: boolean): Promise<TeamList[]> {
  const key = `${p.id}|${leagues.join(",")}`;
  if (share && memo && memo.key === key && Date.now() - memo.at < MEMO_MS) return memo.lists;
  const got = await Promise.all(leagues.map((l) => listOrDown(p, l)));
  const lists = got.filter((l): l is TeamList => !!l && l !== "down");
  // Never kept with a list the provider didn't answer for: the next search asks again (a league with no list is just none).
  if (share && !got.includes("down")) memo = { key, at: Date.now(), lists };
  return lists;
}

/** A game coming up, as a search row shows it ("Next: Fri vs Red Sox"). */
export type NextGame = Pick<ScheduleGame, "id" | "at" | "home" | "opponent" | "state">;

/** A league found (L8 part 2): `slate` when a season of its whole league's games can be made of it (a team sport's: GET
 *  /api/sports/league says how); a tour's or a promotion's (golf's, F1's, the UFC's) is an event an episode, not a slate. */
export type FoundLeague = LeagueHit & { slate: boolean };

export interface FoundTeams {
  teams: (TeamHit & { next: NextGame | null })[];
  matchup: (MatchupHit & { next: NextGame | null }) | null;
  leagues: FoundLeague[];
}

const foundLeague = (h: LeagueHit): FoundLeague => ({ ...h, slate: sportOf(h.league) instanceof TeamSport });

/**
 * The teams `text` names (findTeams on every league's list), and their matchup when it names two, and the leagues it names (by the
 * lists' names for them: "NFL", "national football"); ESPN's own search when the lists find no team and no league, for a team
 * sport's teams (ESPN's names the lists don't have: "sixers"; a soccer club) and any sport's leagues ("Premier League", "MLS",
 * "Formula 1"). The first `next` teams (3) and the matchup each with their next game (their next meeting), from their schedules
 * (each cached half a day). `leagues` and `providers` are for checks (a check's stand-in ESPN, its leagues); `prefix` reads a
 * check's own matchups' and slates' leagues.
 */
export async function searchTeams(text: string, opts: { providers?: SportsProvider[]; leagues?: string[]; next?: number; prefix?: string } = {}): Promise<FoundTeams> {
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) return { teams: [], matchup: null, leagues: [] };
  const leagues = opts.leagues ?? [...new Set([...teamLeagues(), ...(await madeLeagues(p.id, opts.prefix ?? ""))])];
  const lists = await listsOf(p, leagues, !opts.providers);
  const found = findTeams(lists, text);
  const named = findLeagues(lists, text);
  const espn = found.teams.length || found.matchup || named.length ? null : await searched(p, text, lists);
  const teams = espn?.teams ?? found.teams;
  const n = opts.next ?? 3;
  return {
    teams: await Promise.all(teams.map(async (t, i) => ({ ...t, next: i < n ? await nextGame(p, t.league, t.id) : null }))),
    matchup: found.matchup ? { ...found.matchup, next: await nextGame(p, found.matchup.league, found.matchup.teams[0].id, found.matchup.teams[1].id) } : null,
    leagues: (espn?.leagues ?? named).map(foundLeague),
  };
}

/**
 * ESPN's search's teams, in a team sport's league, each from its league's list when there is one (its logo and colour), and its
 * leagues of a sport the app reads (5 of each at most), a team sport's named as its list names it ("Premier League", "MLS"). A team
 * of a league it found is left out unless the words fit it (ESPN's "premier league" lists the league's clubs besides; "mls" the
 * Whitecaps); a name only ESPN knows ("sixers") is kept whatever leagues it finds besides.
 */
async function searched(p: SportsProvider, text: string, lists: TeamList[]): Promise<{ teams: TeamHit[]; leagues: LeagueHit[] }> {
  let found: Awaited<ReturnType<SportsProvider["find"]>> = [];
  try {
    found = await p.find(text);
  } catch (e) {
    if (!(e instanceof SportsUnavailable)) throw e;
  }
  const leagueHits = found.filter((x, i) => x.kind === "league" && sportOf(x.league) && found.findIndex((y) => y.kind === "league" && y.league === x.league) === i).slice(0, 5);
  const teamHits = found.filter((x) => x.kind === "team" && sportOf(x.league) instanceof TeamSport).slice(0, 5);
  // Each league's list read once, at once (a team sport's: a week in the cache).
  const wanted = [...new Set([...leagueHits, ...teamHits].map((f) => f.league))].filter((l) => !lists.some((x) => x.league === l) && sportOf(l) instanceof TeamSport);
  const read = new Map(await Promise.all(wanted.map(async (l) => [l, await listOf(p, l)] as const)));
  const listFor = (league: string) => lists.find((l) => l.league === league) ?? read.get(league) ?? null;
  const leagues: LeagueHit[] = leagueHits.map((f) => {
    const list = listFor(f.league);
    return { league: f.league, leagueName: leagueName(f.league, list?.name ?? { name: f.name, short: null }), name: list?.name?.name ?? f.name, score: FITS };
  });
  const typed = wordsOf(text);
  const teams: TeamHit[] = [];
  for (const f of teamHits) {
    const list = listFor(f.league);
    const t = list?.teams.find((x) => x.id === f.id) ?? { id: f.id, name: f.name };
    if (leagues.some((l) => l.league === f.league) && teamScore(typed, t) < FITS) continue;
    teams.push(teamHit(list ?? { league: f.league, name: null, teams: [] }, t, FITS));
  }
  return { teams, leagues };
}

/** A team's next game (against `against`, if given), or null: none listed, or the provider not answering. */
async function nextGame(p: SportsProvider, league: string, team: string, against?: string): Promise<NextGame | null> {
  try {
    const games = await p.schedule(league, team);
    if (!games) return null;
    const v = scheduleOf(team, games, { against });
    const g = v.games.find((x) => x.id === v.next);
    return g ? { id: g.id, at: g.at, home: g.home, opponent: g.opponent, state: g.state } : null;
  } catch (e) {
    if (e instanceof SportsUnavailable) return null;
    throw e;
  }
}

/** The season most of these games are of (the provider's year). */
function yearOf(games: SportsEvent[]): number | null {
  const n = new Map<number, number>();
  for (const g of games) if (g.season != null) n.set(g.season, (n.get(g.season) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * A team's season as the provider lists it: the schedule now (its season and stage now), with its regular season and postseason
 * besides when now's is another stage (a schedule lists one stage at a time: the regular season once the playoffs start, the
 * playoffs once they're listed). Null when the provider has no such team.
 */
export async function seasonGames(p: SportsProvider, league: string, team: string): Promise<SportsEvent[] | null> {
  const now = await p.schedule(league, team);
  if (!now) return null;
  const year = yearOf(now);
  const stages = new Set(now.map((g) => g.stage));
  const all = [...now];
  if (year != null) {
    for (const [stage, type] of [["regular", 2], ["post", 3]] as const) {
      if (stages.has(stage)) continue;
      try {
        all.push(...((await p.schedule(league, team, { season: year, type })) ?? []));
      } catch (e) {
        if (!(e instanceof SportsUnavailable)) throw e;
      }
    }
  }
  const seen = new Set<string>();
  return all
    .filter((g) => (year == null || g.season == null || g.season === year) && !seen.has(g.id) && seen.add(g.id))
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
}

/** What adding some games makes: their season's name, its games, and the season already made for them, if one is. */
export interface AddOption {
  name: string;
  games: string[];
  seasonId: string | null;
}

export interface TeamSchedule {
  league: string;
  leagueName: string | null;
  team: TeamHit;
  /** Their meetings with this team only (`against`). */
  against: TeamHit | null;
  /** The provider's year for the season ("2027" for the NBA's 2026-27). */
  season: number | null;
  /** Each with the season made for it alone, if one is. */
  games: (ScheduleGame & { seasonId: string | null })[];
  series: (Series & AddOption)[];
  next: string | null;
  /** The team's regular season (`kind` season), or with `against` their meetings (`kind` meetings), as one season to add. */
  whole: (AddOption & { kind: "season" | "meetings" }) | null;
}

/** A team as its league's list has it, else as its games name it. */
function teamOf(list: TeamList | null, games: SportsEvent[], league: string, id: string): TeamHit | null {
  const listed = list?.teams.find((t) => t.id === id);
  if (listed && list) return teamHit(list, listed, 100);
  const t = games.flatMap((g) => g.competitors).find((c) => c.team?.id === id)?.team;
  return t ? teamHit(list ?? { league, name: null, teams: [] }, t, 100) : null;
}

/** The games a team's season adds: its regular season's (all of them when the provider doesn't say stages), none called off. */
function regularOf(team: string, games: SportsEvent[]): SportsEvent[] {
  const mine = games.filter((g) => g.competitors.some((c) => c.team?.id === team) && !(g.state === "post" && !g.final));
  return mine.some((g) => g.stage) ? mine.filter((g) => g.stage === "regular") : mine;
}

/** Games against `against`, none called off. */
function meetingsOf(team: string, against: string, games: SportsEvent[]): SportsEvent[] {
  const ids = new Set(scheduleOf(team, games, { against }).games.filter((g) => !g.calledOff).map((g) => g.id));
  return games.filter((g) => ids.has(g.id));
}

/** The seasons made for these keys (a check's under its prefix). */
async function madeFor(keys: string[], prefix: string, db: Queryable = pool): Promise<Map<string, string>> {
  if (!keys.length) return new Map();
  const { rows } = await db.query("SELECT key, season_id FROM sports_matchups WHERE key = ANY($1::text[])", [keys.map((k) => `${prefix}${k}`)]);
  return new Map(rows.map((r) => [(r.key as string).slice(prefix.length), r.season_id as string]));
}

/**
 * A team's season as the screens show it (null when the provider has no such team in the league): its games past and coming, its
 * series, its next game, and what adding makes: each game alone, each series still to finish (two games or more), and its regular
 * season, or with `against` their meetings, each with the season already made for it.
 */
export async function teamSchedule(league: string, team: string, opts: { against?: string | null; providers?: SportsProvider[]; prefix?: string } = {}): Promise<TeamSchedule | null> {
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) return null;
  const games = await seasonGames(p, league, team);
  if (!games) return null;
  const list = await listOf(p, league);
  const me = teamOf(list, games, league, team);
  if (!me) return null;
  const against = opts.against ? teamOf(list, games, league, opts.against) : null;
  if (opts.against && !against) return null;
  const view = scheduleOf(team, games, { against: opts.against });
  const year = yearOf(games);
  const byId = new Map(games.map((g) => [g.id, g]));
  const series = view.series.filter((s) => s.games.length >= 2 && s.state !== "past");
  const whole = against ? meetingsOf(team, against.id, games) : regularOf(team, games);
  const wholeKey = against ? matchupKey(p.id, league, whole.map((g) => g.id)) : year != null ? seasonKey(p.id, league, team, year) : null;
  const gameKey = (id: string) => matchupKey(p.id, league, [id]);
  const seriesKey = (s: Series) => matchupKey(p.id, league, s.games);
  const made = await madeFor([...view.games.map((g) => gameKey(g.id)), ...series.map(seriesKey), ...(wholeKey ? [wholeKey] : [])], opts.prefix ?? "");
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((g): g is SportsEvent => !!g);
  const named = games.map((g) => g.leagueName).find(Boolean);
  return {
    league,
    leagueName: me.leagueName ?? (named ? leagueName(league, named) : null),
    team: me,
    against,
    season: year,
    games: view.games.map((g) => ({ ...g, seasonId: made.get(gameKey(g.id)) ?? null })),
    series: series.map((s) => ({ ...s, name: matchupName(pick(s.games), team), seasonId: made.get(seriesKey(s)) ?? null })),
    next: view.next,
    whole:
      whole.length && wholeKey && whole.length <= (against ? MAX_GAMES : MAX_SEASON)
        ? { kind: against ? "meetings" : "season", name: against ? matchupName(whole, team) : seasonName(me.short, year, whole), games: whole.map((g) => g.id), seasonId: made.get(wholeKey) ?? null }
        : null,
  };
}

/** What to add: these games (1 to 30, from the team's schedule), or the team's regular season, or their meetings with `against`. */
export interface AddAsk {
  league: string;
  team: string;
  games?: string[];
  whole?: "season" | "meetings";
  against?: string;
}

export interface Added {
  seasonId: string;
  /** Made just now (else someone had added the same games before). */
  made: boolean;
  name: string;
  games: string[];
}

/** Matchups and slates one person can make a day (finding one already made is free), as many as new shows (add-show.ts). */
export const MATCHUPS_A_DAY = NEW_SHOWS_A_DAY;

/** 429 once `userId` has made the day's matchups and slates (one count for both: each is a season made). */
async function underCap(userId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM sports_matchups WHERE made_by = $1 AND made_at > now() - interval '1 day')
          + (SELECT count(*) FROM sports_slates WHERE made_by = $1 AND made_at > now() - interval '1 day') AS n`,
    [userId]
  );
  if (Number(rows[0].n) >= MATCHUPS_A_DAY) throw new HttpError(429, `You've added ${MATCHUPS_A_DAY} new games today. Try again tomorrow.`);
}

/**
 * Add a team's games: made (or found) as their matchup's season, and followed by `userId` (no one in a check that says null).
 * 404 when the provider has no such team or a game isn't theirs; 400 for an ask that isn't one or a game called off; 429 past the
 * day's cap (a soft one, checked before it's made, as add-show's is). A game already played is never asked for its line (nobody can
 * answer for it now; a summary a game would be up to 30 calls in the request).
 */
export async function addGames(
  userId: string | null,
  ask: AddAsk,
  opts: { providers?: SportsProvider[]; prefix?: string; now?: Date; cast?: boolean } = {}
): Promise<Added> {
  const s = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80;
  if (!ask || typeof ask !== "object") throw new HttpError(400, "Say which team: { league, team }");
  // ESPN's league paths are lower case; one spelled otherwise is the same league (its show, its matchups' keys).
  if (s(ask.league)) ask = { ...ask, league: ask.league.toLowerCase() };
  if (!s(ask.league) || !s(ask.team) || !/^[a-z0-9-]+\/[a-z0-9.-]+$/i.test(ask.league)) throw new HttpError(400, "Say which team: { league, team }");
  if (ask.whole !== undefined && ask.whole !== "season" && ask.whole !== "meetings") throw new HttpError(400, "whole is season or meetings");
  if (ask.whole === "meetings" && !s(ask.against)) throw new HttpError(400, "Their meetings with whom? { against }");
  if (!ask.whole && !(Array.isArray(ask.games) && ask.games.length >= 1 && ask.games.length <= MAX_GAMES && ask.games.every(s))) {
    throw new HttpError(400, `Say which games (1 to ${MAX_GAMES}), or { whole: "season" }`);
  }
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) throw new HttpError(503, "Sports aren't available right now");
  const games = await seasonGames(p, ask.league, ask.team);
  if (!games) throw new HttpError(404, "No such team");
  const year = yearOf(games);
  let picked: SportsEvent[];
  let key: string | undefined;
  let name: string;
  if (ask.whole === "season") {
    picked = regularOf(ask.team, games);
    if (picked.length > MAX_SEASON) throw new HttpError(400, `A season of more than ${MAX_SEASON} games`);
    if (year == null) throw new HttpError(404, "No season listed");
    key = seasonKey(p.id, ask.league, ask.team, year);
    const me = teamOf(await listOf(p, ask.league), games, ask.league, ask.team);
    name = seasonName(me?.short ?? ask.team, year, picked);
  } else {
    const want = ask.whole === "meetings" ? new Set(meetingsOf(ask.team, ask.against!, games).map((g) => g.id)) : new Set(ask.games);
    picked = games.filter((g) => want.has(g.id) && g.competitors.some((c) => c.team?.id === ask.team));
    if (ask.games && picked.length !== want.size) throw new HttpError(404, "Not on their schedule");
    if (picked.some((g) => g.state === "post" && !g.final)) throw new HttpError(400, "That game was called off");
    if (picked.length > MAX_GAMES) throw new HttpError(400, `More than ${MAX_GAMES} games`);
    name = matchupName(picked, ask.team);
  }
  if (!picked.length) throw new HttpError(404, "No games to add");
  const prefix = opts.prefix ?? "";
  const found = await pool.query("SELECT 1 FROM sports_matchups WHERE key = $1", [`${prefix}${key ?? matchupKey(p.id, ask.league, picked.map((g) => g.id))}`]);
  if (!found.rows.length && userId) await underCap(userId);
  const m = await matchupSeason(p, ask.league, picked, { name, key, pastLines: false, userId, providers: opts.providers, now: opts.now, prefix, cast: opts.cast });
  if (userId) await setFollow(userId, m.seasonId, { following: true });
  return { seasonId: m.seasonId, made: m.made, name: m.name, games: m.games };
}

/** A league's path as asked ("football/nfl"; ESPN's are lower case, so "Football/NFL" is the same), or null for one that isn't. */
export function leaguePath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 80) return null;
  const league = raw.toLowerCase();
  return /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) ? league : null;
}

/** A league's slate to add (L8 part 2): `stage` the regular season unless its calendar's in the playoffs, `cadence` its usual
 *  (GET /api/sports/league says which it can be). */
export interface SlateAsk {
  league: string;
  slate: { stage?: SlateStage; cadence?: Cadence };
}

export type AddedSlate = Pick<Slate, "seasonId" | "made" | "name" | "league" | "stage" | "cadence" | "episodes" | "games">;

/**
 * Add a league's slate: made (or found: everyone who asks for the same league, season, stage and cadence shares one; slate.ts
 * makeSlate) and followed by `userId` (no one in a check that says null). 400 for an ask that isn't one, a tour's league (an event
 * an episode, not a slate) or a slate it can't be (a cadence the league isn't cut by, a stage not listed yet: SlateRefused's
 * words); 404 for a league the provider has no season for; 429 past the day's cap, counted with matchups (finding one is free);
 * 503 when the provider doesn't answer.
 */
export async function addSlate(userId: string | null, ask: SlateAsk, opts: { providers?: SportsProvider[]; prefix?: string; now?: Date; cast?: boolean } = {}): Promise<AddedSlate> {
  const slate = ask && typeof ask === "object" ? ask.slate : undefined;
  const league = ask && typeof ask === "object" ? leaguePath(ask.league) : null;
  if (!league || !slate || typeof slate !== "object" || Array.isArray(slate)) throw new HttpError(400, "Say which league: { league, slate: {} }");
  if (slate.stage !== undefined && slate.stage !== "regular" && slate.stage !== "post") throw new HttpError(400, "stage is regular or post");
  if (slate.cadence !== undefined && slate.cadence !== "day" && slate.cadence !== "week" && slate.cadence !== "round") throw new HttpError(400, "cadence is day, week or round");
  const sport = sportOf(league);
  if (sport && !(sport instanceof TeamSport)) throw new HttpError(400, "Its season is an event an episode, not a slate");
  let made: Slate | null;
  try {
    made = await makeSlate({
      league,
      stage: slate.stage,
      cadence: slate.cadence,
      userId,
      providers: opts.providers,
      now: opts.now,
      prefix: opts.prefix,
      cast: opts.cast,
      beforeMake: userId ? () => underCap(userId) : undefined,
    });
  } catch (e) {
    if (e instanceof SlateRefused) throw new HttpError(400, e.message);
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
  if (!made) throw new HttpError(404, "No such league");
  if (userId) await setFollow(userId, made.seasonId, { following: true });
  const { seasonId, name, stage, cadence, episodes, games } = made;
  return { seasonId, made: made.made, name, league: made.league, stage, cadence, episodes, games };
}
