// Minimal ambient typing for the verbatim-copied state-logic.js, covering only what this repo's
// components actually call. Not exhaustive — extend as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe, Bet, Episode } from "./types";

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
    currentTurn(state: LeagueState): DraftTurn | null;
    isStarted(state: LeagueState): boolean;
  };
  getPlayer(state: LeagueState, id: string): Player | undefined;
  getCastaway(state: LeagueState, id: string): Castaway | undefined;
  computeScores(state: LeagueState): ScoreRow[];
  currentDraftTurn(state: LeagueState): DraftTurn | null;
  isDraftStarted(state: LeagueState): boolean;
  addBet(state: LeagueState, epId: string, label: string, points: number, createdByPlayerId: string | null): Bet;
  removeBet(state: LeagueState, epId: string, betId: string): void;
  addBetPrediction(state: LeagueState, epId: string, betId: string, playerId: string, guess: string): void;
  setBetPredictionCorrect(state: LeagueState, epId: string, betId: string, predId: string, value: boolean | null): void;
  syncDraftOrder(state: LeagueState): void;
  freeAgents(state: LeagueState): Castaway[];
  reorderDraft(state: LeagueState, fromIndex: number, toIndex: number): void;
  moveDraftOrder(state: LeagueState, index: number, delta: number): void;
  draftToCurrentTurn(state: LeagueState, castawayId: string): void;
  undraft(state: LeagueState, castawayId: string): void;
  forceStartDraft(state: LeagueState): void;
  addEpisode(state: LeagueState): Episode;
  removeEpisode(state: LeagueState, epId: string): void;
  updateEpisode(state: LeagueState, epId: string, field: string, value: unknown): void;
  addElimination(state: LeagueState, epId: string, castawayId: string, method: string): void;
  removeElimination(state: LeagueState, epId: string, castawayId: string): void;
  nextPlacementOrder(state: LeagueState): number;
  updateBet(state: LeagueState, epId: string, betId: string, field: string, value: unknown): void;
  removeBetPrediction(state: LeagueState, epId: string, betId: string, predId: string): void;
  EXIT_METHODS: string[];
};

export default StateLogic;
