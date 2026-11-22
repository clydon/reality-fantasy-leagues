import { formOf, type TeamForm } from "@/lib/sports/couch-table";
import { scheduleOf } from "@/lib/sports/teams";
import { seasonGames } from "./find";
import { sportsProviders } from "./index";
import type { SportsProvider } from "./types";

// The couch's table in a league (docs/PLAN-sports-couch.md B1, a league's This week): for each team asked, its record, its last
// five and its meetings with the others asked, from each team's season as a team's sheet reads it (seasonGames: the provider's
// schedule, cached by the provider's own keeps), so no new kind of call to ESPN. The same for everyone (no couch, no person in
// it): the phone joins it with who follows which team, and hides every result for anyone hiding sports scores.

/** At most this many teams a read (a couch's teams in one league; more are a big couch's, the rest left off the table). */
export const MAX_TABLE_TEAMS = 16;

export async function leagueTeams(league: string, teams: string[], opts: { providers?: SportsProvider[] } = {}): Promise<TeamForm[]> {
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) return [];
  const ids = [...new Set(teams)].slice(0, MAX_TABLE_TEAMS);
  const among = new Set(ids);
  const out = await Promise.all(
    ids.map(async (id) => {
      const games = await seasonGames(p, league, id);
      return games ? formOf(id, scheduleOf(id, games).games, among) : null;
    })
  );
  return out.filter((f): f is TeamForm => !!f);
}
