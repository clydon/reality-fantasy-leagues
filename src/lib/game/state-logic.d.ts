// Minimal ambient typing for the verbatim-copied state-logic.js, covering only what this repo's
// components actually call. Not exhaustive — extend as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe } from "./types";

declare const StateLogic: {
  Core: {
    uid(prefix: string): string;
    getPlayer(state: LeagueState, id: string): Player | undefined;
    getCastaway(state: LeagueState, id: string): Castaway | undefined;
    getTribe(state: LeagueState, id: string): Tribe | undefined;
  };
  ScoringLogic: {
    compute(state: LeagueState): ScoreRow[];
  };
  DraftLogic: {
    currentTurn(state: LeagueState): DraftTurn;
    isStarted(state: LeagueState): boolean;
  };
  getPlayer(state: LeagueState, id: string): Player | undefined;
  getCastaway(state: LeagueState, id: string): Castaway | undefined;
  computeScores(state: LeagueState): ScoreRow[];
  currentDraftTurn(state: LeagueState): DraftTurn;
  isDraftStarted(state: LeagueState): boolean;
};

export default StateLogic;
