// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, LateJoin, Castaway, Tribe, Bet, Episode, PickEmPick, ScoringEvent, EpisodeProposalPayload, MidSeasonLogEntry, WaiverPeriod, WaiverRun, WaiverClaim, WaiverPair, WaiverWindows, ReplaceRule, WaiverFeel, WaiverRecommendation } from "./types";
import type { GameFormat, SeasonChange, SeasonChangeSkip } from "./formats/index.js";
import type { GameSpec, SpecContext, SpecInput, SpecProblem } from "./game-spec/index.js";

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
  /** Weekly Calls: scored from each person's calls (Call it, src/lib/server/calls.ts), which aren't in the state. */
  hasCalls?: boolean;
  /** Weekly Bingo: scored from each person's bingo lines (src/lib/server/bingo.ts), which aren't in the state either. */
  hasBingo?: boolean;
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
  /**
   * Mid-season waivers (docs/PLAN-midseason-waivers.md, docs/PLAN-waivers-v2.md). Claims never enter
   * state: process() takes them. A claim is ranked "add X, drop Y" pairs; the pre-v2 shape
   * { pickupIds, dropId, addIds } is still accepted for one release.
   */
  WaiverLogic: {
    /** The league type has mid-season moves at all (not Eliminator Pool or shared Classic). */
    supported(state: LeagueState): boolean;
    normalizeWindows(state: LeagueState, w: Partial<WaiverWindows> | null | undefined): WaiverWindows;
    /** The league's waiver settings, read from the v2 keys or (not yet backfilled) the pre-v2 switches. */
    config(state: LeagueState): { replaceRule: ReplaceRule; waiverWindows: WaiverWindows; waiverFeel: WaiverFeel; autoFill: boolean };
    replaceRule(state: LeagueState): ReplaceRule;
    windows(state: LeagueState): WaiverWindows;
    autoFillOn(state: LeagueState): boolean;
    /** Replacements run after every episode (always / whenShort). */
    weekly(state: LeagueState): boolean;
    enabled(state: LeagueState): boolean;
    processHours(state: LeagueState): number;
    freeAgencyOn(state: LeagueState): boolean;
    rolling(state: LeagueState): boolean;
    /** whenShort's N. */
    shortAt(state: LeagueState): number;
    backfill(state: LeagueState): void;
    mirrorLegacy(state: LeagueState): void;
    /** True when `field` was a waiver setting (and it's been applied). */
    updateSetting(state: LeagueState, field: string, value: unknown): boolean;
    /** Pure: good settings for a league's shape (null: no waivers for it). */
    recommend(input: {
      C: number;
      T: number;
      R: number;
      S?: number;
      E?: number;
      start?: number;
      shared?: boolean;
      type: string;
      feel?: WaiverFeel;
    }): WaiverRecommendation | null;
    /** Teams the suggestion is for: the rotation, or before the draft the count given at creation. */
    teamsFor(state: LeagueState, opts?: { teams?: number }): number;
    recommendFor(state: LeagueState, feel?: WaiverFeel | null, opts?: { episodes?: number; castSize?: number; teams?: number }): WaiverRecommendation | null;
    applyRecommendation(state: LeagueState, feel?: WaiverFeel | null, opts?: { episodes?: number; castSize?: number; teams?: number }): boolean;
    /** applyRecommendation, with why it was refused ([] when it's written). */
    writeRecommendation(state: LeagueState, feel?: WaiverFeel | null, opts?: { episodes?: number; castSize?: number; teams?: number }): SpecProblem[];
    /** After the draft starts: re-fits a league still on its creation-time suggestion. */
    refit(state: LeagueState): boolean;
    isRecommended(state: LeagueState, opts?: { episodes?: number; castSize?: number; teams?: number }): boolean;
    periods(state: LeagueState): WaiverPeriod[];
    /** The week still running (open or in free agency), or null. */
    current(state: LeagueState): WaiverPeriod | null;
    /** Player ids in waivers: active seats, not late joiners still catching up. */
    rotation(state: LeagueState): string[];
    isWindowEpisode(state: LeagueState, episode: number): boolean;
    /** A window with swaps opens after this episode (pre-v2's add/drop week). */
    isAddDropEpisode(state: LeagueState, episode: number): boolean;
    nextWindowEpisode(state: LeagueState, after: number, total?: number): number | null;
    isWindow(period: WaiverPeriod | null | undefined): boolean;
    swapsAllowed(period: WaiverPeriod | null | undefined): number;
    swapsMade(state: LeagueState, period: WaiverPeriod, playerId: string): number;
    /** Whether replacements happen in this week (a window's own say, else the rule). */
    windowReplaces(state: LeagueState, period: WaiverPeriod | null | undefined): boolean;
    swapsLeft(state: LeagueState, period: WaiverPeriod | null | undefined, playerId: string): number;
    addDropUsed(state: LeagueState, period: WaiverPeriod, playerId: string): boolean;
    /** How many this player may replace in `period`; lossIds: the oldest that many; outIds: every loss a claim may name. */
    replacementsOwed(state: LeagueState, playerId: string, period: WaiverPeriod | null | undefined): { count: number; lossIds: string[]; outIds: string[] };
    /** replacementsOwed in the week running now (pre-v2 name). */
    pickupsOwed(state: LeagueState, playerId: string): { count: number; lossIds: string[]; outIds: string[] };
    maxPickupClaims(owed: number): number;
    schedule(state: LeagueState, period: WaiverPeriod): { processAt: string; closesAt: string | null };
    refresh(state: LeagueState): void;
    /** The step waiting at `now` (ms). */
    due(state: LeagueState, now: number): "open" | "process" | "close" | "cancel" | null;
    open(state: LeagueState, now: number, opts?: { window?: boolean; swaps?: number; replace?: boolean; by?: "commissioner" }): WaiverPeriod;
    cancel(state: LeagueState): WaiverPeriod | null;
    setClaimsIn(state: LeagueState, period: WaiverPeriod, playerIds: string[]): void;
    /** The commissioner's Open a waiver window: `swaps` each, or null to turn it off; `replace` this window's own say on replacements. */
    openWindow(state: LeagueState, swaps: number | null, now?: number, opts?: { replace?: boolean }): { period: WaiverPeriod; closed?: boolean; error?: undefined } | { error: string; period?: undefined };
    pairsOf(state: LeagueState, period: WaiverPeriod | null, playerId: string, input: unknown): { pairs: WaiverPair[]; legacy: boolean };
    pairProblem(
      state: LeagueState,
      period: WaiverPeriod,
      playerId: string,
      pair: WaiverPair,
      owed: { count: number; outIds: string[] },
      swapsLeft: number
    ): string | null;
    claimOf(state: LeagueState, pairs: WaiverPair[]): WaiverClaim;
    checkClaim(state: LeagueState, period: WaiverPeriod | null, playerId: string, input: unknown): { claim: WaiverClaim; error?: undefined } | { error: string; claim?: undefined };
    /** Pairs in processing order: each replacement's group (oldest loss first), then the swaps. */
    groupPairs(state: LeagueState, period: WaiverPeriod | null, playerId: string, pairs: WaiverPair[]): WaiverPair[];
    /** One spot's ranked adds set (empty clears it), the rest of the claim kept. */
    setSpot(state: LeagueState, period: WaiverPeriod | null, playerId: string, pairs: WaiverPair[], dropId: string, addIds: string[]): WaiverPair[];
    isEmptyClaim(claim: Partial<WaiverClaim> | null | undefined): boolean;
    trimClaim(state: LeagueState, period: WaiverPeriod, playerId: string, claim: unknown): { claim: WaiverClaim; removed: number };
    process(state: LeagueState, claimsByPlayer: Record<string, Partial<WaiverClaim>>, opts?: { now?: number; by?: "schedule" | "commissioner" }): WaiverRun | null;
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
    /** Lock it down (step 15 part 4): competitive mode, nobody new joins, the rules frozen for the season. */
    lockedDown(state: LeagueState): boolean;
    /** Castaways can be on several teams (or there are no teams): a new player takes nothing and may catch up. */
    sharedJoin(state: LeagueState): boolean;
    /** Who can join (step 9): settings.joinMode, else locked when late joining is off, else the recommended one. */
    joinMode(state: LeagueState): "open" | "ask" | "locked";
    recommendedJoinMode(state: LeagueState): "open" | "ask";
    startChoices(state: LeagueState): number[];
    /** Castaway ids still in the game before episode `start` (`freeAgents`: only those nobody in the league owns). */
    draftPool(state: LeagueState, start: number, freeAgents?: boolean): string[];
    teamSize(state: LeagueState): number;
    /** A reason on refusal, else null. */
    begin(state: LeagueState, playerId: string, start: number, castawayIds: string[], opts?: { freeAgents?: boolean }): string | null;
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
  /** The game the league plays, as data (its game spec: settings.game when it carries one, else read from its settings). Read only. */
  gameOf(state: LeagueState): Readonly<GameSpec>;
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
  /** The episode this league starts playing at (the spec's span.from: settings.startEpisode, default 1). */
  startEpisode(state: LeagueState): number;
  /** The last episode a game over a span plays (settings.endEpisode), or null: to the season's end. */
  endEpisode(state: LeagueState): number | null;
  /** Whether an episode counts for this league -- from its start episode through its end, if it has one. */
  inPlay(state: LeagueState, episodeNumber: number): boolean;
  /** The league as its span saw it: results after its last episode taken out (the state itself when there are none). */
  spanView(state: LeagueState): LeagueState;
  /** The game is over: its season is, or its span's last episode has results. */
  gameOver(state: LeagueState): boolean;
  /** Whether the episode has started airing (its server-stamped airsAt has passed). */
  hasAired(ep: Episode | null | undefined, now?: number): boolean;
  /** Whether its lineups and picks are closed: from its start, unless its lock says otherwise (lineupsLocked, openPastAir). */
  closedForPlay(ep: Episode | null | undefined, now?: number): boolean;
  /** Whether an exit method crowns the winner (never, for a format nobody wins, or a null method). */
  isWinnerExit(state: LeagueState, method: string | null | undefined): boolean;
  /** Whoever won the season, or null (not yet, or a format nobody wins). */
  seasonWinner(state: LeagueState): Castaway | null;
  /** The season is over: its winner crowned, or, in a format nobody wins, nobody left in it. */
  seasonEnded(state: LeagueState): boolean;
  ActiveRosterLogic: {
    pointsFor(state: LeagueState, type: string): number;
    /** One event's points: its type's, times its units (a count research reported). */
    eventPoints(state: LeagueState, ev: Pick<ScoringEvent, "type" | "units">): number;
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
    addEvent(state: LeagueState, epId: string, type: string, castawayId: string, units?: number | null): ScoringEvent | null;
    removeEvent(state: LeagueState, epId: string, eventId: string): void;
    setEventUnits(state: LeagueState, epId: string, eventId: string, units: number | null): boolean;
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
  /** A settings write; a game field goes through setGame. The problems it was refused for ([] when it's written). */
  updateSettings(state: LeagueState, field: string, value: unknown): SpecProblem[];
  /** A league's game written from a whole spec: checked as the league's own, today's fields written, its side effects. */
  setGame(state: LeagueState, spec: SpecInput | GameSpec, opts?: { ctx?: SpecContext | null }): SpecProblem[];
  /** A league carrying its spec (settings.game) carries what its fields play. */
  syncGame(state: LeagueState): void;
  /** A new bet on an episode this game plays; undefined for one outside its span (before its start, after its end). */
  addBet(state: LeagueState, epId: string, label: string, points: number, createdByPlayerId: string | null): Bet | undefined;
  /** A new bet on the episode about to be played (betTarget); undefined once the game is over. */
  addBetToUpcoming(state: LeagueState, label: string, points: number, createdByPlayerId: string | null): Bet | undefined;
  /** The episode a bet proposed now goes on (never before the game's start), or null once a span's last episode is past. */
  betTarget(state: LeagueState): number | null;
  removeBet(state: LeagueState, epId: string, betId: string): void;
  addBetPrediction(state: LeagueState, epId: string, betId: string, playerId: string, guess: string): void;
  setBetPredictionCorrect(state: LeagueState, epId: string, betId: string, predId: string, value: boolean | null): void;
  syncDraftOrder(state: LeagueState): void;
  freeAgents(state: LeagueState): Castaway[];
  reorderDraft(state: LeagueState, fromIndex: number, toIndex: number): void;
  moveDraftOrder(state: LeagueState, index: number, delta: number): void;
  /** `by`: the account picking for whoever's on the clock; `auto`: the pick timer ran out (from their queue). */
  draftToCurrentTurn(state: LeagueState, castawayId: string, opts?: { by?: string; auto?: boolean }): void;
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
  /** Results in stages: 'early' (who went home only), 'final' (everything), null (nothing in yet). See EpisodeLogic. */
  resultsStage(ep: Episode | null | undefined): "early" | "final" | null;
  /** Marks an episode's results early, or final (the mark comes off). False for no such episode. */
  setResultsStage(state: LeagueState, epId: string, stage: "early" | "final"): boolean;
  /** Nobody went home in this episode (the season sync's shared fact), or that's taken back. False for no such episode. */
  setNoExit(state: LeagueState, epId: string, on: boolean): boolean;
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
  addScoringEvent(state: LeagueState, epId: string, type: string, castawayId: string, units?: number | null): ScoringEvent | null;
  setScoringEventUnits(state: LeagueState, epId: string, eventId: string, units: number | null): boolean;
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
  /** A Pool episode is decided once someone went home in it, or it's known nobody did (step 6c); a pool that survives by
   *  scoring (`state.settings.poolSurvive` 'scores', a sport: step 10 part 2b) once its scores are in. */
  pickEmDecided(ep: Episode | null | undefined, state?: LeagueState): boolean;
  /**
   * The episode "this week's choice" is for -- shared by Eliminator Pool's pick, Active Roster's
   * lineup grid, and Overview's side bets (the next to reveal when catching up, else the latest, never
   * before the league's start episode).
   */
  currentEpisode(state: LeagueState): Episode | null;
  setPickEmPick(state: LeagueState, epId: string, playerId: string, castawayId: string): void;
  removePickEmPick(state: LeagueState, epId: string, playerId: string): void;
  /** Whether this Survival Pool takes a weekly Who goes home? call (settings.calls): the person's Call it (calls.ts). */
  pickEmCallsOn(state: LeagueState): boolean;
};

export default StateLogic;
