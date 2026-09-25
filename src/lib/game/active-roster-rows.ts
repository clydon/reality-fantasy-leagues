import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

export interface PlayerEventRow {
  episode: number;
  postMerge: boolean;
  castawayName: string;
  label: string;
  points: number;
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
      const lineup = (ep.lineups && ep.lineups[playerId]) || [];
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
