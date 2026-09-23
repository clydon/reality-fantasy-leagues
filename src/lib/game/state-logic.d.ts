// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe, Bet, Episode, ReplenishTurn } from "./types";

export interface LeagueType {
  id: string;
  name: string;
  description: string;
  supportsReplenish: boolean;
  supportsTrade: boolean;
  supportsFinalePredictions: boolean;
}

export interface Show {
  id: string;
  name: string;
  castawayTerm: string;
  tribeTerm: string;
}

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
  LEAGUE_TYPES: Record<string, LeagueType>;
  SHOWS: Record<string, Show>;
  getLeagueType(state: LeagueState): LeagueType;
  getPlayer(state: LeagueState, id: string): Player | undefined;
  getCastaway(state: LeagueState, id: string): Castaway | undefined;
  computeScores(state: LeagueState): ScoreRow[];
  currentDraftTurn(state: LeagueState): DraftTurn | null;
  isDraftStarted(state: LeagueState): boolean;
  defaultState(): LeagueState;
  migrateLeagueState(raw: unknown): LeagueState;
  freeAgents(state: LeagueState): Castaway[];
  activeOwnedCount(state: LeagueState, playerId: string): number;
  totalCastCount(state: LeagueState): number;
  addPlayer(state: LeagueState, name: string): Player;
  updatePlayer(state: LeagueState, id: string, field: string, value: unknown): void;
  removePlayer(state: LeagueState, id: string): void;
  disablePlayer(state: LeagueState, playerId: string, disabledFromUserId?: string): Player | null;
  reclaimPlayer(state: LeagueState, playerId: string): Player | null;
  activatePlayer(state: LeagueState, playerId: string, castawayIds: string[]): Player | null;
  addTribe(state: LeagueState, name: string, color: string): Tribe;
  updateTribe(state: LeagueState, id: string, field: string, value: unknown): void;
  removeTribe(state: LeagueState, id: string): void;
  addCastaway(state: LeagueState, name: string): Castaway;
  updateCastaway(state: LeagueState, id: string, field: string, value: unknown): void;
  removeCastaway(state: LeagueState, id: string): void;
  updateSettings(state: LeagueState, field: string, value: unknown): void;
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
  startReplenish(state: LeagueState): boolean;
  currentReplenishTurn(state: LeagueState): ReplenishTurn | null;
  replenishAssign(state: LeagueState, castawayId: string): void;
  cancelReplenish(state: LeagueState): void;
  startTrade(state: LeagueState): void;
  tradeSwap(state: LeagueState, dropId: string, addId: string): void;
  tradeSkip(state: LeagueState): void;
  cancelTrade(state: LeagueState): void;
  setFinalePick(state: LeagueState, playerId: string, idx: number, value: string | null): void;
  setFinaleWinnerPick(state: LeagueState, playerId: string, value: string | null): void;
  setActualTop3(state: LeagueState, idx: number, value: string | null): void;
  setActualWinner(state: LeagueState, value: string | null): void;
};

export default StateLogic;
