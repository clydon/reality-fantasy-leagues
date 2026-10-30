// Ambient typing for state-logic.js (forked from the live app -- see the provenance comment at
// that file's top), covering what this repo's components actually call. Not exhaustive — extend
// as more of the file gets used.
import type { LeagueState, ScoreRow, DraftTurn, Player, LateJoin, Castaway, Tribe, Bet, Episode, PickEmPick, ScoringEvent, EpisodeProposalPayload, MidSeasonLogEntry, WaiverPeriod, WaiverRun, WaiverClaim, WaiverPair, WaiverWindows, ReplaceRule, WaiverFeel, WaiverRecommendation, GroupSlotPick, FormatGroup, EpisodeFormatGroups } from "./types";
import type { GameFormat, SeasonChange, SeasonChangeSkip } from "./formats/index.js";
import type { GameSpec, SpecContext, SpecInput, SpecProblem, Question, AnswerFacts, Verdict, GroupSlots, PoolParts } from "./game-spec/index.js";

/** Step A10 part 1: what a player's group slot holds in an episode (GroupSlotLogic.standing). */
export interface GroupSlotStanding {
  pick: GroupSlotPick | null;
  /** The episode its latest pick was made for. */
  from: number | null;
  status: "held" | "void" | "dropped" | "waiting" | "empty";
  /** A held slot's people, the league's castaway ids, and how many the group has as research says (its mean's). */
  members: string[];
  size: number;
  /** Held though its lock or play wasn't sure (a game that follows the people). */
  unsure: boolean;
  why: string[];
  /** A dropped slot's: the episode its group ended at. */
  endedAt?: number;
}
export interface GroupSlotIndex {
  eps: Map<number, Episode>;
  exits: Map<string, number>;
}
export interface GroupSlotLine extends GroupSlotStanding {
  slot: number;
  points: number;
}

/** One pick's outcome on a decided episode (A10 part 2's flags only on a pool with them). */
/** Step A11 part 1: one scored episode of a draft's knockout walk: every player's total through it, and its parts as a score row
 *  has them. */
interface KnockoutEpisode {
  number: number;
  quiet: boolean;
  totals: Map<string, number>;
  rows: Map<string, { locked: number; banked: number; bonus: number; finale: number }>;
}

interface PickEmOutcome {
  correct: boolean | null;
  points: number;
  forgiven?: boolean;
  lifeLost?: boolean;
}
/** A row of a pool's season (PickEmLogic.history): one episode, its pick (and a second pick), the streak after it; with lives,
 *  the lives left, `boughtBack` (its cost) or `out` (for good) when it emptied them. Step A11 part 2: `skipped`, a night a pick
 *  that never repeats had nobody left to pick, skipped by its fallback (nothing counts); `spared`, the night everyone left went
 *  out, taken back (allOut 'back'). */
export interface PickEmHistoryRow extends PickEmOutcome {
  episode: number;
  postMerge: boolean;
  castawayId: string | null;
  streak: number;
  second?: PickEmOutcome & { castawayId: string; void?: boolean };
  lives?: number;
  boughtBack?: number;
  out?: boolean;
  skipped?: boolean;
  spared?: boolean;
}
/** A player's pool season (PickEmLogic.history, pickEmHistory): its rows and streaks; a pool's parts (A10 part 2) add their
 *  fields only when it has them; A11 part 2's `shared`, out the night everyone left went out, sharing the win. */
export interface PickEmHistory {
  rows: PickEmHistoryRow[];
  total: number;
  longestStreak: number;
  currentStreak: number;
  lives?: number | null;
  out?: number | null;
  mulligans?: number;
  buybacks?: number;
  cost?: number;
  shared?: boolean;
}

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
  /** Best ball (step A9 part 2): Weekly Lineup's type with no lineups, each episode a team's best n counting. */
  hasBestBall?: boolean;
  /** Weekly Calls: scored from each person's calls (Call it, src/lib/server/calls.ts), which aren't in the state. */
  hasCalls?: boolean;
  /** A game of questions (step A4): scored by its own answers (game_answers, answers.ts), not the state. */
  hasQuestions?: boolean;
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
  /** A Survival Pool's scoring; a pool with lives ranked by last one standing (step A10 part 2) by standingKey, compared from
   *  its first number on (compareKeys: a's minus b's at the first that differs). */
  PickEmScoringStrategy: {
    compute(state: LeagueState): ScoreRow[];
    standingKey(row: ScoreRow): number[];
    compareKeys(a: number[], b: number[]): number;
  };
  /** The order a game's table ranks a score row in (compareKeys, higher first): a pool's standing or streak, a stock market's
   *  worth (step A10 part 3c), a draft that knocks players out by standing (A11 part 1), else the points. */
  rankKey(state: LeagueState, row: Pick<ScoreRow, "total"> & Partial<ScoreRow>): number[];
  /** Step A10 part 2: a pool's lives, buyback, mulligans and second pick. A11 part 2: a pick that never repeats, and last one
   *  standing's end (one left ending it, the night everyone left goes out), walked everyone together (walk: each one's history,
   *  and the episode it ended at). */
  PickEmLogic: {
    parts(state: LeagueState): PoolParts | null;
    together(parts: PoolParts | null): boolean;
    walk(state: LeagueState, parts: PoolParts): { of: Map<string, PickEmHistory>; ends: number | null };
    /** Every player's history at once, one walk where the pool walks everyone together (the table's). */
    histories(state: LeagueState): Map<string, PickEmHistory>;
    endsAt(state: LeagueState): number | null;
    /** Whether two or more went home in an episode (a winner's exit isn't one): a night a second pick counts. */
    double(state: LeagueState, ep: Episode): boolean;
    secondCounted(state: LeagueState, ep: Episode, parts?: PoolParts | null): boolean;
    canBuyBack(state: LeagueState, buyback: PoolParts["buyback"], number: number): boolean;
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
    /** In reverse (step A9 part 2): the earlier they go home, the more. */
    reversed(state: LeagueState): boolean;
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
    /** Where their own season starts; null while the league waits for its phase (step A3). */
    startFor(state: LeagueState, playerId: string): number | null;
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
  /** A draft's finale predictions, as its spec's two questions say them (their points), or null. */
  finaleOfGame(state: LeagueState): { top3: number; winner: number; from: "any" | "own" } | null;
  /** Side bets where they count (only beside a draft: A4), or null. What everything that shows or takes a bet asks. */
  betsOn(state: LeagueState): { points: number } | null;
  /** Castaways per player in the draft. Derived from activeSlots+benchSlots for Active Roster. */
  rosterSize(state: LeagueState): number;
  /** The most a prediction can be worth (1 to this, whole points). */
  MAX_BET_POINTS: number;
  /** Castaways the player originally drafted, unaffected by later replenish/trade moves. */
  originalDraftPicks(state: LeagueState, playerId: string): Castaway[];
  /** The league's show format (exit methods, scoring events, merge, winner). See formats/index.js. */
  formatOf(state: LeagueState): GameFormat;
  /** The episode this league starts playing at (the spec's span.from: settings.startEpisode, default 1); null while a game
   *  that starts at a phase of the season (step A3) waits for it. */
  startEpisode(state: LeagueState): number | null;
  /** The phase of the season's rulebook it starts at (its id), or null: it starts at an episode. */
  startPhase(state: LeagueState): string | null;
  /** Waiting for its phase to start: nothing is in play, asked or scored yet. */
  waitsForPhase(state: LeagueState): boolean;
  /** The last episode a game over a span plays (settings.endEpisode), or null: to the season's end. */
  endEpisode(state: LeagueState): number | null;
  /** Step A11 part 1: the episode the game plays through as the data has it: its span's end, or earlier where a draft's race was
   *  won or its cuts left one (KnockoutLogic.endsAt). gameOver and spanView read it; endEpisode stays the span it was made with. */
  lastEpisode(state: LeagueState): number | null;
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
    /** Step A9 part 2: best ball's n (0: none); a captain's multiplier (0: no captain); whether the lineups score any way but
     *  plainly; what an episode's points multiply by (1: plainly). */
    bestOf(state: LeagueState): number;
    captainTimes(state: LeagueState): number;
    combines(state: LeagueState): boolean;
    timesFor(state: LeagueState, number: number): number;
    /** The captain who counts for a player in an episode (named for it, else carried from the last they named), or null. */
    captainFor(state: LeagueState, epId: string, playerId: string): string | null;
    validateCaptain(state: LeagueState, epId: string, playerId: string, castawayId: string | null, lineup?: string[]): string | null;
    setCaptain(state: LeagueState, epId: string, playerId: string, castawayId: string | null): boolean;
    /** Best ball: the team a player held for an episode (the mid-season log's moves from it on taken back). */
    teamFor(state: LeagueState, ep: Episode, playerId: string): string[];
    /** One player's points for one episode, as the game counts them (a captain, best ball, the episode's multiplier). */
    episodeScore(
      state: LeagueState,
      ep: Episode,
      playerId: string,
      pre?: { events?: ScoringEvent[]; times?: number }
    ): { total: number; lines: { castawayId: string; points: number; counted: boolean; captain: boolean }[]; captain: string | null; times: number; slots: GroupSlotLine[] };
    lockLineups(state: LeagueState, epId: string): boolean;
    unlockLineups(state: LeagueState, epId: string): boolean;
    carryForwardLineups(state: LeagueState, epId: string): boolean;
    addEvent(state: LeagueState, epId: string, type: string, castawayId: string, units?: number | null): ScoringEvent | null;
    removeEvent(state: LeagueState, epId: string, eventId: string): void;
    setEventUnits(state: LeagueState, epId: string, eventId: string, units: number | null): boolean;
    /** Recorded events plus the ones the format implies from exits and roles (`implied: true`). */
    episodeEvents(state: LeagueState, ep: Episode): ScoringEvent[];
  };
  /** Step A10 part 1: group slots (the spec's get.groups), on the season's format groups the sync writes into each episode. */
  GroupSlotLogic: {
    config(state: LeagueState): GroupSlots | null;
    /** The episodes by number, and each castaway out by the episode they went home in: once a pass. */
    index(state: LeagueState): GroupSlotIndex;
    record(state: LeagueState, n: number, ix?: GroupSlotIndex): EpisodeFormatGroups | null;
    find(groups: FormatGroup[], pick: GroupSlotPick | null, exits: Map<string, number>, k: number): FormatGroup | null;
    /** What a slot can pick going into episode n. */
    offered(state: LeagueState, n: number, ix?: GroupSlotIndex): { groups: FormatGroup[]; sure: boolean; why: string[]; shared: boolean };
    latestPick(state: LeagueState, playerId: string, slot: number, n: number): { pick: GroupSlotPick | null; from: number } | null;
    standing(state: LeagueState, playerId: string, slot: number, n: number, ix?: GroupSlotIndex): GroupSlotStanding;
    episodeLines(state: LeagueState, ep: Episode, playerId: string, events?: ScoringEvent[], times?: number, ix?: GroupSlotIndex): GroupSlotLine[];
    validatePick(state: LeagueState, epId: string, playerId: string, slot: number, groupId: string | null): string | null;
    setPick(state: LeagueState, epId: string, playerId: string, slot: number, groupId: string | null): boolean;
    settle(state: LeagueState, records: Map<number, EpisodeFormatGroups> | Record<number, EpisodeFormatGroups>): boolean;
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
  /** Where a game that starts at a phase plays from (step A3): the later of the phase's first episode (`from`, null while
   *  unknown: it waits again) and the first episode still open for moves (`open`); never once that's aired. Through
   *  setGame: its problems, [] when written or nothing changed. */
  settleStart(state: LeagueState, where: { from: number | null; open: number }): SpecProblem[];
  /** A7: a game that asks by phase records the season's phase starts and its phase windows; whether anything changed. */
  settlePhases(state: LeagueState, where: { phases: { id: string; from: number | null }[]; open: number }): boolean;
  /** A game that reads the season's phase starts: it asks by phase (A7), or its points multiply in a phase (A9 part 2). */
  readsPhases(state: LeagueState): boolean;
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
  // Blind draft (shared-ownership classic-draft). Note there is nothing here for reading the
  // submitted picks: those never enter league state -- the server reads them straight out of
  // blind_draft_picks (src/lib/server/blind-draft.ts). These are the state-side pieces only.
  BlindDraftLogic: {
    /** A blind draft: shared, picked in private (not A10 part 3's shared draw). */
    on(state: LeagueState): boolean;
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
  /** Step A10 part 3: a draft spread across the cast's groups (the spec's get.across), on the groups the data has them on now. */
  SpreadLogic: {
    config(state: LeagueState): import("./game-spec/index.js").DraftAcross | null;
    groupsNow(state: LeagueState): { of: Map<string, string | null>; groups: string[]; each: number; least: number; most: number } | null;
    /** The candidates that keep a team with `picked` spread (all of them when none does, or nothing is spread). */
    allowed(state: LeagueState, picked: string[], candidates: string[], g?: unknown): string[];
    /** Who a turn-based draft's player could take next and keep their team spread (of the free agents when left out). */
    allowedFor(state: LeagueState, playerId: string, candidates?: string[]): string[];
    pickProblem(state: LeagueState, playerId: string, castawayId: string): string | null;
    teamProblem(state: LeagueState, castawayIds: string[]): string | null;
  };
  /** Step A10 part 3: names out of a hat (the spec's get.order 'draw'), seeded and recorded in state.draw. */
  DrawLogic: {
    on(state: LeagueState): boolean;
    drawn(state: LeagueState): boolean;
    outcome(state: LeagueState, seed: string): { order: string[]; teams: Record<string, string[]>; short: string[] };
    draw(state: LeagueState, seed?: string): boolean;
    ready(state: LeagueState): boolean;
    due(state: LeagueState): boolean;
    settle(state: LeagueState): boolean;
  };
  /** Step A10 part 3b: a salary cap's prices from the data (each castaway's points so far by the game's rules, by standing). */
  PriceLogic: {
    config(state: LeagueState): import("./game-spec/index.js").BudgetParts | null;
    capOn(state: LeagueState): boolean;
    points(state: LeagueState, through?: number | null): Map<string, number>;
    latest(state: LeagueState): number;
    prices(state: LeagueState, through?: number | null): Map<string, number>;
  };
  /** Step A10 part 3b: a salary cap, at the draft and on every change after it. */
  BudgetLogic: {
    cap(state: LeagueState): number | null;
    cost(ids: string[], prices: Map<string, number>): number;
    allowed(state: LeagueState, picked: string[], candidates: string[], prices?: Map<string, number>, pool?: string[]): string[];
    least(state: LeagueState, picked: string[], id: string, pool: string[], prices: Map<string, number>): number;
    reason(state: LeagueState, cost: number, more?: number): string;
    pickProblem(state: LeagueState, playerId: string, castawayId: string, prices?: Map<string, number>): string | null;
    /** Part 4: `keep`, the seat's keepers, already on the team. */
    teamProblem(state: LeagueState, castawayIds: string[], keep?: string[]): string | null;
    moveProblem(state: LeagueState, playerId: string, dropId: string | null, addId: string, prices?: Map<string, number>): string | null;
    /** Part 3c: whether a change to a team is checked against prices (a salary cap's, or a stock market's cash). */
    priced(state: LeagueState): boolean;
  };
  /** Step A10 part 3c: a stock market, buying and selling each week at the data's prices; cash a ledger from the logs. */
  MarketLogic: {
    config(state: LeagueState): import("./game-spec/index.js").BudgetParts | null;
    on(state: LeagueState): boolean;
    draftPaid(state: LeagueState, playerId: string): number;
    cash(state: LeagueState, playerId: string): number | null;
    terms(state: LeagueState, dropId: string | null, addId: string, prices?: Map<string, number>): { sold: number; paid: number; fee?: number };
    moveProblem(state: LeagueState, playerId: string, dropId: string | null, addId: string, prices?: Map<string, number>): string | null;
    worth(state: LeagueState, playerId: string, prices?: Map<string, number>): number;
    view(state: LeagueState): { prices: Record<string, number>; cash: Record<string, number>; worth: Record<string, number> } | null;
  };
  /** Step A11 part 1: a draft's race (rank.race: the first to N points wins, and the game ends there) and players knocked out
   *  (rank.cut), worked out from the data on every read. `out`: the last episode that counts for someone knocked out. */
  KnockoutLogic: {
    parts(state: LeagueState): { race: { to: number } | null; cuts: { at: { every?: number; episode?: number; phase?: string }; out: number | "half"; tie: "keep" | "all"; quiet: "cut" | "skip" }[]; oneLeft: "ends" | "plays" } | null;
    on(state: LeagueState): boolean;
    series(state: LeagueState): KnockoutEpisode[];
    run(state: LeagueState): { out: Map<string, number>; ends: number | null; series: KnockoutEpisode[] };
    endsAt(state: LeagueState): number | null;
    outs(state: LeagueState): Map<string, number>;
    outOf(state: LeagueState, playerId: string): number | null;
    isOut(state: LeagueState, playerId: string): boolean;
    moveProblem(state: LeagueState, playerId: string, number: number): string | null;
    endedBefore(state: LeagueState, number: number): boolean;
    frees(state: LeagueState): boolean;
    apply(state: LeagueState, rows: ScoreRow[]): ScoreRow[];
  };
  /** Step A10 part 4: keepers across seasons (the spec's get.keep): options from last season's game (the server's: keepers.ts),
   *  named before the draft, locked as it starts; the draft fills the places they leave. */
  KeeperLogic: {
    config(state: LeagueState): { each: number; from: string | null; cost: "place" | "round" | "price"; fallback: "best" | "none" } | null;
    locked(state: LeagueState): boolean;
    options(state: LeagueState, playerId: string): string[];
    chosen(state: LeagueState, playerId: string): string[] | null;
    named(state: LeagueState, playerId: string): string[] | null;
    kept(state: LeagueState, playerId: string): { castawayId: string; price?: number }[];
    keptIds(state: LeagueState, playerId: string): string[];
    anyKept(state: LeagueState): boolean;
    places(state: LeagueState, playerId: string): number;
    paid(state: LeagueState, playerId: string): number;
    draftedAny(state: LeagueState): boolean;
    setOptions(state: LeagueState, options: Record<string, string[]>): boolean;
    choose(state: LeagueState, playerId: string, castawayIds: string[], by?: string): string | null;
    due(state: LeagueState): boolean;
    lock(state: LeagueState): boolean;
    settle(state: LeagueState): boolean;
    turns(state: LeagueState, order: string[]): { playerId: string; round: number }[];
    nameKey(name: string): string;
    rankFrom(old: LeagueState): string[];
    optionsFrom(old: LeagueState, oldPlayerIds: string[], state: LeagueState): string[];
  };
  /** Step A10 part 3b: an auction, by sealed bids settled at once (the bids kept out of the state: src/lib/server/auction.ts). */
  AuctionLogic: {
    on(state: LeagueState): boolean;
    settled(state: LeagueState): boolean;
    lockedPlayerIds(state: LeagueState): string[];
    hasLocked(state: LeagueState, playerId: string): boolean;
    setLockedPlayerIds(state: LeagueState, playerIds: string[]): void;
    eligiblePlayers(state: LeagueState): Player[];
    waitingOn(state: LeagueState): Player[];
    allLockedIn(state: LeagueState, lockedPlayerIds: string[]): boolean;
    /** Part 4: for a seat (`playerId`), the places its keepers leave and what they cost. */
    maxBid(state: LeagueState, playerId?: string): number;
    maxBids(state: LeagueState): number;
    ready(state: LeagueState): boolean;
    sheetFor(state: LeagueState, order: string[], playerId?: string): { castawayId: string; bid: number }[];
    validateBids(state: LeagueState, playerId: string, bids: { castawayId: string; bid: number }[]): string | null;
    outcome(state: LeagueState, bidsByPlayer: Record<string, { castawayId: string; bid: number }[]>, seed: string): {
      order: string[]; won: { playerId: string; castawayId: string; price: number; filled?: true }[]; spent: Record<string, number>; short: string[];
    };
    settle(state: LeagueState, bidsByPlayer: Record<string, { castawayId: string; bid: number }[]>, seed?: string): boolean;
    due(state: LeagueState, now?: number): boolean;
  };
  /** Step A10 part 3b: what a team could take next, kept spread (part 3) and within a salary cap (every candidate when neither). */
  draftFits(state: LeagueState, picked: string[], candidates: string[], g?: unknown, prices?: Map<string, number>): string[];
  draftFitsFor(state: LeagueState, playerId: string, candidates?: string[]): string[];
  activeRosterLineupFor(state: LeagueState, epId: string, playerId: string): string[];
  setActiveRosterLineup(state: LeagueState, epId: string, playerId: string, castawayIds: string[]): boolean;
  setActiveRosterCaptain(state: LeagueState, epId: string, playerId: string, castawayId: string | null): boolean;
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
  ): { available: string[]; blocked: Record<string, { episode: number; reason: "cycle" | "backToBack" | "used" }>; out?: number; ended?: number };
  /** A player's Pick'em season with streaks: a row per episode that happened, plus any pending pick. A pool's parts (step A10
   *  part 2: lives, a buyback, mulligans, a second pick) add their fields to the rows and the history, only when it has them. */
  pickEmHistory(
    state: LeagueState,
    playerId: string
  ): PickEmHistory;
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
  /** opts.second: a pool's second pick, beside a first already made (step A10 part 2). */
  setPickEmPick(state: LeagueState, epId: string, playerId: string, castawayId: string, opts?: { second?: boolean }): void;
  /** opts.second: only the second pick; else the whole pick. */
  removePickEmPick(state: LeagueState, epId: string, playerId: string, opts?: { second?: boolean }): void;
  /** Whether this Survival Pool takes a weekly Who goes home? call (settings.calls): the person's Call it (calls.ts). */
  pickEmCallsOn(state: LeagueState): boolean;
  BetLogic: {
    /** A side bet's lock: its episode's start (closedForPlay), and for good once it has results. */
    closed(ep: Episode | null | undefined): boolean;
  };
  /** A game's questions (step A4 of docs/PLAN-start-a-game-gpt.md): graded from the league's own results, never stored. */
  AnswerLogic: {
    facts(state: LeagueState): AnswerFacts;
    finishOrder(state: LeagueState): string[];
    questions(state: LeagueState): Question[];
    /** A8: who was in at the game's first episode (a pairs question's pairs are drawn from them). */
    startIn(state: LeagueState): string[];
    /** A7: whether the game asks anything by phase (asked once a phase, or settled by where a phase starts). */
    byPhase(state: LeagueState): boolean;
    /** A7: where a question's windows open, in order (none asked once). */
    windowStarts(state: LeagueState, q: Question, seen?: number | null): number[];
    /** A7: whether a question's window opens at `episode` (its answers' key; 0 asked once). */
    opensAt(state: LeagueState, q: Question, episode: number): boolean;
    /** A7: the window an episode is in (where it opens), or null. */
    windowAt(state: LeagueState, q: Question, episode: number | null, seen?: number | null): number | null;
    closesAt(state: LeagueState, q: Question, episode: number, finale?: number | null): number | null;
    closed(state: LeagueState, q: Question, episode: number, o?: { now?: number; finale?: number | null; airAt?: string | null; mark?: number | null }): boolean;
    episodeNow(state: LeagueState): number | null;
    /** A7: the episode someone answers for now with a late lock (the one after their mark while it's open for them). */
    lateEpisode(state: LeagueState, mark: number | null, o?: { now?: number; airAtOf?: (episode: number) => string | null }): number | null;
    /** earned: each window's ("question|episode") points by player, A9's ways of combining in; worth: a rollover's window's
     *  points with its jackpot. */
    grade(
      state: LeagueState,
      answers: { playerId: string; question: string; episode: number; answer: unknown; late?: number; changes?: number }[],
      facts?: AnswerFacts
    ): { points: Map<string, number>; verdicts: Map<string, Verdict>; earned: Map<string, Map<string, number>>; worth: Map<string, number> };
    /** A9: how many of the game's episodes had started at `o.now` (when an answer was made). */
    started(state: LeagueState, o?: { now?: number; airAtOf?: (episode: number) => string | null }): number;
    finaleAnswers(state: LeagueState): { playerId: string; question: string; episode: number; answer: string | string[] }[];
    finalePoints(state: LeagueState): Map<string, number>;
    finaleActual(state: LeagueState): { top3: (string | null)[]; winner: string | null };
    /** A11 part 2b: a game of questions' race, cuts and lives, walked over its graded answers (null: a game with none of them). */
    walk(state: LeagueState, answers: { playerId: string; question: string; episode: number; answer: unknown; late?: number; changes?: number }[], facts: AnswerFacts): AnswerWalk | null;
    /** A copy of the state carrying its walk (never the state itself); the walk a state carries, or null. */
    withWalk(state: LeagueState, walk: AnswerWalk | null): LeagueState;
    walkOf(state: LeagueState): AnswerWalk | null;
    /** The answers that count: someone out keeps only their answers to windows settled by their last episode in. */
    liveRows<T extends { playerId: string; question: string; episode: number }>(state: LeagueState, rows: T[], out: Map<string, number> | Record<string, number>): T[];
    liveAnswers<T extends { playerId: string; question: string; episode: number }>(state: LeagueState, rows: T[]): T[];
    applyWalk(state: LeagueState, rows: ScoreRow[], walk: AnswerWalk): ScoreRow[];
  };
};
/** A11 part 2b: a game of questions' walk (AnswerLogic.walk): where it ends early, who's out after which episode, lives left (with
 *  lives), who went out together sharing it, and each one's points as the table shows them (frozen once out). Plain data. */
export interface AnswerWalk {
  ends: number | null;
  out: Record<string, number>;
  lives: Record<string, number>;
  shared: string[];
  totals: Record<string, number>;
  /** A11 part 3: a co-op game's (its lives the couch's together): the lives left and at the start, the nights one went (each
   *  question's), and the result, won or lost by all (null while it plays). Everyone is in `shared`, each with the couch's lives. */
  coop?: CoopWalk;
}
export interface CoopWalk {
  lives: number;
  of: number;
  lost: { episode: number; question: string }[];
  result: "won" | "lost" | null;
}

export default StateLogic;
