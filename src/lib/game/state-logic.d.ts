// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, LateJoin, Castaway, Tribe, Bet, Episode, PickEmPick, ScoringEvent, EpisodeProposalPayload, MidSeasonLogEntry, WaiverPeriod, WaiverRun, WaiverClaim } from "./types";
import type { GameFormat, SeasonChange, SeasonChangeSkip } from "./formats/index.js";

/** One question in guided first-time setup, in the order it should be asked. */
/** A season_cast row as the cast-linking functions read it. */
export interface SeasonCastRef {
  id: string;
  name: string;
  tribeName?: string | null;
  photoUrl?: string | null;
}

export interface SeasonCastLinkPlan {
  links: { seasonCastId: string; seasonName: string; castawayId: string; castawayName: string; how: "id" | "exact" | "forgiving" }[];
  /** Rows no castaway matched. */
  unmatched: { seasonCastId: string; seasonName: string }[];
  /** Rows that matched more than one castaway, or reached for one another row also reached for. */
  ambiguous: { seasonCastId: string; seasonName: string; how: "exact" | "forgiving"; candidates: string[] }[];
  /** Castaways no row claimed. */
  unlinked: { castawayId: string; castawayName: string }[];
}

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
    /**
     * Resolves a season's spelling to this league's castaway through the season cast link first
     * (castaway.seasonCastId), falling back to findCastawayByName.
     */
    findSeasonCastaway(
      state: LeagueState,
      name: string,
      seasonCast: { id: string; name: string }[] | null | undefined
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
  /** A commissioner's say over season rule changes (docs/PLAN-season-rule-changes.md). */
  RuleChangeLogic: {
    offered(state: LeagueState): SeasonChange[];
    adopted(state: LeagueState): SeasonChange[];
    declined(state: LeagueState): { id: string; version: number }[];
    /** Offered changes not adopted or declined at their current version. */
    pending(state: LeagueState): SeasonChange[];
    adoptedStatus(state: LeagueState): { change: SeasonChange; status: "current" | "updated" | "withdrawn" }[];
    /** What adopting it would leave out against this league's rules. */
    fit(state: LeagueState, change: SeasonChange): SeasonChangeSkip[];
    suggestedPoints(state: LeagueState, ev: { defaultPoints: number | { exclusive: number; shared: number } }): number;
    adopt(state: LeagueState, id: string, points?: Record<string, number> | null): { change: SeasonChange; skipped: SeasonChangeSkip[] } | null;
    decline(state: LeagueState, id: string): boolean;
    /** The event ids it took back, or null if it wasn't adopted. */
    remove(state: LeagueState, id: string): string[] | null;
  };
  /** Classic scoring: 1 point per castaway, plus 1 for every elimination they outlast. */
  EliminationOrderScoringStrategy: {
    castawayPoints(state: LeagueState, c: Castaway): number;
    stillInPoints(state: LeagueState): number;
    compute(state: LeagueState): ScoreRow[];
  };
  /** Mid-season waivers (docs/PLAN-midseason-waivers.md). Claims never enter state: process() takes them. */
  WaiverLogic: {
    enabled(state: LeagueState): boolean;
    processHours(state: LeagueState): number;
    freeAgencyOn(state: LeagueState): boolean;
    periods(state: LeagueState): WaiverPeriod[];
    /** The week still running (open or in free agency), or null. */
    current(state: LeagueState): WaiverPeriod | null;
    /** Player ids in waivers: active seats, not late joiners still catching up. */
    rotation(state: LeagueState): string[];
    isAddDropEpisode(state: LeagueState, episode: number): boolean;
    pickupsOwed(state: LeagueState, playerId: string): { count: number; lossIds: string[] };
    maxPickupClaims(owed: number): number;
    addDropUsed(state: LeagueState, period: WaiverPeriod, playerId: string): boolean;
    schedule(state: LeagueState, period: WaiverPeriod): { processAt: string; closesAt: string | null };
    refresh(state: LeagueState): void;
    /** The step waiting at `now` (ms). */
    due(state: LeagueState, now: number): "open" | "process" | "close" | "cancel" | null;
    open(state: LeagueState, now: number): WaiverPeriod;
    cancel(state: LeagueState): WaiverPeriod | null;
    setClaimsIn(state: LeagueState, period: WaiverPeriod, playerIds: string[]): void;
    checkClaim(state: LeagueState, period: WaiverPeriod | null, playerId: string, input: unknown): { claim: WaiverClaim; error?: undefined } | { error: string; claim?: undefined };
    isEmptyClaim(claim: WaiverClaim | null | undefined): boolean;
    process(state: LeagueState, claimsByPlayer: Record<string, WaiverClaim>, opts?: { now?: number; by?: "schedule" | "commissioner" }): WaiverRun | null;
    /** A reason on refusal, else null. */
    freeAgencyMove(state: LeagueState, playerId: string, addId: string, dropId: string | null | undefined, now?: number): string | null;
    close(state: LeagueState, now?: number): WaiverPeriod | null;
    castawayPoints(state: LeagueState, castawayId: string): number;
    /** A reason on refusal, else null. */
    undo(state: LeagueState): string | null;
    /** Blanks what a viewer's copy mustn't show from episodes after their mark (mutates the copy). */
    redact(state: LeagueState, seenThrough: number | null | undefined): void;
  };
  /** One viewer's held-back results: the league as of the last episode they've revealed. */
  SpoilerLogic: {
    hiddenEpisodes(state: LeagueState, seenThrough: number | null | undefined): Episode[];
    latestWithResults(state: LeagueState): number;
    /** Chat's spoiler window: the first unrevealed episode that has started airing, and when. */
    chatWindow(state: LeagueState, seenThrough: number | null | undefined, now?: number): { episode: number; since: string } | null;
    /** A copy with later episodes' results taken out (or `state` itself when nothing is hidden). */
    viewThrough(state: LeagueState, seenThrough: number | null | undefined): LeagueState;
  };
  /** Late joiners (docs/PLAN-late-joiners.md): invisible to the league, playing from their own start. */
  GhostLogic: {
    isGhost(p: Player | null | undefined): boolean;
    lateJoinOf(state: LeagueState, playerId: string | null | undefined): LateJoin | null;
    isCatchingUp(state: LeagueState, playerId: string | null | undefined): boolean;
    /** Still has to choose a start episode (and draft) before playing. */
    needsStart(state: LeagueState, playerId: string | null | undefined): boolean;
    startFor(state: LeagueState, playerId: string): number;
    isUnderway(state: LeagueState): boolean;
    /** Late joining is on unless the commissioner switched it off. */
    allowed(state: LeagueState): boolean;
    startChoices(state: LeagueState): number[];
    /** Castaway ids still in the game before episode `start`. */
    draftPool(state: LeagueState, start: number): string[];
    teamSize(state: LeagueState): number;
    /** A reason on refusal, else null. */
    begin(state: LeagueState, playerId: string, start: number, castawayIds: string[]): string | null;
    markCaughtUp(state: LeagueState, playerId: string, seenThrough: number): void;
    convert(state: LeagueState, playerId: string): boolean;
    /** The league as one viewer may see it; `full` keeps their week's results for the reveal. */
    viewFor(state: LeagueState, viewerId: string | null, seenThrough: number | null | undefined, opts?: { full?: boolean }): LeagueState;
    ghosts(state: LeagueState): Player[];
    /** Runs a late joiner's own move against their view; a reason on refusal, else null. */
    applyAs(state: LeagueState, playerId: string, seenThrough: number, epId: string, fn: (view: LeagueState) => unknown): string | null;
  };
  RevealLogic: {
    revealedThrough(state: LeagueState): number | null;
    isCatchingUp(state: LeagueState): boolean;
    /** True once revealed results have crowned a winner -- nothing left to reveal. */
    isComplete(state: LeagueState): boolean;
    nextEpisode(state: LeagueState): number | null;
    isRevealed(state: LeagueState, episodeNumber: number): boolean;
    /** Advances the pointer by one and returns it; null (and a no-op) in live mode or once complete. */
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
  /** The most a prediction can be worth (1 to this, whole points). */
  MAX_BET_POINTS: number;
  /** Castaways the player originally drafted, unaffected by later replenish/trade moves. */
  originalDraftPicks(state: LeagueState, playerId: string): Castaway[];
  /** The league's show format (exit methods, scoring events, merge, winner). See formats/index.js. */
  formatOf(state: LeagueState): GameFormat;
  /** The episode this league starts playing at (settings.startEpisode, default 1). */
  startEpisode(state: LeagueState): number;
  /** Whether an episode counts for this league -- at or after its start episode. */
  inPlay(state: LeagueState, episodeNumber: number): boolean;
  /** Whether the episode has started airing (its server-stamped airsAt has passed). */
  hasAired(ep: Episode | null | undefined, now?: number): boolean;
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
  getTribe(state: LeagueState, id: string): Tribe | undefined;
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
  addPlayer(state: LeagueState, name: string, opts?: { automated?: boolean }): Player;
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
  applyCastTribes(state: LeagueState, proposal: { castaways: { id?: string; name: string; tribeName?: string | null }[] }): {
    tribes: string[];
    linked: string[];
    unchanged: string[];
  };
  /**
   * Records each matched castaway's starting secret role as a role fact at `episode` (default 1).
   * Run after applyCastImport. Additive: an existing role at that episode is left alone.
   */
  applyCastRoles(
    state: LeagueState,
    proposal: { castaways: { name: string; role: string }[] },
    episode?: number
  ): { recorded: string[]; unchanged: string[]; unresolved: string[] };
  applyCastImport(
    state: LeagueState,
    proposal: {
      tribes?: { name: string; color?: string }[];
      /** `id` is a season_cast row id: matched by castaway.seasonCastId first, and set on anyone created. */
      castaways?: { id?: string; name: string; tribeName?: string | null; photoUrl?: string | null }[];
    }
  ): { tribes: string[]; castaways: string[]; skipped: string[] };
  /**
   * Which league castaways are which season_cast rows (castaway.seasonCastId), without changing
   * anything: already linked ('id'), the same name ('exact'), and -- only with `forgiving` -- a
   * findCastawayByName match that agrees in both directions. Anything else is reported, never guessed.
   */
  planSeasonCastLinks(state: LeagueState, cast: SeasonCastRef[], opts?: { forgiving?: boolean }): SeasonCastLinkPlan;
  /**
   * Applies a season's cast to one league: link exact names, sync linked castaways, add who's missing
   * (except possible duplicates of an unlinked castaway -- `needsReview`), then starting tribes.
   */
  applySeasonCast(
    state: LeagueState,
    cast: SeasonCastRef[],
    opts?: { withTribes?: boolean }
  ): {
    tribes: string[];
    castaways: string[];
    skipped: string[];
    linked: string[];
    synced: { renamed: { from: string; to: string }[]; photos: string[]; retribed: { name: string; from: string; to: string }[]; conflicts: { from: string; to: string }[] };
    needsReview: string[];
    tribed: string[];
  };
  /** Whether anything in the league (an owner, a result, a pick, a lineup...) refers to this castaway. */
  castawayInUse(state: LeagueState, castawayId: string): boolean;
  /** Whether a league may see its season's starting tribes yet (season-cast.ts's tribesDue). */
  castTribesDue(state: LeagueState, tribesFromEpisode: number | null | undefined): boolean;
  /** Writes a plan's new links onto unlinked castaways; returns the names linked. */
  applySeasonCastLinks(state: LeagueState, plan: SeasonCastLinkPlan): string[];
  /**
   * Brings linked castaways in line with their season_cast row: name, photo, and (with `withTribes`)
   * the starting tribe. Never touches anyone unlinked.
   */
  syncSeasonCast(
    state: LeagueState,
    cast: SeasonCastRef[],
    opts?: { withTribes?: boolean }
  ): {
    renamed: { from: string; to: string }[];
    photos: string[];
    retribed: { name: string; from: string; to: string }[];
    conflicts: { from: string; to: string }[];
  };
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
  /** `juryVotes`: a finalist's jury votes received, when known. */
  addElimination(state: LeagueState, epId: string, castawayId: string, method: string, juryVotes?: number | null): void;
  /** Sets (or clears with null) a recorded elimination's jury votes; false if there's no such elimination. */
  setJuryVotes(state: LeagueState, epId: string, castawayId: string, juryVotes: number | null): boolean;
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
  /** Who this player may add in a pickup or add/drop: free agents (exclusive) or anyone still in the game not already theirs (shared). */
  availableFor(state: LeagueState, playerId: string): Castaway[];
  /** Active Roster: how many replenish picks this player is owed right now. */
  replenishNeed(state: LeagueState, playerId: string): number;
  MidSeasonLogic: {
    applyPickup(state: LeagueState, playerId: string, addId: string, lossId: string | null, extra?: Partial<MidSeasonLogEntry>): MidSeasonLogEntry;
    applyAddDrop(state: LeagueState, playerId: string, dropId: string, addId: string, extra?: Partial<MidSeasonLogEntry>): MidSeasonLogEntry;
    /** Undoes one logged move (several: newest first). */
    revert(state: LeagueState, tx: MidSeasonLogEntry): void;
    replenishAt(state: LeagueState): number;
    swapEvery(state: LeagueState): number;
    inGameCount(state: LeagueState, playerId: string): number;
    /** Nobody left in the game: no more pickups or add/drops. */
    seasonOver(state: LeagueState): boolean;
    priorityList(state: LeagueState): string[];
    order(state: LeagueState, playerIds: string[]): string[];
  };
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
