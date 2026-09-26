// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, Castaway, Tribe, Bet, Episode, ReplenishTurn, PickEmPick, ScoringEvent, EpisodeProposalPayload } from "./types";
import type { GameFormat } from "./formats/index.js";

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
  /**
   * Catch-up mode: how much of a season this league may see. `revealedThrough` is null in live
   * mode (no gate, every league's behaviour before this existed) or the highest episode number the
   * commissioner has revealed. See RevealLogic's comment in state-logic.js for why this is a
   * derived gate rather than per-episode snapshots of the wiki payload.
   */
  RevealLogic: {
    revealedThrough(state: LeagueState): number | null;
    isCatchingUp(state: LeagueState): boolean;
    nextEpisode(state: LeagueState): number | null;
    isRevealed(state: LeagueState, episodeNumber: number): boolean;
    /** Advances the pointer by one and returns it; null (and a no-op) in live mode. */
    revealNext(state: LeagueState): number | null;
    normalize(value: unknown): number | null;
  };
  getLeagueType(state: LeagueState): LeagueType;
  // Capability AND commissioner choice, together -- see their comment in state-logic.js. Anything
  // that shows or starts a mid-season round should ask through these, not read either half alone.
  replenishAvailable(state: LeagueState): boolean;
  tradeAvailable(state: LeagueState): boolean;
  finalePredictionsAvailable(state: LeagueState): boolean;
  /** Castaways per player in the draft. Derived from activeSlots+benchSlots for Active Roster. */
  rosterSize(state: LeagueState): number;
  /** The league's show format (exit methods, scoring events, merge, winner). See formats/index.js. */
  formatOf(state: LeagueState): GameFormat;
  /** The episode this league starts playing at (settings.startEpisode, default 1). */
  startEpisode(state: LeagueState): number;
  /** Whether an episode counts for this league -- at or after its start episode. */
  inPlay(state: LeagueState, episodeNumber: number): boolean;
  ActiveRosterLogic: {
    pointsFor(state: LeagueState, type: string): number;
    activeSlots(state: LeagueState): number;
    benchSlots(state: LeagueState): number;
    /** This episode's lineup, or (if never set for it) the most recent earlier one, still-owned and capped. */
    lineupFor(state: LeagueState, epId: string, playerId: string): string[];
    /** True when lineupFor is carrying an earlier episode's lineup rather than one set for this episode. */
    lineupIsCarried(state: LeagueState, epId: string, playerId: string): boolean;
    isLineupLocked(state: LeagueState, epId: string): boolean;
    validateLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): string | null;
    setLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): boolean;
    lockLineups(state: LeagueState, epId: string): boolean;
    unlockLineups(state: LeagueState, epId: string): boolean;
    carryForwardLineups(state: LeagueState, epId: string): boolean;
    addEvent(state: LeagueState, epId: string, type: string, castawayId: string): ScoringEvent | null;
    removeEvent(state: LeagueState, epId: string, eventId: string): void;
    /** Recorded events plus the ones the format implies from exits and roles (`implied: true`). */
    episodeEvents(state: LeagueState, ep: Episode): ScoringEvent[];
  };
  /** The role someone holds as of an episode (or now); null for a format without roles. */
  roleOf(state: LeagueState, castawayId: string, throughEpisode?: number): string | null;
  addRole(state: LeagueState, epId: string, castawayId: string, role: string): boolean;
  removeRole(state: LeagueState, epId: string, castawayId: string): void;
  /** Records that someone changed tribe/team this episode (null/"" = no group now). See GroupLogic. */
  addGroupChange(state: LeagueState, epId: string, castawayId: string, groupName: string | null): boolean;
  removeGroupChange(state: LeagueState, epId: string, castawayId: string): void;
  GroupLogic: {
    /** Every recorded tribe/team change for one castaway, in episode order. */
    changesFor(state: LeagueState, castawayId: string): { castawayId: string; tribeId: string | null }[];
  };
  getPlayer(state: LeagueState, id: string): Player | undefined;
  getCastaway(state: LeagueState, id: string): Castaway | undefined;
  computeScores(state: LeagueState): ScoreRow[];
  currentDraftTurn(state: LeagueState): DraftTurn | null;
  isDraftStarted(state: LeagueState): boolean;
  defaultState(): LeagueState;
  /** The format's recommended point value per event, for the league's (or the given) ownership mode. */
  defaultEventPoints(state: LeagueState, mode?: "exclusive" | "shared"): Record<string, number>;
  /** Rounds a points value to hundredths (decimal point values sum with float noise). */
  roundPoints(n: number): number;
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
  /**
   * Links castaways ALREADY in the league to their starting tribes, creating any tribe that's
   * missing. What applyCastImport can't do (it skips anyone already present), and what catch-up
   * mode needs when a league finally reveals the episode that shows the division.
   */
  applyCastTribes(state: LeagueState, proposal: { castaways: { name: string; tribeName?: string | null }[] }): {
    tribes: string[];
    linked: string[];
    unchanged: string[];
  };
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
  addBetToUpcoming(state: LeagueState, label: string, points: number, createdByPlayerId: string | null): Bet;
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
  /** The always-an-episode-to-play-next rule; true if it changed anything. See EpisodeLogic. */
  ensureNextEpisode(state: LeagueState): boolean;
  /**
   * The league has started playing (draft begun, Pick'em picks or Active Roster lineups made) -- the
   * League Settings lock on show, type and ownership. Episode results from the season don't count.
   */
  seasonUnderway(state: LeagueState): boolean;
  episodeHasResults(ep: Episode): boolean;
  nextPlacementOrder(state: LeagueState): number;
  updateBet(state: LeagueState, epId: string, betId: string, field: string, value: unknown): void;
  removeBetPrediction(state: LeagueState, epId: string, betId: string, predId: string): void;
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
  /**
   * Who a player may pick for an episode under Pick'em's rules (no one twice until everyone still in
   * the game has been picked once; never the same person back to back). `blocked` says why the rest
   * can't be picked, and which episode they were picked in.
   */
  pickEmEligibility(
    state: LeagueState,
    epId: string,
    playerId: string
  ): { available: string[]; blocked: Record<string, { episode: number; reason: "cycle" | "backToBack" }> };
  /** A player's Pick'em season with streaks: a row per episode that happened, plus any pending pick. */
  pickEmHistory(
    state: LeagueState,
    playerId: string
  ): {
    rows: { episode: number; postMerge: boolean; castawayId: string | null; correct: boolean | null; points: number; streak: number }[];
    total: number;
    longestStreak: number;
    currentStreak: number;
  };
  /** The episode picks are being made for (the next to reveal when catching up, else the latest). */
  pickEmUpcomingEpisode(state: LeagueState): Episode | null;
  /**
   * The episode "this week's choice" is for -- shared by Eliminator Pool's pick, Active Roster's
   * lineup grid, and Overview's side bets (the next to reveal when catching up, else the latest, never
   * before the league's start episode).
   */
  currentEpisode(state: LeagueState): Episode | null;
  setPickEmPick(state: LeagueState, epId: string, playerId: string, castawayId: string): void;
  removePickEmPick(state: LeagueState, epId: string, playerId: string): void;
};

export default StateLogic;
