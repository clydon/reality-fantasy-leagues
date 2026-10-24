import type { Castaway, LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { rosterAtEpisode } from "./active-roster-rows";
import { playerBetRows, type PlayerBetRow } from "./bet-rows";

/** Episodes that have scored for this league, newest first. */
export function scoredEpisodes(state: LeagueState) {
  return [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0)
    .sort((a, b) => b.number - a.number);
}

/**
 * How one player earned their points in one episode: each starter with its scoring events, the
 * bench with what each would have scored (not counted), and that episode's graded predictions.
 * `total` is lineup + predictions -- the same figure the Scoreboard total adds up for the week.
 */
export interface TeamEpisodeLine {
  c: Castaway;
  items: { id: string; label: string; points: number }[];
  points: number;
}
export interface TeamEpisodeBreakdown {
  started: TeamEpisodeLine[];
  benched: TeamEpisodeLine[];
  bets: PlayerBetRow[];
  lineup: number;
  predictions: number;
  total: number;
}
export function teamEpisodeBreakdown(state: LeagueState, epId: string, playerId: string): TeamEpisodeBreakdown {
  const ep = state.episodes.find((e) => e.id === epId);
  const empty: TeamEpisodeBreakdown = { started: [], benched: [], bets: [], lineup: 0, predictions: 0, total: 0 };
  if (!ep || !StateLogic.inPlay(state, ep.number)) return empty;
  const defs = StateLogic.formatOf(state).events;
  const evs = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  const startedIds = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
  const line = (c: Castaway): TeamEpisodeLine => {
    const items = evs
      .filter((e) => e.castawayId === c.id)
      .map((e) => ({ id: e.id, label: defs.find((d) => d.id === e.type)?.label ?? e.type, points: StateLogic.ActiveRosterLogic.eventPoints(state, e) }));
    return { c, items, points: StateLogic.roundPoints(items.reduce((t, i) => t + i.points, 0)) };
  };
  const roster = rosterAtEpisode(state, playerId, ep.id);
  const byPoints = (a: TeamEpisodeLine, b: TeamEpisodeLine) => b.points - a.points || a.c.name.localeCompare(b.c.name);
  const started = roster.filter((c) => startedIds.includes(c.id)).map(line).sort(byPoints);
  const benched = roster.filter((c) => !startedIds.includes(c.id)).map(line).sort(byPoints);
  const bets = state.settings.bonusEnabled ? playerBetRows(state, playerId).filter((b) => b.episode === ep.number) : [];
  const lineup = StateLogic.roundPoints(started.reduce((t, s) => t + s.points, 0));
  const predictions = StateLogic.roundPoints(bets.reduce((t, b) => t + b.points, 0));
  return { started, benched, bets, lineup, predictions, total: StateLogic.roundPoints(lineup + predictions) };
}
