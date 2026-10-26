// A league names its season by show slug and season number in its state (settings.showId, settings.wikiSeason),
// not by a column. This joins a league row aliased `l` to its show `s` and season `ss`, the way
// season-decisions.ts and the others do, for the new design's queries (couches, follows, the guard, the show
// space). A league whose season isn't in the catalog drops out of an inner join.
export const LEAGUE_SEASON_JOIN = `JOIN shows s ON s.slug = l.state->'settings'->>'showId'
  JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'`;

// The new design's names for the three season games (memory: site-mock-decisions); leagueTypeId is unchanged.
const GAME_NAMES: Record<string, string> = {
  "classic-draft": "Outlast",
  "active-roster": "Weekly Lineup",
  pickem: "Survival Pool",
  "weekly-calls": "Weekly Calls",
  "weekly-bingo": "Weekly Bingo",
};

/** A league type's name in the new design ("Weekly Lineup"), from settings.leagueTypeId. */
export function gameName(leagueTypeId: string | null | undefined): string {
  return GAME_NAMES[leagueTypeId || "classic-draft"] ?? "Outlast";
}
