// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe, Bet, Episode, ReplenishTurn, PickEmPick } from "./types";

export interface LeagueType {
  id: string;
  name: string;
  description: string;
  supportsReplenish: boolean;
  supportsTrade: boolean;
  supportsFinalePredictions: boolean;
  // See LEAGUE_TYPES' own comment in state-logic.js: orthogonal to the three supports* flags
  // above, which are about mid-season mechanics on an EXISTING roster. These are about whether a
  // roster (draft, Draft tab, Board grid) exists at all, and whether this league type owes the
  // frontend a per-episode pick UI (Episode Card's "Your Pick" section).
  hasRoster: boolean;
  hasWeeklyPicks: boolean;
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
    ownersOf(state: LeagueState, castawayId: string): string[];
    ownedCastawayIds(state: LeagueState, playerId: string): string[];
    isOwnedBy(state: LeagueState, castawayId: string, playerId: string): boolean;
    setOwner(state: LeagueState, castawayId: string, playerId: string | null): void;
    addOwner(state: LeagueState, castawayId: string, playerId: string): void;
    removeOwner(state: LeagueState, castawayId: string, playerId: string): void;
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
  // Capability AND commissioner choice, together -- see their comment in state-logic.js. Anything
  // that shows or starts a mid-season round should ask through these, not read either half alone.
  replenishAvailable(state: LeagueState): boolean;
  tradeAvailable(state: LeagueState): boolean;
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
  // Blind draft (shared-ownership classic-draft). Note there is nothing here for reading the
  // submitted picks: those never enter league state -- the server reads them straight out of
  // blind_draft_picks (src/lib/server/blind-draft.ts). These are the state-side pieces only.
  BlindDraftLogic: {
    eligiblePlayers(state: LeagueState): Player[];
    isRevealed(state: LeagueState): boolean;
    lockedPlayerIds(state: LeagueState): string[];
    hasLocked(state: LeagueState, playerId: string): boolean;
    waitingOn(state: LeagueState): Player[];
    setLockedPlayerIds(state: LeagueState, playerIds: string[]): void;
    allLockedIn(state: LeagueState, lockedPlayerIds: string[]): boolean;
    validateSubmission(state: LeagueState, playerId: string, castawayIds: string[]): string | null;
    reveal(state: LeagueState, picksByPlayer: Record<string, string[]>, revealedAt?: string): boolean;
  };
  pickEmPickFor(state: LeagueState, epId: string, playerId: string): PickEmPick | null;
  previousPickEmPickFor(state: LeagueState, epId: string, playerId: string): PickEmPick | null;
  setPickEmPick(state: LeagueState, epId: string, playerId: string, castawayId: string): void;
  removePickEmPick(state: LeagueState, epId: string, playerId: string): void;
};

export default StateLogic;
