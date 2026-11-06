// Finding a game (docs/PLAN-start-a-game-gpt.md track L, L7; docs/PLAN-sports-add.md, "The design"): a team found by the words
// people type ("yanks", "NYY", "new york y", "Eagles": Philadelphia's first), two teams in any order ("cowboys eagles", "eagles at
// cowboys", "yankees red sox") as one matchup, and a team's schedule as the screens show it: its games, past and coming, its
// series (games in a row against one opponent, close together) and its meetings with one opponent.
//
// Pure, and shared by the server, the phone and the tests: it reads team lists and schedules someone already has (the provider's,
// read by src/lib/server/sports/espn.ts readTeams and schedule) and never asks for one. Nothing here knows a league: a list is
// whatever the provider says a league's teams are, and pro or college is the league's own slug.
import { leagueName, oneSeries, type Game } from "./matchup";

/** A team as a league's list gives it (src/lib/server/sports/types.ts Team). */
export interface ListedTeam {
  id: string;
  name: string;
  also?: string[];
  abbreviation?: string | null;
  logo?: string | null;
  color?: string | null;
}

/** A league's teams, with the league's names when the provider said them. */
export interface TeamList {
  league: string;
  name: { name: string; short: string | null } | null;
  teams: ListedTeam[];
}

/** A team found: who, in which league, and how well the words fit it (100 its abbreviation or its whole name). */
export interface TeamHit {
  league: string;
  leagueName: string | null;
  id: string;
  name: string;
  /** As people say it ("Eagles", "76ers"). */
  short: string;
  abbreviation: string | null;
  logo: string | null;
  /** ESPN's hex colour, without the #. */
  color: string | null;
  /** A college league's (its slug says so): pro teams come first. */
  college: boolean;
  score: number;
}

/** Two teams of one league, found in any order. `home`: the side the words put at home ("eagles at cowboys"), else null. */
export interface MatchupHit {
  league: string;
  leagueName: string | null;
  teams: [TeamHit, TeamHit];
  home: string | null;
}

/** A hit at least this good is a team the words name (every word fits one of its names). */
export const FITS = 70;

/** Words as compared: no accents, no case, no punctuation ("N'Western (MN)" is "nwestern mn", "Texas A&M" "texas am"). */
export function wordsOf(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’&.]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** A typed word fits a name's word: its start ("phil", "yank"), or a plural people say ("yanks" of "yankees"). */
function fitsWord(typed: string, word: string): boolean {
  if (word.startsWith(typed)) return true;
  return typed.length >= 4 && typed.endsWith("s") && word.startsWith(typed.slice(0, -1));
}

const isCollege = (league: string) => /college|ncaa/.test(league);
const shortOf = (t: ListedTeam) => t.also?.[0] ?? t.name;

/**
 * How well `typed` (its words) fits a team, 0 to 100: its abbreviation (100), its whole name (100) or another of its names (96),
 * the start of one of its names (85: "new york y"), every word the start of one of its names' words (70: "york yank"), else 0.
 */
export function teamScore(typed: string[], t: ListedTeam): number {
  if (!typed.length) return 0;
  const q = typed.join(" ");
  const n = namesOf(t);
  if (n.abbreviation && typed.length === 1 && q.length >= 2 && q === n.abbreviation) return 100;
  if (q === n.full) return 100;
  if (n.others.includes(q)) return 96;
  if (n.full.startsWith(q) || n.others.some((x) => x.startsWith(q))) return 85;
  return typed.every((w) => n.words.some((x) => fitsWord(w, x))) ? FITS : 0;
}

/** A team's names as compared, worked out once per team (a search tries the lists several times over). */
const NAMES = new WeakMap<ListedTeam, { abbreviation: string; full: string; others: string[]; words: string[] }>();
function namesOf(t: ListedTeam) {
  let n = NAMES.get(t);
  if (!n) {
    const full = wordsOf(t.name).join(" ");
    const others = (t.also ?? []).map((x) => wordsOf(x).join(" ")).filter(Boolean);
    n = { abbreviation: t.abbreviation ? wordsOf(t.abbreviation).join("") : "", full, others, words: [...new Set([full, ...others].flatMap((x) => x.split(" ")))] };
    NAMES.set(t, n);
  }
  return n;
}

/** A team as a hit: from its league's list, with how well it fits. */
export function teamHit(list: TeamList, t: ListedTeam, score: number): TeamHit {
  return {
    league: list.league,
    // As its show is named (matchup.ts leagueName: "NFL", "NCAA Men's Basketball", never "NCAAM").
    leagueName: list.name ? leagueName(list.league, list.name) : null,
    id: t.id,
    name: t.name,
    short: shortOf(t),
    abbreviation: t.abbreviation ?? null,
    logo: t.logo ?? null,
    color: t.color ?? null,
    college: isCollege(list.league),
    score,
  };
}

/**
 * The teams `typed` fits, best first: the better fit first; then a pro team before a college one (the Eagles are Philadelphia's
 * before Boston College's, unless the words say "Boston College"); then a school in more of the leagues searched (one that plays
 * football and basketball before one that only plays one); then the lists' order and the name.
 */
function hitsFor(lists: TeamList[], typed: string[]): TeamHit[] {
  const schools = new Map<string, number>();
  for (const l of lists) if (isCollege(l.league)) for (const t of l.teams) schools.set(t.name, (schools.get(t.name) ?? 0) + 1);
  const out: { hit: TeamHit; order: number }[] = [];
  lists.forEach((l, order) => {
    for (const t of l.teams) {
      const score = teamScore(typed, t);
      if (score >= FITS) out.push({ hit: teamHit(l, t, score), order });
    }
  });
  return out
    .sort(
      (a, b) =>
        b.hit.score - a.hit.score ||
        Number(a.hit.college) - Number(b.hit.college) ||
        (schools.get(b.hit.name) ?? 0) - (schools.get(a.hit.name) ?? 0) ||
        a.order - b.order ||
        a.hit.name.localeCompare(b.hit.name)
    )
    .map((x) => x.hit);
}

/** What puts two teams side by side in words ("at" and "@" put the second at home). */
const BETWEEN = /\s+(at|vs\.?|v\.?|versus|against)\s+|\s*(@)\s*/i;

/** The best pair, one from each side's hits, in one league: the better fits, then pro before college. */
function pairOf(left: TeamHit[], right: TeamHit[]): [TeamHit, TeamHit] | null {
  let best: [TeamHit, TeamHit] | null = null;
  const rank = (p: [TeamHit, TeamHit]) => Math.min(p[0].score, p[1].score) * 1000 + (p[0].score + p[1].score) - (p[0].college ? 0.5 : 0);
  for (const a of left) {
    for (const b of right) {
      if (a.league !== b.league || a.id === b.id) continue;
      if (!best || rank([a, b]) > rank(best)) best = [a, b];
    }
  }
  return best;
}

/**
 * The teams some words find, and the matchup when they name two teams of one league in any order: split where they say so ("at",
 * "@", "vs", "v", "versus", "against"), else at whichever word fits two teams best ("yankees red sox"). Split at a word, a matchup
 * only when each of its sides fits better than the words fit any one team ("red sox" is the Red Sox, never Red Wings against White
 * Sox; "new york y" the Yankees).
 * When the words find no one team but a matchup, its two teams are the teams found. `limit` teams at most (12).
 */
export function findTeams(lists: TeamList[], text: string, opts: { limit?: number } = {}): { teams: TeamHit[]; matchup: MatchupHit | null } {
  const limit = opts.limit ?? 12;
  const typed = wordsOf(text);
  const teams = hitsFor(lists, typed);
  const whole = teams[0]?.score ?? 0;
  let matchup: MatchupHit | null = null;
  const said = text.split(BETWEEN);
  // split() with two groups: [left, at|vs|..., @, right] when said once.
  if (said.length === 4 && said[0].trim() && said[3].trim()) {
    const pair = pairOf(hitsFor(lists, wordsOf(said[0])), hitsFor(lists, wordsOf(said[3])));
    const atHome = /^at$/i.test(said[1] ?? "") || said[2] === "@";
    if (pair) matchup = { league: pair[0].league, leagueName: pair[0].leagueName, teams: pair, home: atHome ? pair[1].id : null };
  }
  if (!matchup && typed.length >= 2) {
    let best: [TeamHit, TeamHit] | null = null;
    for (let i = 1; i < typed.length; i++) {
      // A side of one letter names no one ("new york y" is the Yankees, never the Mets against them).
      if (typed.slice(0, i).join("").length < 2 || typed.slice(i).join("").length < 2) continue;
      const pair = pairOf(hitsFor(lists, typed.slice(0, i)), hitsFor(lists, typed.slice(i)));
      if (pair && Math.min(pair[0].score, pair[1].score) > whole && (!best || pair[0].score + pair[1].score > best[0].score + best[1].score)) best = pair;
    }
    if (best) matchup = { league: best[0].league, leagueName: best[0].leagueName, teams: best, home: null };
  }
  return { teams: (teams.length ? teams : matchup ? [...matchup.teams] : []).slice(0, limit), matchup };
}

/** One of a team's games, as its schedule shows it: whom against, home or away, and how it went. */
export interface ScheduleGame {
  id: string;
  name: string;
  at: string | null;
  state: Game["state"];
  final: boolean;
  stage: Game["stage"];
  note: string | null;
  home: boolean | null;
  opponent: { id: string; name: string; short: string; abbreviation: string | null } | null;
  /** The team's score and the opponent's, once it's started. */
  score: [number, number] | null;
  /** Once it's final: won, lost or tied. */
  result: "W" | "L" | "T" | null;
  /** Over without being played (postponed or cancelled: ESPN lists a postponed game's makeup as a game of its own). */
  calledOff: boolean;
}

/** Games in a row against one opponent, close together (one game where the sport doesn't play series). */
export interface Series {
  opponent: string | null;
  /** Home for every game (true), away for every game (false), else null. */
  home: boolean | null;
  games: string[];
  from: string | null;
  to: string | null;
  /** Every game over, one under way or over with more to come, or none started. */
  state: "past" | "now" | "coming";
}

const opponentOf = (g: Game, team: string) => g.competitors.find((c) => c.team && c.team.id !== team)?.team ?? null;
const numOf = (s: string | null | undefined) => (s != null && s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

/**
 * A team's schedule as the screens show it, from the provider's games (any order, other teams' left out): each game from the
 * team's side, its series in order (a game called off in none), and the next game still to play (the first not over, as the
 * provider says). `against`: only their games against that team (their meetings this season).
 */
export function scheduleOf(team: string, schedule: Game[], opts: { against?: string | null } = {}): { games: ScheduleGame[]; series: Series[]; next: string | null } {
  const mine = schedule
    .filter((g) => g.competitors.some((c) => c.team?.id === team) && (!opts.against || opponentOf(g, team)?.id === opts.against))
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  const games = mine.map((g): ScheduleGame => {
    const us = g.competitors.find((c) => c.team?.id === team);
    const them = g.competitors.find((c) => c.team && c.team.id !== team);
    const a = numOf(us?.score);
    const b = numOf(them?.score);
    const score = g.state !== "pre" && a != null && b != null ? ([a, b] as [number, number]) : null;
    const done = g.final && g.state === "post";
    const result = done && score ? (us?.winner === true || score[0] > score[1] ? "W" : them?.winner === true || score[0] < score[1] ? "L" : "T") : null;
    const t = them?.team;
    return {
      id: g.id,
      name: g.name,
      at: g.at,
      state: g.state,
      final: done,
      stage: g.stage,
      note: g.note ?? null,
      home: us?.home ?? null,
      opponent: t ? { id: t.id, name: t.name, short: t.also?.[0] ?? t.name, abbreviation: t.abbreviation ?? null } : null,
      score,
      result,
      calledOff: g.state === "post" && !done,
    };
  });
  // Series of the games played or to play: a game called off is in no series.
  const played = mine.filter((g) => !(g.state === "post" && !g.final));
  const series: Series[] = [];
  played.forEach((g, i) => {
    const run = series[series.length - 1];
    if (run && i > 0 && oneSeries(played[i - 1], g, team)) run.games.push(g.id);
    else series.push({ opponent: opponentOf(g, team)?.id ?? null, home: null, games: [g.id], from: g.at, to: g.at, state: "coming" });
  });
  for (const s of series) {
    const gs = games.filter((g) => s.games.includes(g.id));
    s.to = gs[gs.length - 1].at;
    const homes = new Set(gs.map((g) => g.home));
    s.home = homes.size === 1 ? [...homes][0] : null;
    s.state = gs.every((g) => g.state === "post") ? "past" : gs.every((g) => g.state === "pre") ? "coming" : "now";
  }
  return { games, series, next: games.find((g) => g.state !== "post")?.id ?? null };
}

/**
 * A team's season's name: "Eagles, 2026 season", "76ers, 2026-27 season" (a season across two years, as the league names it:
 * ESPN's year for it is the year it ends in), from the team as people say it and its games' dates.
 */
export function seasonName(short: string, year: number | null, games: { at: string | null }[]): string {
  const dates = games.map((g) => g.at).filter((x): x is string => !!x).sort();
  // The year in the East (a New Year's Eve game at 8 PM is the old year's, though it's past midnight UTC).
  const yearOf = (at: string) => Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/New_York" }).format(new Date(at)));
  const first = dates.length ? yearOf(dates[0]) : null;
  const last = dates.length ? yearOf(dates[dates.length - 1]) : null;
  const y = year ?? last;
  if (y == null) return `${short}, season`;
  const across = first != null && last != null && first < last && y === last;
  return `${short}, ${across ? `${first}-${String(last).slice(-2)}` : y} season`;
}
