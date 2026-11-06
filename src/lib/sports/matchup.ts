// A matchup: a few games straight from a team's schedule, as a season of their own (docs/PLAN-start-a-game-gpt.md track L, L1
// part 3; docs/PLAN-sports-live.md, "What the Start-a-game GPT needs from ESPN"). "The 76ers home opener", "the upcoming Red
// Sox–Yankees series", "the Yankees' next three": each is a set of the provider's events, and that set is the matchup's key, so
// everyone who asks for the same games shares one season (src/lib/server/sports/matchup.ts makes it). Its episodes are the
// games, its cast the teams' rosters.
//
// Pure, and shared by the server, the phone and the tests: it reads a schedule someone already has (the provider's, read by
// src/lib/server/sports/espn.ts) and never asks for one.
import { num, str } from "./sport";

/** A game as a schedule lists it: the provider's SportsEvent has this shape (src/lib/server/sports/types.ts). */
export interface Game {
  id: string;
  name: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  /** Its season's stage: the regular season, the postseason, the preseason; null when the provider doesn't say. */
  stage: "pre" | "regular" | "post" | null;
  /** A note the provider puts on it ("World Series - Game 1"). */
  note?: string | null;
  competitors: {
    team: { id: string; name: string; also?: string[]; abbreviation?: string | null } | null;
    home: boolean | null;
    score: string | null;
    winner: boolean | null;
  }[];
  odds?: Odds | null;
}

/** A sportsbook's line (src/lib/server/sports/types.ts Odds). */
export interface Odds {
  provider: string | null;
  details: string | null;
  overUnder: number | null;
  spread: number | null;
}

/** A sportsbook's line as ESPN writes it: a scoreboard's `competitions[0].odds[]`, a summary's `pickcenter[]`. */
export interface EspnOdds {
  provider?: { name?: string; displayName?: string };
  details?: string;
  overUnder?: number | string;
  spread?: number | string;
}

/** A sportsbook's line, from a scoreboard's `competitions[0].odds[0]` (before the game; ESPN drops it after) or a summary's
 *  `pickcenter[0]` (kept after): DraftKings' "PHI -2.5" and 237.5. Null when it says nothing. Pure: the server's reader
 *  (src/lib/server/sports/espn.ts) and the phone's poller (live.ts) share it. */
export function readOdds(o: EspnOdds | undefined): Odds | null {
  if (!o) return null;
  const odds = { provider: str(o.provider?.displayName) ?? str(o.provider?.name), details: str(o.details), overUnder: num(o.overUnder), spread: num(o.spread) };
  return odds.details || odds.overUnder != null || odds.spread != null ? odds : null;
}

/**
 * Which games, from one team's schedule:
 * - `games`: these, by the provider's ids;
 * - `opener`: its first game of the regular season (at home, with `home`: "the 76ers home opener");
 * - `series`: the run of games in a row against `against` that the next one still to play is in, all of it ("the Red
 *   Sox–Yankees series", asked mid-series, is still the whole series);
 * - `next`: its next `count` games still to play (only against `against`, if given).
 * "Still to play" is as the provider says now, or with `from` (an ISO time), starting from then: "the upcoming Red Sox–Yankees
 * series" as of the day it was asked, on a schedule read after it was played.
 */
export type MatchupAsk =
  | { kind: "games"; events: string[] }
  | { kind: "opener"; home?: boolean }
  | { kind: "series"; against: string; from?: string }
  | { kind: "next"; count: number; against?: string; from?: string };

/** Games of one regular-season series are this close together, at most (a four-game set over four days; never a home-and-home
 *  weeks apart). A postseason series is its games against them in a row, however far apart (a Final's days off). */
export const SERIES_GAP_MS = 3 * 86_400_000;

const plays = (g: Game, team: string) => g.competitors.some((c) => c.team?.id === team);
const opponent = (g: Game, team: string) => g.competitors.find((c) => c.team && c.team.id !== team)?.team?.id ?? null;
const atHome = (g: Game, team: string) => g.competitors.some((c) => c.team?.id === team && c.home === true);
const ms = (g: Game) => (g.at ? Date.parse(g.at) : NaN);

/** Whether two games, one after the other, are one series for `team`: against the same opponent, both in the postseason (a
 *  Final's days off) or within SERIES_GAP_MS (L7's schedule groups by it too: src/lib/sports/teams.ts scheduleOf). */
export function oneSeries(a: Game, b: Game, team: string): boolean {
  const oa = opponent(a, team);
  if (!oa || oa !== opponent(b, team)) return false;
  return (a.stage === "post" && b.stage === "post") || Math.abs(ms(b) - ms(a)) <= SERIES_GAP_MS;
}

/** The games `ask` means, from `team`'s schedule, in order; empty when none fit. */
export function pickMatchup(team: string, schedule: Game[], ask: MatchupAsk): Game[] {
  const mine = schedule.filter((g) => plays(g, team)).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  if (ask.kind === "games") return mine.filter((g) => ask.events.includes(g.id));
  if (ask.kind === "opener") {
    const regular = mine.some((g) => g.stage) ? mine.filter((g) => g.stage === "regular") : mine;
    const first = regular.find((g) => !ask.home || atHome(g, team));
    return first ? [first] : [];
  }
  const from = ask.from != null ? Date.parse(ask.from) : null;
  const toPlay = (g: Game) => (from != null && Number.isFinite(from) ? ms(g) >= from : g.state !== "post");
  if (ask.kind === "next") return mine.filter((g) => toPlay(g) && (!ask.against || opponent(g, team) === ask.against)).slice(0, Math.max(0, ask.count));
  // A series: the next game against them still to play, and the games in a row with it against them, close together.
  const i = mine.findIndex((g) => toPlay(g) && opponent(g, team) === ask.against);
  if (i < 0) return [];
  const together = (a: Game, b: Game) => opponent(a, team) === ask.against && oneSeries(a, b, team);
  let first = i;
  let last = i;
  while (first > 0 && together(mine[first - 1], mine[first])) first--;
  while (last < mine.length - 1 && together(mine[last], mine[last + 1])) last++;
  return mine.slice(first, last + 1);
}

/**
 * The league's show's name: what people call it as ESPN says, its abbreviation when that's words or a short one ("Premier
 * League" of "English Premier League", "Liga MX", "NBA", "NWSL"), else its full name (college's codes nobody says: "NCAA Men's
 * Basketball", not "NCAAM"; "NCAA Football" of "NCAA - Football"); else (an answer that doesn't say: a basketball team's
 * schedule, one cached before) its slug as people write it ("nba" is "NBA"; "mens-college-basketball" is "Mens College
 * Basketball").
 */
export function leagueName(league: string, named?: { name: string; short: string | null } | null): string {
  if (named) return (named.short && (/[a-z]/.test(named.short) || /^[A-Z0-9]{1,4}$/.test(named.short)) ? named.short : named.name).replace(/\s+-\s+/g, " ");
  const slug = league.split("/").pop() ?? league;
  if (/^[a-z]+$/.test(slug) && slug.length <= 5) return slug.toUpperCase();
  return slug
    .split(/[-.]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** A matchup's key: its games, whoever asked and in whatever order ("espn:basketball/nba:401909093"). */
export function matchupKey(provider: string, league: string, events: string[]): string {
  return `${provider}:${league}:${[...new Set(events)].sort().join(",")}`;
}

/** A matchup of games named one by one is this many at most (db/migrations/0300); a team's season (L7) up to MAX_SEASON (0303). */
export const MAX_GAMES = 30;
export const MAX_SEASON = 200;

/** L7: a team's season's key: the team and its season, whatever its games ("espn:baseball/mlb:season:10:2026"). */
export function seasonKey(provider: string, league: string, team: string, year: number): string {
  return `${provider}:${league}:season:${team}:${year}`;
}

/** A team as people say it: ESPN's short name ("76ers"), else its name. */
const short = (t: { name: string; also?: string[] }) => t.also?.[0] ?? t.name;
/** "Oct 22", in the East (where ESPN's days are). */
const day = (at: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(at));

/**
 * A matchup's name, for its season: "Cavaliers at 76ers, Oct 22" (one game), "Red Sox at Yankees, Sep 29 – Oct 1" (a series
 * at one place), "Red Sox vs Yankees, ..." (between two teams, home and away), "76ers, 3 games, Oct 28 – Nov 1" (one team's
 * games against several). `team`: whose schedule it's from.
 */
export function matchupName(games: Game[], team?: string): string {
  if (!games.length) return "";
  const dates = games.map((g) => g.at).filter((x): x is string => !!x).sort();
  const first = dates[0] ? day(dates[0]) : "";
  const last = dates.length ? day(dates[dates.length - 1]) : "";
  const when = first && last && first !== last ? `${first} – ${last}` : first;
  const sides = new Map<string, { name: string; also?: string[] }>();
  for (const g of games) for (const c of g.competitors) if (c.team) sides.set(c.team.id, c.team);
  let what: string;
  if (sides.size === 2) {
    const homes = new Set(games.map((g) => g.competitors.find((c) => c.home === true)?.team?.id ?? ""));
    const g = games[0];
    const home = g.competitors.find((c) => c.home === true)?.team;
    const away = g.competitors.find((c) => c.home === false)?.team;
    if (homes.size === 1 && home && away) what = `${short(away)} at ${short(home)}`;
    else {
      const [a, b] = [...sides.values()];
      what = `${short(a)} vs ${short(b)}`;
    }
  } else {
    const t = (team && sides.get(team)) || [...sides.values()][0];
    what = `${t ? short(t) : "Games"}, ${games.length} ${games.length === 1 ? "game" : "games"}`;
  }
  return when ? `${what}, ${when}` : what;
}

/** A matchup season's status (show_seasons.status) from its games: all over, some started, or none yet. */
export function matchupStatus(games: Pick<Game, "state" | "final" | "at">[], now: number): "upcoming" | "airing" | "completed" {
  if (games.length && games.every((g) => g.state === "post")) return "completed";
  if (games.some((g) => g.state !== "pre" || (g.at != null && Date.parse(g.at) <= now))) return "airing";
  return "upcoming";
}

/** A side of a game as it's stored (sports_events.teams): who, home or away, the score and the winner, once known. */
export interface Side {
  id: string;
  name: string;
  abbreviation: string | null;
  home: boolean | null;
  score: number | null;
  winner: boolean | null;
}

/** What's kept of a game (sports_events): its sides, its final once it's over, its line before it. */
export interface GameFacts {
  event: string;
  name: string;
  startsAt: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  sides: Side[];
  odds: Odds | null;
}

export function factsOf(g: Game): GameFacts {
  return {
    event: g.id,
    name: g.name,
    startsAt: g.at,
    state: g.state,
    final: g.final && g.state === "post",
    sides: g.competitors
      .filter((c) => c.team)
      .map((c) => {
        return { id: c.team!.id, name: c.team!.name, abbreviation: c.team!.abbreviation ?? null, home: c.home, score: num(c.score), winner: c.winner };
      }),
    odds: g.odds ?? null,
  };
}

/**
 * What a final settles that a box score doesn't (the sports settles' `final`: "Who wins?", "Total points: over or under?"):
 * the winner's team id, each side's score, the total, and against a line, over, under or a push. Null until it's final.
 */
export function finalOf(f: Pick<GameFacts, "final" | "sides">, line?: number | null): { winner: string | null; score: Record<string, number>; total: number; overUnder: "over" | "under" | "push" | null } | null {
  if (!f.final || f.sides.some((s) => s.score == null)) return null;
  const score = Object.fromEntries(f.sides.map((s) => [s.id, s.score as number]));
  const total = f.sides.reduce((n, s) => n + (s.score as number), 0);
  const winner = f.sides.find((s) => s.winner === true)?.id ?? null;
  return { winner, score, total, overUnder: line == null ? null : total > line ? "over" : total < line ? "under" : "push" };
}
