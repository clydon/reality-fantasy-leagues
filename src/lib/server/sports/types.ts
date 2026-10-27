// Sports data from providers (docs/PLAN-sports-data.md): one interface every provider answers, so a league's games, rosters,
// box scores and season lines read the same whoever has them. The first build has one provider, ESPN (espn.ts); others (the
// league's own free API, MLB Stats API for the minor leagues) go behind the same interface when a gap shows (docs/BACKLOG.md,
// "Sports data beyond ESPN"). Nothing here knows a sport: a league is whatever the provider calls one, and a box score's
// columns are the provider's own labels (a hitter's `H-AB AB R H RBI`, an AFL player's `D G B T`), so each sport's relevant
// stats come for free. Every call goes through the cache (cache.ts), so a season costs a handful of calls.

/** A league as the provider names it. `id` is the provider's own handle for it (ESPN's "baseball/mlb"). */
export interface League {
  id: string;
  /** The provider's word for the sport ("baseball", "racing"). */
  sport: string;
  /** Its name, when the provider said it in the same answer ("Major League Baseball"). */
  name: string | null;
}

/** What the provider's own search found for some words: a team (in its league) or a league. */
export interface Found {
  kind: "team" | "league";
  /** The team's id in its league (kind "team"); the league's id again (kind "league"). */
  id: string;
  name: string;
  league: string;
}

export interface Team {
  id: string;
  /** Its full name ("Tampa Bay Rays"). */
  name: string;
  /** The names it also goes by, as the provider gives them ("Rays", "Tampa Bay"); never an abbreviation. */
  also: string[];
  abbreviation: string | null;
  logo: string | null;
}

export interface Person {
  id: string;
  name: string;
  /** What they play, as the provider says it ("Relief Pitcher", "Goalkeeper"), when it does. */
  position: string | null;
  headshot: string | null;
}

/** One side of a game: a team (a game between two) or a person (a field: a race, a tournament). */
export interface Competitor {
  team: Team | null;
  person: Person | null;
  home: boolean | null;
  score: string | null;
  winner: boolean | null;
  /** Where they finished, for a field (a race's order). */
  place: number | null;
}

/** "pre": not started; "in": being played; "post": over (final, or called off). */
export type EventState = "pre" | "in" | "post";

/** A season's stages, in order. */
export type SeasonStage = "pre" | "regular" | "post";

/** One part of an event with several (an F1 weekend's practice, qualifying and race), each with its own field and time. */
export interface EventPart {
  id: string;
  /** The provider's short name for it ("FP1", "Qual", "Race"). */
  name: string | null;
  at: string | null;
  state: EventState;
  competitors: Competitor[];
}

/** A game, a race, a match: what an episode of a sport shows. */
export interface SportsEvent {
  id: string;
  league: string;
  /** As the provider names it ("Tampa Bay Rays at Milwaukee Brewers", "MSC Cruises United States Grand Prix"). */
  name: string;
  short: string | null;
  /** When it starts (the first part's start, for an event in parts). */
  at: string | null;
  state: EventState;
  final: boolean;
  /** The provider's season year for it (the stats' season). */
  season: number | null;
  /** Which stage of its season it's in, when the provider says: the preseason, the regular season, or the postseason (playoffs,
   *  finals). Coming in is the stage before the season's games (stats.ts). */
  stage: SeasonStage | null;
  /** A note the provider puts on it ("World Series - Game 1"). */
  note: string | null;
  competitors: Competitor[];
  /** Its parts, when it has more than one; else empty. */
  parts: EventPart[];
}

/** A player on a team's roster (players only: a provider's coaches and staff are left out). */
export interface RosterPlayer extends Person {
  /** The roster's own grouping, when it has one ("Pitchers", "Infielders"). */
  group: string | null;
  jersey: string | null;
}

/** One table of a team's lines in a game ("batting", "pitching"; one table for a sport with one kind of line). */
export interface StatTable {
  name: string | null;
  /** The provider's column labels, in its order. */
  labels: string[];
  rows: { person: Person; values: string[]; starter: boolean | null }[];
  /** The team's totals in the same columns, when the provider gives them. */
  totals: string[] | null;
}

export interface BoxScore {
  event: string;
  state: EventState;
  final: boolean;
  teams: { team: Team; score: string | null; winner: boolean | null; tables: StatTable[] }[];
}

/** A player's regular-season line in one of the provider's categories ("Batting", "Expanded Batting"). */
export interface SeasonLine {
  /** The provider's key for the category ("career-batting", "expanded-batting"). */
  category: string;
  name: string;
  /** The provider's name for the season ("2026", "2025-26"). */
  season: string;
  labels: string[];
  values: string[];
  /** The team it was for, as the provider names it (a traded player has a line per team). */
  team: string | null;
}

/**
 * What every provider answers. A league or event the provider doesn't have is null (or empty), never an error; an error
 * (SportsUnavailable) means the provider itself didn't answer: down, slow, or asking us to slow down.
 */
export interface SportsProvider {
  /** "espn": stored with every link (season_events.provider), so a later provider never reads another's ids. */
  id: string;
  /** For people ("ESPN"), e.g. in Credits. */
  name: string;
  /** Every league it has, from its own index (never a table kept here). */
  leagues(): Promise<League[]>;
  /** Teams and leagues its own search finds for some words ("Tampa Bay Rays", "Formula 1"), best first. */
  find(text: string): Promise<Found[]>;
  /** A league's events on a day (YYYY-MM-DD, the provider's own calendar day). */
  eventsOn(league: string, date: string): Promise<SportsEvent[]>;
  /** A team's players, or null when the provider has no such team. Can be empty (AFL's rosters on ESPN are). */
  roster(league: string, team: string): Promise<RosterPlayer[] | null>;
  /** Each team's player lines in a game, in the provider's own columns, or null when it has none. */
  boxScore(league: string, event: string): Promise<BoxScore | null>;
  /**
   * A player's lines for a season's regular season (its year), or null when the provider has none. Never its postseason: that
   * holds the very games a show of the playoffs is showing.
   */
  seasonStats(league: string, athlete: string, season: number): Promise<SeasonLine[] | null>;
}

/** The provider didn't answer (down, slow, or 429): the caller tries again later, and the cache serves what it last had. */
export class SportsUnavailable extends Error {}
