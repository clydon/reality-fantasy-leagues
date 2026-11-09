import { easternDay } from "@/lib/game/tv-listings";
import { leagueName } from "@/lib/sports/matchup";
import { shortOf } from "@/lib/sports/teams";
import { teamLeagues } from "./find";
import { sportsProviders } from "./index";
import { SportsUnavailable, type SportsEvent, type SportsProvider } from "./types";

// The guide's Sports (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "The guide's Sports"): a week of games, a day
// at a time in the East, for each pro team league the app reads (college leagues only when asked: a couch's team plays in one),
// from each league's day scoreboard (cached by cache.ts keepDay: three minutes while a game's on, an hour before, 30 days once
// over), so the same week for everyone costs ESPN a call a league a day at most. The phone hides what Sports scores too hides.

export interface WeekSide {
  id: string;
  name: string;
  short: string;
  abbreviation: string | null;
  logo: string | null;
  color: string | null;
  home: boolean | null;
  score: string | null;
  winner: boolean | null;
}

export interface WeekGame {
  id: string;
  league: string;
  leagueName: string;
  at: string | null;
  state: SportsEvent["state"];
  final: boolean;
  called: string | null;
  note: string | null;
  /** Away first, home second, as a guide reads "Eagles at Cowboys". */
  sides: WeekSide[];
}

export interface SportsWeek {
  /** Each day in the East ("2026-11-09"), its games by start. */
  days: { day: string; games: WeekGame[] }[];
  /** Leagues the provider didn't answer for (the rest still show). */
  down: string[];
}

/** The leagues a week reads by default: each team sport's own pro leagues. */
export const proLeagues = () => teamLeagues().filter((l) => !/college/.test(l));

const DAYS = 7;

function sideOf(c: SportsEvent["competitors"][number]): WeekSide | null {
  if (!c.team) return null;
  return {
    id: c.team.id,
    name: c.team.name,
    short: shortOf(c.team),
    abbreviation: c.team.abbreviation,
    logo: c.team.logo,
    color: c.team.color ?? null,
    home: c.home,
    score: c.score,
    winner: c.winner,
  };
}

function gameOf(e: SportsEvent): WeekGame | null {
  const sides = e.competitors.map(sideOf).filter((s): s is WeekSide => !!s);
  if (sides.length !== 2) return null;
  sides.sort((a, b) => +(a.home === true) - +(b.home === true));
  return {
    id: e.id,
    league: e.league,
    leagueName: leagueName(e.league, e.leagueName),
    at: e.at,
    state: e.state,
    final: e.final,
    called: e.called ?? (e.state === "post" && !e.final ? "postponed" : null),
    note: e.note,
    sides,
  };
}

/** A week of games from `from` (a day in the East; today's when not given), each league's own and `also`'s. */
export async function sportsWeek(opts: { from?: string | null; also?: string[]; providers?: SportsProvider[]; now?: Date } = {}): Promise<SportsWeek> {
  const p = (opts.providers ?? sportsProviders())[0];
  const today = easternDay(opts.now ?? new Date());
  const from = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? opts.from : today;
  const start = new Date(`${from}T12:00:00Z`);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const leagues = [...new Set([...proLeagues(), ...(opts.also ?? [])])];
  const down = new Set<string>();
  const out: SportsWeek = { days: days.map((day) => ({ day, games: [] })), down: [] };
  if (!p) return { ...out, down: leagues };
  // A few at a time: a first look at a cold week is ~35 answers.
  const asks = leagues.flatMap((league) => days.map((day, i) => ({ league, day, i })));
  for (let k = 0; k < asks.length; k += 8) {
    await Promise.all(
      asks.slice(k, k + 8).map(async ({ league, day, i }) => {
        try {
          for (const e of await p.eventsOn(league, day)) {
            const g = gameOf(e);
            if (g) out.days[i].games.push(g);
          }
        } catch (e) {
          if (!(e instanceof SportsUnavailable)) throw e;
          down.add(league);
        }
      })
    );
  }
  for (const d of out.days) d.games.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "") || a.league.localeCompare(b.league));
  return { ...out, down: [...down] };
}
