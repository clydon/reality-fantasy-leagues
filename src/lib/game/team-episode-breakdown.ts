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
export interface TeamEpisodeSlot {
  slot: number;
  /** held: it scored; void: it didn't count either way; dropped or empty: nothing in it; waiting: no results yet. */
  status: "held" | "void" | "dropped" | "waiting" | "empty";
  /** The group's name as it was offered, when it has one in the episode's records. */
  group: string | null;
  members: Castaway[];
  points: number;
  why: string[];
}
export interface TeamEpisodeLine {
  c: Castaway;
  items: { id: string; label: string; points: number }[];
  points: number;
}
export interface TeamEpisodeBreakdown {
  started: TeamEpisodeLine[];
  benched: TeamEpisodeLine[];
  /** Step A10 part 1, a game with group slots: each slot's line (its group, how it stood, its points), in `lineup` too. */
  slots: TeamEpisodeSlot[];
  bets: PlayerBetRow[];
  lineup: number;
  predictions: number;
  total: number;
}
export function teamEpisodeBreakdown(state: LeagueState, epId: string, playerId: string): TeamEpisodeBreakdown {
  const ep = state.episodes.find((e) => e.id === epId);
  const empty: TeamEpisodeBreakdown = { started: [], benched: [], slots: [], bets: [], lineup: 0, predictions: 0, total: 0 };
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
  // A captain, best ball or points that multiply by when (step A9 part 2): each line as the engine counts it, and best ball's
  // counted ones as its starters.
  const combined = StateLogic.ActiveRosterLogic.combines(state) ? StateLogic.ActiveRosterLogic.episodeScore(state, ep, playerId) : null;
  const counted = combined ? new Map(combined.lines.map((l) => [l.castawayId, l])) : null;
  const lineOf = (c: Castaway): TeamEpisodeLine => {
    const l = line(c);
    const x = counted?.get(c.id);
    return x ? { ...l, points: x.points } : l;
  };
  const starts = (c: Castaway) => (counted ? !!counted.get(c.id)?.counted : startedIds.includes(c.id));
  const started = roster.filter(starts).map(lineOf).sort(byPoints);
  const benched = roster.filter((c) => !starts(c)).map(lineOf).sort(byPoints);
  const bets = StateLogic.betsOn(state) ? playerBetRows(state, playerId).filter((b) => b.episode === ep.number) : [];
  const lineup = combined ? combined.total : StateLogic.roundPoints(started.reduce((t, s) => t + s.points, 0));
  const predictions = StateLogic.roundPoints(bets.reduce((t, b) => t + b.points, 0));
  // Group slots (A10 part 1): their points are in the engine's total, so each gets its line.
  const named = (id: string | undefined) =>
    id ? [ep.formatGroups?.played?.groups, StateLogic.GroupSlotLogic.record(state, ep.number - 1)?.end.groups].flatMap((g) => g ?? []).find((g) => g.id === id)?.name ?? null : null;
  const slots: TeamEpisodeSlot[] = (combined?.slots ?? []).map((l) => ({
    slot: l.slot,
    status: l.status,
    group: named(l.pick?.id),
    members: l.members.map((id) => state.castaways.find((c) => c.id === id)).filter((c): c is Castaway => !!c),
    points: l.points,
    why: l.why,
  }));
  return { started, benched, slots, bets, lineup, predictions, total: StateLogic.roundPoints(lineup + predictions) };
}
