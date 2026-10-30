// A league names its season by show slug and season number in its state (settings.showId, settings.wikiSeason),
// not by a column. This joins a league row aliased `l` to its show `s` and season `ss`, the way
// season-decisions.ts and the others do, for the new design's queries (couches, follows, the guard, the show
// space). A league whose season isn't in the catalog drops out of an inner join.
export const LEAGUE_SEASON_JOIN = `JOIN shows s ON s.slug = l.state->'settings'->>'showId'
  JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'`;

// The new design's names for the three season games (memory: site-mock-decisions); leagueTypeId is unchanged.
export const GAME_NAMES: Record<string, string> = {
  "classic-draft": "Outlast",
  "active-roster": "Weekly Lineup",
  pickem: "Survival Pool",
  "weekly-calls": "Weekly Calls",
  "weekly-bingo": "Weekly Bingo",
  // A game of questions (step A4 of docs/PLAN-start-a-game-gpt.md): a sheet of them each episode, and a few for the season.
  questions: "Prediction Sheet",
};

/** A league type's name in the new design ("Weekly Lineup"), from settings.leagueTypeId. */
export function gameName(leagueTypeId: string | null | undefined): string {
  return GAME_NAMES[leagueTypeId || "classic-draft"] ?? "Outlast";
}

/** A league's season by name ("Survivor 51"), as SQL over `leagues l` (null for a league not in the catalog). */
export const LEAGUE_SEASON_NAME = `(SELECT COALESCE(ss.name, s.name || ' ' || ss.season_number) FROM shows s JOIN show_seasons ss ON ss.show_id = s.id
  WHERE s.slug = l.state->'settings'->>'showId' AND ss.season_number::text = l.state->'settings'->>'wikiSeason')`;
