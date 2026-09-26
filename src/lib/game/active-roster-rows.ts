import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

export interface PlayerEventRow {
  episode: number;
  postMerge: boolean;
  castawayName: string;
  label: string;
  points: number;
}

export interface CastawayEventStat {
  type: string;
  label: string;
  /** How many times this castaway has scored this event type, all season. */
  count: number;
  /** Points per occurrence, at the league's current settings. */
  points: number;
}

// A castaway's OWN scoring record -- every event attributed to them, all season, regardless of
// whether their owner actually had them active that episode (unlike playerEventRows below, which is
// an owner's EARNED points and excludes benched episodes). This is what the board grid's points badge
// and expanded stat breakdown show: the castaway's own performance, not any one player's cut of it.
export function castawayEventStats(state: LeagueState, castawayId: string): { total: number; byType: CastawayEventStat[] } {
  const events = StateLogic.formatOf(state).events;
  const counts: Record<string, number> = {};
  let total = 0;
  [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .forEach((ep) => {
      StateLogic.ActiveRosterLogic.episodeEvents(state, ep).forEach((sev) => {
        if (sev.castawayId !== castawayId) return;
        counts[sev.type] = (counts[sev.type] || 0) + 1;
        total += StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
      });
    });
  // Same order as the Active Roster Settings list (the format's own catalog order), filtered to only
  // what this castaway has actually done -- a long list of zeroes isn't "each category they've scored".
  const byType = events
    .filter((e) => counts[e.id] > 0)
    .map((e) => ({ type: e.id, label: e.label, count: counts[e.id], points: StateLogic.ActiveRosterLogic.pointsFor(state, e.id) }));
  return { total, byType };
}

// A player's full scoring-event history, oldest first, with the points each one actually paid them.
// Same shape and purpose as bet-rows.ts's playerBetRows: a Scoreboard disclosure, derived on read
// rather than stored.
//
// Only events whose castaway was in THAT episode's lineup for this player are included, which is the
// same rule ActiveRosterEventScoringStrategy.compute applies -- if that rule changes, this has to
// change with it. An event for a benched castaway is deliberately absent rather than listed at 0
// points: it never was this player's event to score.
export function playerEventRows(state: LeagueState, playerId: string): PlayerEventRow[] {
  const rows: PlayerEventRow[] = [];
  const events = StateLogic.formatOf(state).events;
  [...state.episodes]
    // Before the league's start episode nothing scores -- same rule the scoring strategy applies.
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .sort((a, b) => a.number - b.number)
    .forEach((ep) => {
      const lineup = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
      StateLogic.ActiveRosterLogic.episodeEvents(state, ep).forEach((sev) => {
        if (!lineup.includes(sev.castawayId)) return;
        const def = events.find((e) => e.id === sev.type);
        rows.push({
          episode: ep.number,
          postMerge: ep.postMerge,
          castawayName: StateLogic.getCastaway(state, sev.castawayId)?.name || "?",
          label: def?.label || sev.type,
          points: StateLogic.ActiveRosterLogic.pointsFor(state, sev.type),
        });
      });
    });
  return rows;
}
