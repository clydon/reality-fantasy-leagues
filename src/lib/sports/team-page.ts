import { MAX_GAMES, eastDay, matchupName, pickMatchup, type Game, type MatchupAsk } from "./matchup";

// A team's page as the Start-a-game GPT reads it (docs/PLAN-start-a-game-gpt.md step G3 part 2): someone types a game on a team's
// page, before any games are picked ("the upcoming Red Sox–Yankees series", "the 76ers home opener", "the Lakers' next 5 games",
// "the Knicks game tonight"). The pack carries the team's schedule (teamSchedulePack: its games past and coming, trimmed, never a
// score); the bot names the games its words mean as a matchup ask (matchup.ts MatchupAsk, read here by readMatchupAsk); and our check
// holds it against the schedule (holdMatchup): the games it means, or a question with the games it could be (a game already played
// asked about: "the home opener has been played: their next home game?"). The server (src/lib/server/team-words.ts) makes the
// matchup's season from the games and checks the draft again on its page. Pure: the server, the tests and a check share it.

/** Games still to play the pack lists, at most, and the last few played (for "the next one" against "the last one"). */
export const TEAM_SCHEDULE = 20;
export const TEAM_PLAYED = 3;

/** A game as a team's page shows it to the bot: its id, its day in the East, home or away, against whom; whether it's started. */
export interface ScheduleLine {
  id: string;
  day: string | null;
  at: string | null;
  home: boolean | null;
  opponent: { id: string; name: string } | null;
  played: boolean;
  stage?: "pre" | "regular" | "post";
  note?: string;
  called?: string;
}

/** A team as a page names it: its id, its name, and as people say it ("76ers"). */
export interface PageTeam {
  id: string;
  name: string;
  short: string;
}

const opponentOf = (g: Game, team: string) => g.competitors.find((c) => c.team && c.team.id !== team)?.team ?? null;
const homeOf = (g: Game, team: string) => g.competitors.find((c) => c.team?.id === team)?.home ?? null;
/** Over without being played (postponed or canceled): never picked, never listed. */
const calledOff = (g: Game) => g.state === "post" && !g.final;
/** Started, as the provider says or by the clock (a game listed "pre" past its start is under way). */
export const started = (g: Pick<Game, "state" | "at">, now: number) => g.state !== "pre" || (!!g.at && Date.parse(g.at) <= now);

/** The team's games, in order, none called off. */
function gamesOf<G extends Game>(team: string, schedule: G[]): G[] {
  return schedule.filter((g) => g.competitors.some((c) => c.team?.id === team) && !calledOff(g)).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
}

/**
 * A team's schedule as the pack carries it: its next TEAM_SCHEDULE games still to play and the last TEAM_PLAYED played, in order
 * (`more`: how many it leaves out), and every team it plays (each by id and name, the bot's ids for `against`). Never a score.
 */
export function teamSchedulePack(team: string, schedule: Game[], now: number): { schedule: ScheduleLine[]; more: number; teams: { id: string; name: string }[] } {
  const mine = gamesOf(team, schedule);
  const ahead = mine.filter((g) => !started(g, now));
  const played = mine.filter((g) => started(g, now));
  const kept = [...played.slice(-TEAM_PLAYED), ...ahead.slice(0, TEAM_SCHEDULE)];
  const teams = new Map<string, { id: string; name: string }>();
  for (const g of mine) for (const c of g.competitors) if (c.team && !teams.has(c.team.id)) teams.set(c.team.id, { id: c.team.id, name: c.team.name });
  return {
    schedule: kept.map((g) => {
      const o = opponentOf(g, team);
      return {
        id: g.id,
        day: g.at ? eastDay(g.at) : null,
        at: g.at,
        home: homeOf(g, team),
        opponent: o ? { id: o.id, name: o.name } : null,
        played: started(g, now),
        ...(g.stage ? { stage: g.stage } : {}),
        ...(g.note ? { note: g.note } : {}),
        ...(g.called ? { called: g.called } : {}),
      };
    }),
    more: mine.length - kept.length,
    teams: [...teams.values()],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The calendar day after `day` (YYYY-MM-DD): a day's step, never 24 hours (a clock change's day is 23 or 25). */
const dayAfter = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** A team some words name among `teams`: its id as it is, else the one team whose name holds the words (or ends with them). */
function teamIn(teams: { id: string; name: string; short?: string }[], v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const byId = teams.find((t) => t.id === v.trim());
  if (byId) return byId.id;
  const w = plain(v);
  const hits = teams.filter((t) => [t.name, t.short ?? ""].some((n) => n && (plain(n) === w || plain(n).endsWith(` ${w}`))));
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * The bot's matchup ask, read (null when it names no games, or not in a shape pickMatchup reads): `against` a team's id from the
 * page's teams (or a name only one of them has), `count` and `events` 1 to MAX_GAMES, `day` a day in the East ("today", "tonight"
 * and "tomorrow" from `now`). Never `from` (a replay's, not the bot's).
 */
export function readMatchupAsk(raw: unknown, teams: { id: string; name: string; short?: string }[], now: number): MatchupAsk | null {
  if (!isObj(raw)) return null;
  const against = raw.against === undefined || raw.against === null ? undefined : teamIn(teams, raw.against);
  if (against === null) return null;
  switch (raw.kind) {
    case "opener":
      return raw.home === true ? { kind: "opener", home: true } : { kind: "opener" };
    case "series":
      return against ? { kind: "series", against } : null;
    case "next": {
      const n = typeof raw.count === "number" ? raw.count : Number(raw.count);
      return Number.isInteger(n) && n >= 1 ? { kind: "next", count: n, ...(against ? { against } : {}) } : null;
    }
    case "day": {
      const d = typeof raw.day === "string" ? raw.day.trim().toLowerCase() : "";
      const day = d === "today" || d === "tonight" ? eastDay(now) : d === "tomorrow" ? dayAfter(eastDay(now)) : DAY.test(d) ? d : null;
      return day ? { kind: "day", day } : null;
    }
    case "games": {
      const events = Array.isArray(raw.events) ? [...new Set(raw.events.filter((e): e is string => typeof e === "string" && !!e.trim()).map((e) => e.trim()))] : [];
      return events.length ? { kind: "games", events } : null;
    }
    default:
      return null;
  }
}

/** Our check's question about which games: its words, its options (each a set of games by name, matchupName's) and what each
 *  option picks (a `games` ask of its events: the wizard sends it back as it is). */
export interface MatchupQuestion {
  part: "matchup";
  question: string;
  options: string[];
  picks: MatchupAsk[];
  by: "check";
}

/** What holding an ask against the schedule found: the games it means (none while there's a question). */
export interface MatchupHold<G extends Game = Game> {
  games: G[];
  question: MatchupQuestion | null;
}

/** The sets of games a person might mean, from what's still to play: the next game, the next home game, the next series (two games
 *  or more) and the next five, each once (4 at most), the ones `first` puts first. */
function candidates(team: string, mine: Game[], now: number, first: ("home" | "next" | "series" | "five")[] = []): { name: string; pick: MatchupAsk }[] {
  const ahead = mine.filter((g) => !started(g, now));
  if (!ahead.length) return [];
  const sets: Record<string, Game[]> = {
    next: [ahead[0]],
    home: ahead.filter((g) => homeOf(g, team) === true).slice(0, 1),
    series: (() => {
      const o = opponentOf(ahead[0], team);
      const s = o ? pickMatchup(team, ahead, { kind: "series", against: o.id, from: new Date(now).toISOString() }) : [];
      return s.length >= 2 ? s : [];
    })(),
    five: ahead.length > 1 ? ahead.slice(0, 5) : [],
  };
  const order = [...first, ...(["next", "series", "five", "home"] as const).filter((k) => !first.includes(k))];
  const out: { name: string; pick: MatchupAsk }[] = [];
  const seen = new Set<string>();
  for (const k of order) {
    const games = sets[k];
    const key = games.map((g) => g.id).join(",");
    if (!games.length || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: matchupName(games, team), pick: { kind: "games", events: games.map((g) => g.id) } });
  }
  return out.slice(0, 4);
}

/** "Nov 9", in the East. */
const dayWords = (day: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/**
 * The games `ask` means on `team`'s schedule, held against it: the games, or a question (the games picked none, every one has been
 * played, more than MAX_GAMES), its options the games they might mean. A set some of whose games have been played is kept (a series
 * asked mid-series is the whole series: the game starts at its next one to play). `short`: the team as people say it ("76ers").
 * The words (impeccable clarify, 2026-11-07): the fact, then the question; the team's name as a modifier ("No 76ers game tonight"),
 * never a sentence's subject, so a club's reads as well as a franchise's ("No Arsenal game tonight"); "Which of their games?" apart
 * from part 1's "Which game?" (which kind of game).
 */
export function holdMatchup<G extends Game>(team: string, schedule: G[], ask: MatchupAsk | null, o: { now: number; short: string }): MatchupHold<G> {
  const mine = gamesOf(team, schedule);
  const q = (question: string, first: Parameters<typeof candidates>[3] = []): MatchupHold<G> => {
    const c = candidates(team, mine, o.now, first);
    return { games: [], question: { part: "matchup", question: c.length ? question : `No ${o.short} games are left to play this season.`, options: c.map((x) => x.name), picks: c.map((x) => x.pick), by: "check" } };
  };
  const which = "Which of their games?";
  if (!ask) return q(which);
  // "Still to play" as of now (a game listed "pre" past its start is under way: started's rule).
  const asOf = ask.kind === "series" || ask.kind === "next" ? { ...ask, from: new Date(o.now).toISOString() } : ask;
  const games = pickMatchup(team, mine, asOf) as G[];
  if (!games.length) {
    if (ask.kind === "series") {
      const them = mine.map((g) => g.competitors.find((c) => c.team?.id === ask.against)?.team).find(Boolean);
      return q(`No ${o.short} series is left against ${them ? `the ${them.also?.[0] ?? them.name}` : "them"}. ${which}`);
    }
    if (ask.kind === "day") return q(`No ${o.short} game ${ask.day === eastDay(o.now) ? "tonight" : `on ${dayWords(ask.day)}`}. Their next game?`);
    if (ask.kind === "opener") return q(`No ${o.short} ${ask.home ? "home " : ""}opener is on the schedule. ${which}`, ask.home ? ["home"] : []);
    return q(`Those games aren't on the ${o.short} schedule. ${which}`);
  }
  if (ask.kind === "games" && games.length < new Set(ask.events).size) return q(`Some of those games aren't on the ${o.short} schedule. ${which}`);
  if (games.every((g) => started(g, o.now))) {
    if (ask.kind === "opener") return q(`The ${o.short} ${ask.home ? "home " : ""}opener has already been played. Their next ${ask.home ? "home " : ""}game?`, ask.home ? ["home", "next"] : ["next"]);
    return q(games.length === 1 ? "That game has already been played. Their next game?" : "Those games have already been played. Their next games?");
  }
  if (games.length > MAX_GAMES) {
    const c = games.filter((g) => !started(g, o.now)).slice(0, MAX_GAMES);
    return { games: [], question: { part: "matchup", question: `A game can cover up to ${MAX_GAMES} of their games. The next ${MAX_GAMES}?`, options: [matchupName(c, team)], picks: [{ kind: "games", events: c.map((g) => g.id) }], by: "check" } };
  }
  return { games, question: null };
}
