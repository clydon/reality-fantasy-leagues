// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe, Bet, Episode, ReplenishTurn, PickEmPick, ScoringEvent, EpisodeProposalPayload } from "./types";

export interface ActiveRosterEventDef {
  id: string;
  label: string;
  defaultPoints: number;
}

/** One question in guided first-time setup, in the order it should be asked. */
export interface SetupStep {
  id: "name" | "show" | "season" | "type" | "ownership";
  label: string;
  done: boolean;
  /** Currently-selected answer, for rendering the checklist as a summary. Null when unanswered. */
  value: string | null;
  /** True for the steps that arrive pre-filled with a working default rather than a real choice. */
  defaulted?: boolean;
  /** Absent unless the step can drop out for a league type it's meaningless for. */
  applies?: boolean;
}

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
  /** Active Roster: per-episode lineups + a scoring-event log (state-logic.js's ActiveRosterLogic). */
  hasActiveRoster: boolean;
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
    /**
     * Resolves a name from the wiki to a castaway in this league, tolerating the first-name-only
     * form the episode guide and vote grid use. Reports ambiguity instead of picking one.
     */
    findCastawayByName(
      state: LeagueState,
      name: string
    ): { castaway?: Castaway; ambiguous?: string[] };
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
  /** Guided first-time setup: which of the five basics are answered, and in what order to offer them. */
  SetupLogic: {
    steps(state: LeagueState, leagueName: string | null): SetupStep[];
    isComplete(state: LeagueState): boolean;
    basicsAnswered(state: LeagueState, leagueName: string | null): boolean;
    nextStep(state: LeagueState, leagueName: string | null): string | null;
    isStepVisible(state: LeagueState, leagueName: string | null, stepId: string): boolean;
    complete(state: LeagueState): void;
  };
  getLeagueType(state: LeagueState): LeagueType;
  // Capability AND commissioner choice, together -- see their comment in state-logic.js. Anything
  // that shows or starts a mid-season round should ask through these, not read either half alone.
  replenishAvailable(state: LeagueState): boolean;
  tradeAvailable(state: LeagueState): boolean;
  finalePredictionsAvailable(state: LeagueState): boolean;
  /** Castaways per player in the draft. Derived from activeSlots+benchSlots for Active Roster. */
  rosterSize(state: LeagueState): number;
  ACTIVE_ROSTER_EVENTS: ActiveRosterEventDef[];
  ActiveRosterLogic: {
    pointsFor(state: LeagueState, type: string): number;
    activeSlots(state: LeagueState): number;
    benchSlots(state: LeagueState): number;
    lineupFor(state: LeagueState, epId: string, playerId: string): string[];
    isLineupLocked(state: LeagueState, epId: string): boolean;
    validateLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): string | null;
    setLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): boolean;
    lockLineups(state: LeagueState, epId: string): boolean;
    unlockLineups(state: LeagueState, epId: string): boolean;
    carryForwardLineups(state: LeagueState, epId: string): boolean;
    addEvent(state: LeagueState, epId: string, type: string, castawayId: string): ScoringEvent | null;
    removeEvent(state: LeagueState, epId: string, eventId: string): void;
  };
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
  applyCastImport(
    state: LeagueState,
    proposal: { tribes?: { name: string; color?: string }[]; castaways?: { name: string; tribeName?: string | null; photoUrl?: string | null }[] }
  ): { tribes: string[]; castaways: string[]; skipped: string[] };
  /**
   * Apply halves of the connector's phase-2 proposals. Both additive and idempotent: they create any
   * missing episodes by number, skip anything already recorded, and report unresolved names rather
   * than guessing at them.
   */
  applyEliminationsImport(
    state: LeagueState,
    proposal: EpisodeProposalPayload
  ): {
    episodesCreated: number[];
    eliminations: { episode: number; name: string; method: string }[];
    skipped: string[];
    unresolved: string[];
  };
  applyScoringEventsImport(
    state: LeagueState,
    proposal: EpisodeProposalPayload
  ): {
    episodesCreated: number[];
    events: { episode: number; name: string; type: string }[];
    skipped: string[];
    unresolved: string[];
  };
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
  addExiled(state: LeagueState, epId: string, castawayId: string): void;
  removeExiled(state: LeagueState, epId: string, castawayId: string): void;
  /** Finds the episode with this number, creating it (and any gap before it) if missing. */
  ensureEpisodeNumber(state: LeagueState, number: number, postMerge: boolean, created?: number[]): Episode;
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
  activeRosterLineupFor(state: LeagueState, epId: string, playerId: string): string[];
  setActiveRosterLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): boolean;
  lockActiveRosterLineups(state: LeagueState, epId: string): boolean;
  unlockActiveRosterLineups(state: LeagueState, epId: string): boolean;
  addScoringEvent(state: LeagueState, epId: string, type: string, castawayId: string): ScoringEvent | null;
  removeScoringEvent(state: LeagueState, epId: string, eventId: string): void;
  pickEmPickFor(state: LeagueState, epId: string, playerId: string): PickEmPick | null;
  previousPickEmPickFor(state: LeagueState, epId: string, playerId: string): PickEmPick | null;
  setPickEmPick(state: LeagueState, epId: string, playerId: string, castawayId: string): void;
  removePickEmPick(state: LeagueState, epId: string, playerId: string): void;
};

export default StateLogic;
