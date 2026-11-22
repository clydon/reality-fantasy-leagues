import type { Standings } from "@/lib/sports/standings";
import { sportsProviders } from "./index";
import type { SportsProvider } from "./types";

// A league's standings (docs/PLAN-sports-couch.md B1, the Standings tab; docs/HOSTING.md "A league's page, Standings"): the
// provider's table (cached 15 minutes: cache.ts), each team given its colour from the league's team list (cached a week), so the
// tab draws our marks, never a league's logo. The same for everyone: the phone adds who on the couch follows which team, and holds
// the whole table for anyone hiding sports scores.

export async function leagueStandings(league: string, opts: { providers?: SportsProvider[] } = {}): Promise<Standings | null> {
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) return null;
  const [table, teams] = await Promise.all([p.standings(league), p.teams(league).catch(() => null)]);
  if (!table) return null;
  const colour = new Map((teams?.teams ?? []).map((t) => [t.id, t.color ?? null]));
  return { ...table, groups: table.groups.map((g) => ({ ...g, entries: g.entries.map((e) => ({ ...e, color: e.color ?? colour.get(e.team) ?? null })) })) };
}
