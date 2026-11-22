import { easternDay } from "@/lib/game/tv-listings";
import { leagueName } from "@/lib/sports/matchup";
import { nowOf, type LeagueNow } from "@/lib/sports/league-now";
import { slateChoices } from "./slate";
import type { SportsProvider } from "./types";

// Where a league's season is today (docs/PLAN-sports-couch.md A2, the league card in Your shows), from the league's calendar,
// which slate.ts already reads for a slate (the bare scoreboard and its season's types, cached a day): no new kind of call to
// ESPN. What it says of the calendar is src/lib/sports/league-now.ts's (pure, tested).

export type { LeagueNow };

/** A league's now, or null for a league the app doesn't read. A tour's league (golf's, F1's) has no calendar of weeks: always on. */
export async function leagueNow(league: string, opts: { providers?: SportsProvider[]; now?: Date } = {}): Promise<LeagueNow | null> {
  const choices = await slateChoices(league, opts);
  if (!choices) return { league, leagueName: leagueName(league), season: null, on: true, stage: null, week: null, back: null };
  const cadence = choices.stages[0]?.cadences[0] ?? null;
  return nowOf(league, choices.calendar, cadence, easternDay(opts.now ?? new Date()));
}
