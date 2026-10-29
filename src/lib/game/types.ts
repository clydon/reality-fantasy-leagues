// Hand-written types for the league state shape produced/consumed by state-logic.js.
// state-logic.js itself stays plain, untyped JS (forked from the live app — see the provenance
// note at its top) so these are a best-effort description of its actual shape, not a source of
// truth generated from it.
import type { FormatData, SeasonChange } from "./formats/index";
import type { ArtStyle } from "@/lib/show-art-style";
// Season rule changes as the admin API returns them (db/season-rule-changes.js).
export type { SeasonRuleChange, SeasonRuleChangeStatus, SeasonRuleChangeWithReview } from "@db/season-rule-changes";
import type { Proposal, Review, ReviewNote } from "./formats/proposal";

export interface Player {
  id: string;
  name: string;
  color: string;
  disabled?: boolean;
  active?: boolean;
  // Set by disablePlayer so the same account can reclaim the seat on rejoin (reclaimPlayer).
  formerName?: string;
  disabledFromUserId?: string;
  /** A computer player (bot-logic.js): makes its own moves. Never set on a seat linked to an account. */
  automated?: boolean;
  /** How sharp a computer player plays (bot-logic.js's LEVELS); absent means "solid". */
  botLevel?: "casual" | "solid" | "sharp";
  /** A late joiner the league can't see yet (StateLogic.GhostLogic); cleared when the commissioner adds them. */
  ghost?: boolean;
  /** A late joiner's own season (StateLogic.GhostLogic). Kept after they're added to the league. */
  lateJoin?: LateJoin;
}

export interface LateJoin {
  /** The episode they chose to start from; null until they've chosen (and drafted). */
  startEpisode: number | null;
  /** True while they're behind the latest results and playing one episode at a time. */
  catchingUp: boolean;
  /** Their spoiler mark, mirrored here by the server so a commissioner can see how far along they are. */
  seenThrough?: number | null;
}

export interface Tribe {
  id: string;
  name: string;
  color: string;
}

export interface Castaway {
  id: string;
  name: string;
  /** Their CURRENT tribe/team (null for none); follows any recorded moves -- see GroupLogic. */
  tribeId: string;
  /** Their starting group, kept once they've moved. Absent means tribeId is still the starting one. */
  startTribeId?: string | null;
  // Every league type uses this array, never a scalar owner -- exclusive-ownership leagues are
  // just the case where it never exceeds length 1 (see Core's ownership helpers in state-logic.js).
  ownerIds: string[];
  photoUrl?: string;
  status: "active" | "eliminated";
  placementOrder?: number;
  exitMethod?: string;
  exitEpisodeId?: string;
  replenishClaimed?: boolean;
  /** Step A10 part 4: "keeper", kept from last season's game before the draft (StateLogic.KeeperLogic). */
  acquiredVia?: "draft" | "replenish" | "trade" | "keeper" | null;
  formerOwnerId?: string | null;
  departedVia?: "replenish" | "trade" | null;
  /**
   * The season_cast row this castaway is (docs/PLAN-universal-season-cast.md). Set only by matching
   * (StateLogic.planSeasonCastLinks / applyCastImport), never by hand; absent for a league with no
   * season, or a castaway the season's cast doesn't have.
   */
  seasonCastId?: string | null;
}

export interface BetPrediction {
  id: string;
  playerId: string;
  guess: string;
  correct: boolean | null;
}

export interface Bet {
  id: string;
  label: string;
  points: number;
  predictions: BetPrediction[];
  createdByPlayerId?: string | null;
}

// GET .../bets/:id/suggested-answer (db/embeddings.js's suggestAnswer) -- a semantic-search grading
// aid for a bet's free-text question. Never a fabricated guess: 'answer' is the closest matching
// research chunk's text verbatim, or null when nothing cleared the confidence floor (see `status`).
export interface SuggestedBetAnswer {
  status: "no-research" | "unconfident" | "ok";
  answer: string | null;
  confidence: "high" | "medium" | "low" | null;
  castawayName: string | null;
  similarity: number | null;
  /**
   * Where it came from. "research": the episode's research settled this bet directly (BetAnswer) --
   * with which guesses are right. "search": the closest research note, found by semantic search, for
   * a bet the research wasn't asked about.
   */
  source?: "research" | "search";
  /** research only: the guesses the research judged right (exact guess text). */
  correctGuesses?: string[];
  evidence?: string | null;
  sources?: string[];
  /** search only: true when the bet was made after its episode was researched -- re-run to settle it. */
  askedAfterResearch?: boolean;
}

/**
 * A side bet settled by episode research (db/episode-research.js), stored on the research payload
 * and matched back to leagues' bets by wording.
 */
export interface BetAnswer {
  question: string;
  guesses: string[];
  answer: string | null;
  correctGuesses: string[];
  evidence: string | null;
  sources: string[];
  confidence: "high" | "medium" | "low";
}

// Active Roster: one point-earning occurrence in an episode. Deliberately NOT stored in
// Episode.events, which already means eliminations -- see ActiveRosterLogic.addEvent's note.
export interface ScoringEvent {
  id: string;
  /** One of the league's format's event ids (StateLogic.formatOf(state).events). */
  type: string;
  castawayId: string;
  /** Derived from an exit or a role rather than recorded (ActiveRosterLogic.episodeEvents). */
  implied?: boolean;
  /** How many it counts for, when more than one: a count research reported (3 home runs, 6.67 innings).
   *  Its points are the type's times this (ActiveRosterLogic.eventPoints). */
  units?: number;
  /** One of the couch's own moments, as the couch settled it (src/lib/server/couch-answers.ts): replaced as answers change. */
  couch?: boolean;
}

export interface PickEmPick {
  playerId: string;
  castawayId: string;
  /** A pool's second pick (step A10 part 2, get.second): counts on a night two or more go home. */
  second?: string;
}

export interface Episode {
  id: string;
  number: number;
  postMerge: boolean;
  /** Display-only: set on the viewer's copy when this episode's results are held back from them
   *  (StateLogic.SpoilerLogic.viewThrough). Never stored. */
  resultsHidden?: boolean;
  /** 'early' while only who went home is in (StateLogic.resultsStage); absent once the full results are. */
  resultsStage?: "early";
  /** Nobody went home in it (docs/PLAN-new-design.md step 6c): the season sync's shared fact, so an episode with no
   *  elimination still has results (StateLogic.episodeHasResults). */
  noExit?: boolean;
  /** When this episode airs (ISO), from the league's season schedule -- stamped by the server
   *  (src/lib/server/air-times.ts), absent without a schedule or while catching up. Lineups and
   *  picks lock at this moment. */
  airsAt?: string;
  /**
   * Both optional and both filled in only by the wiki connector's eliminations import, which gets them
   * for free off the episode guide. Never overwritten once set, and absent on every hand-created
   * episode -- the Episode Card renders them when present and omits them otherwise.
   */
  title?: string | null;
  airDate?: string | null;
  /** Eliminations. `juryVotes`: a finalist's jury votes received, when known (Survivor scores each). */
  events: { castawayId: string; method: string; juryVotes?: number }[];
  /**
   * Who an Exile Island-style twist sent away from their tribe this episode. Still in the game --
   * this is a RECORD, not a mechanic: it changes no owner, tribe or placement. The only thing that
   * reads it is the format's impliedEvents (Survivor's `wentToExile`, worth 0 by default). See
   * EpisodeLogic.addExiled.
   * Always present (EpisodeLogic.create initializes it, migrateLeagueState backfills old saves).
   */
  exiled: { castawayId: string; at: string }[];
  /**
   * Who took on a secret role this episode (The Traitors: "Traitor" at the start, "Recruited
   * Traitor" later). See RoleLogic. Absent on episodes from before roles existed.
   */
  roles?: { castawayId: string; role: string }[];
  /** Who changed tribe/team this episode (tribeId null = no group now). See GroupLogic. */
  groups?: { castawayId: string; tribeId: string | null }[];
  bets: Bet[];
  // Pick'em only (state-logic.js's PickEmLogic) -- one entry per player who's made a pick for
  // this episode, upserted in place rather than accumulated. Always present (EpisodeLogic.add
  // initializes it, migrateLeagueState backfills it on old saves) but only ever populated for a
  // 'pickem' league.
  picks: PickEmPick[];
  // A public pool's Who goes home? calls (PickEmLogic.setCall, settings.calls): one per player, the same shape as picks.
  calls?: PickEmPick[];
  // Active Roster only, all three always present (EpisodeLogic.add initializes them,
  // migrateLeagueState backfills old saves).
  //
  // `lineups` is the per-episode snapshot of who each player fielded THIS episode. Per-episode
  // rather than one mutable "current" set plus a copy: that's what makes editing a later episode's
  // lineup unable to change an earlier episode's score. `lineupsLocked` is an explicit commissioner
  // action, not derived from whether eliminations exist yet -- see ActiveRosterLogic's comment.
  scoringEvents: ScoringEvent[];
  lineups: Record<string, string[]>;
  lineupsLocked: boolean;
  /** A lineup's captain for this episode (step A9 part 2, a game with a captain): castaway id, or null for none. Absent: the
   *  last one named carries (ActiveRosterLogic.captainFor). */
  captains?: Record<string, string | null>;
  /** Step A10 part 1, a game with group slots (the spec's get.groups): each player's slots picked for this episode, by the
   *  slot's number (null: emptied), carried until a later episode's pick (GroupSlotLogic.standing). Absent: nothing picked here. */
  groupSlots?: Record<string, Record<string, GroupSlotPick | null>>;
  /** Step A10 part 1: the format's groups as this episode had them (the season's format state over time, written by the season
   *  sync for a game with group slots, only on an episode with results: GroupSlotLogic.settle). */
  formatGroups?: EpisodeFormatGroups;
  /** Kept open past its start by whoever runs the game (Backstage › Settings' lock; StateLogic.closedForPlay). */
  openPastAir?: boolean;
}

/** A group slot's pick (step A10 part 1): the group as it was offered (its id in the season's format timeline, and its members,
 *  the league's castaway ids, by which a correction that moved its id still finds it). */
export interface GroupSlotPick {
  id: string;
  members: string[];
  /** How many the group had as research said (members are only those on the league's cast). */
  size?: number;
}
/** One of the format's groups, as an episode's record has it: its id in the timeline, its name (the show's, or its members'),
 *  and its members as the league's castaway ids (anyone not on the league's cast left out). */
export interface FormatGroup {
  id: string;
  name: string;
  members: string[];
  /** Its people as research has them, those not on the league's cast too. */
  size: number;
}
/** An episode's groups (step A10 part 1, GroupSlotLogic.settle): who is with whom at its end, going into the next (`end`:
 *  divided when there are two groups or more; sure as the timeline's goingInto says it, `why` when not), and the groups that
 *  played it (`played`: as they were at its start; apart when it was played without them; null when it isn't known). */
export interface EpisodeFormatGroups {
  end: { groups: FormatGroup[]; divided: boolean; sure: boolean; why: string[] };
  played: { groups: FormatGroup[]; apart: boolean; sure: boolean } | null;
}

export interface FinalePrediction {
  playerId: string;
  top3: (string | null)[];
  winner: string | null;
}

/** A league's compiled rulebook as its state caches it (settings.rulebook, db/rulebooks.js). `version` is the
 *  rulebook's when it was written, so a league behind its rulebook is detectable; `reader` is the code half
 *  that reads the show (formats/index.js formatForRulebook). */
export interface LeagueRulebook {
  id: string;
  version: number;
  data: FormatData;
  reader: "survivor" | "traitors" | "challenge" | "research" | "league";
}

export interface LeagueSettings {
  teamSize: number;
  /** Survival Pool: a weekly Who goes home? call beside the pick (a season's public pool, step 9 part 3). */
  calls?: boolean;
  /** Survival Pool: 'scores' when a pick survives an event by scoring in it (a sport, where nobody goes home: step 10
   *  part 2b); absent, by not going home. */
  poolSurvive?: "scores";
  /** Archived (step 10 part 2b): when, and by whom. It stays on the couch and the trophy shelf; nothing scores it. */
  archivedAt?: string;
  archivedBy?: string;
  bonusEnabled: boolean;
  /** Mid-season priority: "rolling" reverse-draft waiver list (default), or standings each round. */
  replenishOrderBy: "rolling" | "mostPoints" | "leastPoints";
  /** replaceRule "whenShort"'s N: replace once down to this many still in (default starting spots - 1; Classic: roster - 1). */
  replenishAt?: number | null;
  // Waivers v2 (docs/PLAN-waivers-v2.md; StateLogic.WaiverLogic.config). Backfilled from the pre-v2
  // switches below by migrateLeagueState and db/migrations/0063.
  /** When a castaway of yours is voted out: replace them after any episode, only when short, only in waiver windows, or never. */
  replaceRule?: ReplaceRule;
  /** When waiver windows open on their own, and how many swaps each allows (0 = replacements only; up to roster size). */
  waiverWindows?: WaiverWindows;
  /** Casual · Balanced · Competitive: which recommendation the league started from (WaiverLogic.recommend). */
  waiverFeel?: WaiverFeel;
  /** Replacements still owed at airtime are filled automatically; on unless false. */
  autoFill?: boolean;
  /** How many teams the commissioner expected when creating the league: the waiver suggestion's count until the draft starts. */
  expectedTeams?: number;
  /** On the suggestion worked out for expectedTeams: fitted to the real count when the draft starts (WaiverLogic.refit). */
  waiverFit?: boolean;
  /** Pre-v2: add/drop weeks after every Nth episode. Kept in step with waiverWindows for one release. */
  swapEvery?: number | null;
  // Pre-v2 switches, kept in step with replaceRule/waiverWindows for one release (WaiverLogic.mirrorLegacy).
  // Ask whether they happen through replenishAvailable/tradeAvailable in state-logic.js.
  replenishEnabled: boolean;
  tradeEnabled: boolean;
  /** Waivers process this many hours before the next episode airs: 12, 24 (default) or 48. */
  waiverProcessHours?: number;
  /** Free agency between processing and airtime; on unless false. */
  freeAgencyEnabled?: boolean;
  /**
   * Catch-up mode (StateLogic.RevealLogic): null = live, an integer = this league may only see
   * episodes 1..n. Absent on every league that predates it, which reads as null.
   */
  revealedThroughEpisode?: number | null;
  /** Late joiners play from an episode of their choosing, unseen until added (StateLogic.GhostLogic).
   *  Absent means on; only an explicit false switches it off. */
  allowLateJoiners?: boolean;
  /** Lock it down (the new design's competitive mode, step 15 part 4): nobody new joins (GhostLogic.allowed), nobody catches up,
   *  and the rules don't change for the season. Absent means off. */
  lockedDown?: boolean;
  /** A game of questions' late lock (step A7, the spec's extras.lateLock): hours past an episode's air time someone who
   *  hasn't seen it can still answer its questions. */
  lateLockHours?: number;
  /** A game of questions' parlays (step A9, the spec's score.parlays): someone right on every one of `of` in a window has their
   *  points on them multiplied by `times`. */
  parlays?: { of: string[]; times: number }[];
  /** Points per bingo line (step A9, the spec's score.points on a Weekly Bingo), 1 when it's left out. */
  linePoints?: number;
  /** Step A9 part 2, each absent unless a game says it: best ball (a Weekly Lineup's best activeSlots count each episode, no
   *  lineups: count.best), a lineup's captain's multiplier (score.captain.times), when a draft's points multiply (score.times),
   *  Outlast in reverse (score.reverse). */
  bestBall?: boolean;
  captainTimes?: number;
  pointsTimes?: import("./game-spec/index.js").SpecWhen[];
  reverseOrder?: boolean;
  /** Step A10 part 1, absent unless a game says it: a lineup's or best ball's group slots (the spec's get.groups). */
  groupSlots?: import("./game-spec/index.js").GroupSlots;
  /** Step A10 part 3, each absent unless a game says it: a draft dealt by a draw (get.order 'draw'), and one spread across the
   *  cast's groups (get.across). */
  draftDraw?: boolean;
  draftAcross?: import("./game-spec/index.js").DraftAcross;
  /** Step A10 part 3b, each absent unless a game says it: an auction (get.order 'auction'), and a draft's prices (get.budget: an
   *  auction's budget, or a salary cap). */
  draftAuction?: boolean;
  draftBudget?: import("./game-spec/index.js").DraftBudget;
  /** Step A10 part 3c, absent unless a game says it: a stock market ranked by worth (rank.by 'worth'; its trading is the
   *  budget's trade, in draftBudget). */
  draftRank?: "worth";
  /** Step A10 part 4, absent unless a game says it: keepers from last season's game (get.keep). */
  draftKeep?: import("./game-spec/index.js").DraftKeep;
  /** Step A10 part 2, each absent unless a game says it: a pool's lives (score.lives), buyback (score.buyback), mulligans
   *  (score.mulligans), second pick (get.second) and last one standing (rank.by 'standing'). */
  poolLives?: number;
  poolBuyback?: import("./game-spec/index.js").PoolBuyback;
  poolMulligans?: number;
  poolSecond?: { fallback: "void" | "counts" };
  poolRank?: "standing";
  /**
   * The episode this league starts playing at (default 1): a league formed mid-season drafts and picks
   * from here, and nothing in earlier episodes scores. Read it through StateLogic.startEpisode. A game that starts when a
   * phase of the season's rulebook does (startPhase) has null here while it waits for that phase, then the episode it plays
   * from once that's settled (docs/PLAN-start-a-game-gpt.md step A3).
   */
  startEpisode?: number | null;
  /** The phase of the season's rulebook it starts at (its id), or absent: it starts at startEpisode. Read it through
   *  StateLogic.startPhase. */
  startPhase?: string;
  /**
   * The last episode a game over a span plays (docs/PLAN-sports-data.md step 6): one game, a series, a stretch of the
   * season. Nothing after it scores, and the game's over once it has results. Absent or null: to the season's end. Read
   * it through StateLogic.endEpisode.
   */
  endEpisode?: number | null;
  defaultBetPoints: number;
  // Same opt-in shape as replenishEnabled/tradeEnabled above, gated together with the league
  // type's own supportsFinalePredictions -- see finalePredictionsAvailable in state-logic.js.
  finalePredictionsEnabled: boolean;
  finaleTop3Points: number;
  finaleWinnerPoints: number;
  finalePredictionScope: string;
  draftScheduledAt?: string | null;
  /** The turn-based draft's pick timer in seconds: 0 (off, the default), 120 or 60. */
  draftTimer?: number;
  /** When the pick timer runs out: wait for them (the default), or pick the first still free from their queue. */
  draftAway?: "wait" | "queue";
  leagueTypeId: string;
  /** The catalog show's slug. Null on a new league until the commissioner picks one. */
  showId: string | null;
  /**
   * The show's format id (shows.format), cached when showId is set. Absent or null on leagues from
   * before formats, which play by the default (Survivor) -- read it through StateLogic.formatOf.
   */
  showFormat?: string | null;
  /** A stored format's data half (db/show-formats.js), cached by the server beside showFormat. Absent
   *  for a built-in format. Never set by a request: the settings route refuses it. */
  showFormatData?: FormatData | null;
  /**
   * A league's own ruleset copy (db/league-rulesets.js), checked first by StateLogic.formatOf, ahead
   * of showFormat/showFormatData above. Absent for every league using its show's format as-is -- the
   * vast majority, read exactly as before. Never set by a request: only the ruleset routes write it.
   */
  leagueRulesetData?: FormatData | null;
  /**
   * The league's compiled rulebook (db/rulebooks.js syncLeagueRulebook), checked first of all by
   * StateLogic.formatOf. Written only while the rulebooks flag is on, and taken out when it goes off; never
   * set by a request: the settings route refuses it.
   */
  rulebook?: LeagueRulebook;
  /**
   * Season rule changes (docs/PLAN-season-rule-changes.md). `seasonRuleChanges` is every change an
   * admin approved for this league's season -- what its commissioner is offered. `adoptedRuleChanges`
   * is what the commissioner adopted, each frozen at the version adopted; StateLogic.formatOf layers
   * these on the base above. Both absent until a season has a change. Never set by a request.
   */
  seasonRuleChanges?: SeasonChange[];
  adoptedRuleChanges?: SeasonChange[];
  /** Changes its commissioner said no to, by version (an admin's later edit is offered again). */
  declinedRuleChanges?: { id: string; version: number }[];
  /**
   * Guided-setup gate. `false` only on leagues created after guided setup shipped; absent on every
   * league that predates it, and anything other than an explicit `false` counts as complete -- see
   * SetupLogic in state-logic.js.
   */
  setupComplete?: boolean;
  // classic-draft only: 'exclusive' (snake draft, one owner per castaway) or 'shared' (blind draft,
  // many owners). Fixed pairing with the draft mechanic -- see CLASSIC_DRAFT_SHARED in state-logic.js.
  ownershipMode: "exclusive" | "shared";
  /** Which real season this league tracks, for the wiki connector. Null until set. */
  wikiSeason: number | null;
  // Active Roster only. rosterSize() derives the draft's per-player total from these for that
  // league type, so together they replace teamSize there rather than sitting alongside it.
  activeSlots: number;
  /** Active Roster: keep other players' starters off the Board until the episode airs and lineups
   *  lock (so nobody copies a lineup). Off by default -- starters show the moment they're set. */
  hideStartersUntilLock?: boolean;
  benchSlots: number;
  /** Points per scoring-event type, keyed by the format's event ids. 0 switches a category off. */
  eventPoints: Record<string, number>;
  // Pick'em only, defaulted for every league regardless of type (see defaultState's comment) --
  // points awarded for a correct weekly pick.
  pickemCorrectPoints: number;
}

export interface Membership {
  role: "member" | "commissioner";
  playerId: string | null;
  /** Spoiler protection: the last episode whose results this member has revealed. Null = sees
   *  everything (opted out, or not a member). See StateLogic.SpoilerLogic. */
  resultsSeenThrough?: number | null;
  /** "How this league works" has been finished or skipped once (docs/PLAN-league-explainer.md).
   *  Only an explicit false opens it by itself. */
  explainerSeen?: boolean;
}

// The PUBLIC half of a blind draft: who has locked in (for the "waiting on N players" UI) and
// whether the simultaneous reveal has happened. The submitted picks themselves are deliberately
// NOT part of league state -- they live in the blind_draft_picks table so they can't be read out of
// the broadcast state blob before the reveal. See db/migrations/0004_blind_draft_picks.sql.
// A season of a show, as the admin catalog stores it (db/migrations/0006_shows_and_seasons.sql).
// Leagues reference a season by (show slug, seasonNumber) via settings.showId/settings.wikiSeason
// rather than by id, which is why no league-state migration was needed to introduce these.
export interface ShowSeason {
  id: string;
  seasonNumber: number;
  name: string | null;
  /** The page title the MediaWiki API needs, derived from wikiUrl but independently editable. */
  wikiPageTitle: string | null;
  /** The URL as pasted from a browser, kept so an admin can see what they entered. */
  wikiUrl: string | null;
  status: "upcoming" | "airing" | "completed";
  /** Starting contestant count. Lets the shared-ownership nudge do real arithmetic pre-cast. */
  castSize: number | null;
  /** How many episodes the season has, when known (0029). Caps the episode list and everything that counts episodes. */
  episodeCount?: number | null;
  premiereDate: string | null;
  finaleDate: string | null;
  // Admin-only pipeline state (GET /api/admin/shows) -- where the season is in cast -> episodes, so
  // the season row can show progress and the next step rather than a row of equal-looking buttons.
  /** Rows staged in season_cast by the last cast pull (0 = never pulled). */
  castStaged?: number;
  /** When an admin last approved the staged cast; null if never, or if a re-pull changed it since. */
  castApprovedAt?: string | null;
  /**
   * Who decides episode results (db/migrations/0054): "admin" pushes an admin's Accept into every
   * league; "leagues" leaves each league's results to its commissioner.
   */
  resultsBy?: "admin" | "leagues";
  /** Set when switched to "admin" from "leagues": only decisions settled from then on are pushed. */
  resultsAdminSince?: string | null;
  /** Highest episode number in the cached wiki extraction; null if episodes were never pulled. */
  wikiEpisodesThrough?: number | null;
  /** Episode numbers that have a stored research row. */
  researchedEpisodes?: number[];
  /** Episode results awaiting an admin decision (db/migrations/0019). */
  pendingDecisions?: number;
  // Air schedule + auto-research (db/migrations/0020). Times are "HH:MM" wall-clock in airTz.
  airTime?: string | null;
  airTz?: string;
  autoResearch?: boolean;
  /** 0 = Sunday. */
  researchWeekday?: number | null;
  researchTime?: string | null;
  /** Research each episode this many hours after it airs (0035); null = the older weekday/time. */
  researchDelayHours?: number | null;
  researchModel?: string | null;
  autoResearchSince?: string | null;
  // Bot research (db/migrations/0065, experimental): the free ChatGPT schedule, minutes after an episode ends.
  botResearchOn?: boolean;
  /** null = never set: the default (quick at 5 min, full at 1 h and 9 h). */
  botResearchSchedule?: { kind: "quick" | "full" | "schedule" | "trivia" | "bingo"; after: number; on: boolean }[] | null;
  botResearchSince?: string | null;
  /** How long an episode runs, in minutes (0066); null = an hour. Bot research counts from the end. */
  episodeMinutes?: number | null;
  /** Episodes whose start or length research confirmed (season_episodes, 0067), in order. */
  scheduledEpisodes?: { number: number; airAt: string | null; minutes: number | null; note: string | null; source: "research" | "admin"; reportedIn: number | null }[] | null;
  /** The wiki's printed air date per episode number, from the cached extraction. */
  wikiAirDates?: Record<string, string> | null;
  /** The latest scheduled attempt per episode number. */
  lastAutoAttempts?: Record<string, { at: string; ok: boolean; message: string | null }> | null;
}

// ---------- stored show formats (db/migrations/0049, docs/PLAN-stage-3-format-proposals.md) ----------

/** A format a show can be switched to (GET /api/admin/shows `formatOptions`). */
export interface FormatOption {
  id: string;
  name: string;
  /** An approved stored format rather than a built-in. */
  stored: boolean;
  /** What a new show on it calls its people and groups. */
  terms: { castaway: string; tribe: string };
}

/** One stored format with its review (GET /api/admin/formats/:id). */
export interface StoredFormat {
  id: string;
  name: string;
  status: "draft" | "approved";
  version: number;
  proposal: Proposal;
  data: FormatData | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  review: Review;
}

/** A row of GET /api/admin/formats. */
export interface StoredFormatSummary {
  id: string;
  name: string;
  status: "draft" | "approved";
  version: number;
  showCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export type { Proposal, Review, ReviewNote };

/** A commissioner's own copy of a show's rules (db/league-rulesets.js, migration 0052). */
export interface LeagueRuleset {
  id: string;
  leagueId: string;
  name: string;
  data: FormatData;
  version: number;
  parentKind: "builtin" | "show_format" | "league_ruleset" | "none";
  parentId: string | null;
  parentVersion: number | null;
  visibility: "private" | "shared";
  reviewStatus: "unreviewed" | "approved";
  lockedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row of GET /api/leagues/:leagueId/ruleset/shared. */
export interface SharedLeagueRuleset extends LeagueRuleset {
  leagueName: string;
}

// One person in a catalogued season's admin-reviewed cast (db/migrations/0011). Season data, not
// league data: approving it is what creates castaways in every league tracking that season.
export interface SeasonCastMember {
  id: string;
  name: string;
  tribeName: string | null;
  photoUrl: string | null;
}

/** Token counts as the Anthropic API reports them, plus web searches for research. */
export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  web_search_requests?: number;
}

// ---------- episode research (db/episode-research.js, db/migrations/0014) ----------
// The second connector: a fixed checklist answered by a web-searching model, for the facts the
// wiki's tables don't carry (idols found, sit-outs, advantages played against someone).

/**
 * Three-valued on purpose. "no" means the research looked and it didn't happen; "unknown" means it
 * couldn't be established. Collapsing those two is what turns a gap in the sources into a confident
 * wrong answer, so the UI has to be able to show the difference.
 */
export type ResearchAnswer = "yes" | "no" | "unknown";

/**
 * One castaway's answers. Every castaway gets one, including those nothing happened to. The fields
 * shared by every format are typed; the rest are the show format's own checklist questions
 * (formats/survivor.js, formats/traitors.js) -- render them through format.research.notes.
 */
export interface ResearchCastaway {
  name: string;
  leftTheGame: ResearchAnswer;
  exitMethod: string | null;
  notableTwist?: string | null;
  /** URLs behind THIS person's answers. Empty is itself information -- nothing backs them. */
  sources: string[];
  confidence: "high" | "medium" | "low";
  [question: string]: unknown;
}

export interface EpisodeResearch {
  episodeTitle: string | null;
  airDate: string | null;
  summary: string;
  /** Research's flag that the show may have changed how it's played (docs/PLAN-season-rule-changes.md):
   *  one sentence, or null -- which is the normal answer. */
  rulesNote?: string | null;
  /** Grouped formats: whether the game has merged by the end of the episode. */
  merged?: "yes" | "no" | "unknown";
  /** How the game is organised at the end of the episode, and what changed in it (F2: src/lib/game/formats/format-state.js;
   *  docs/STUDY-format-changes.md). Every show's; null or absent on research from before it was asked. */
  formatState?: EpisodeFormatState | null;
  /** Every page research read, with the dates the page shows (as printed; ISO when it gave a time).
   *  The record of how soon after airing recaps appear. Absent on research from before it was asked. */
  sourcesRead?: { url: string; published: string | null; updated: string | null }[];
  castaways: ResearchCastaway[];
  /** The leagues' open side bets this research settled (absent when it wasn't asked any). */
  betAnswers?: BetAnswer[];
  /** Episode-level questions, per format (Survivor: tribalCouncilHeld). */
  [question: string]: unknown;
}

/** The format section of an episode's research (F2): the groups at the episode's END, going into the next one. */
export interface EpisodeFormatState {
  playedAs: "everyone" | "tribes" | "teams" | "pairs" | "individuals" | "mixed" | "none" | "unknown";
  phase: string | null;
  /** Who is with whom; [] everyone for themselves (or as one); null not known. */
  groups: { name: string | null; members: string[] }[] | null;
  alone: string[];
  newcomers: { name: string; replaces: string | null; group: string | null }[];
  wentHomeAs: "individuals" | "groups" | "nobody" | "unknown";
  changes: {
    kind: "teams-formed" | "pairs-formed" | "split-into-individuals" | "merge" | "swap" | "newcomer" | "new-phase" | "twist" | "role";
    when: "start" | "mid" | "end" | null;
    from: number | null;
    what: string;
    sure: "high" | "low";
  }[];
}

/**
 * A commissioner's episode research (docs/PLAN-episode-research-compiled-cache.md): who an episode's
 * stored research already settles among the people the league's checklist would ask about. Medium or
 * high confidence is settled; low, or no entry, is asked again.
 */
export interface ResearchCoverage {
  /** False when the episode has no stored research for this show's format. */
  researched: boolean;
  researchedAt: string | null;
  total: number;
  covered: string[];
  lowConfidence: string[];
  missing: string[];
  /** missing + lowConfidence: who a paste would be asked about. Empty means nothing to paste. */
  needsAsking: string[];
}

/** Every kind season_decisions holds: research stages the first four, the wiki also stages tribe moves; `noexit` is
 *  "nobody went home" (step 6c), with no castaway. */
export type ResearchDecisionKind = "elimination" | "event" | "exiled" | "role" | "group" | "noexit";

/** One staged season decision for an episode, as the commissioner's research panel shows and edits it. */
export interface StagedResearchDecision {
  id: string;
  kind: ResearchDecisionKind;
  castawayName: string;
  /** elimination: an exit method; role: the role; group: the tribe moved to ("" for none). */
  method: string;
  /** event: the scoring event id. */
  eventType: string;
  juryVotes: number | null;
  /** event: how many it counts for, when research reported a count (0106: 3 home runs). */
  units?: number | null;
  confidence: "high" | "medium" | "low";
  sources: string[];
  /** The admin's season-wide decision, for information only -- the commissioner's apply ignores it. */
  status: "pending" | "accepted" | "rejected";
  fromWiki: boolean;
  fromResearch: boolean;
  postMerge: boolean;
  /** Already in this league's state (by whichever path, or entered by hand). */
  inLeague?: boolean;
  /** This league's own name for the person, resolved through the season cast link (else the staged name). */
  leagueName?: string;
  /** An admin corrected the row (season_decisions.applied): the values above are the corrected ones. */
  corrected?: boolean;
  /** The community's status (db/migrations/0112): null for a result staged before it and never reviewed. */
  factStatus?: "reported" | "confirmed" | "disputed" | "canonical" | "removed" | null;
}

/** GET/POST /api/leagues/[leagueId]/episodes/[epId]/research. */
export interface EpisodeResearchPanel {
  episodeNumber: number;
  showName: string;
  season: number;
  coverage: ResearchCoverage;
  /** The JSON paste prompt narrowed to coverage.needsAsking; null when nobody needs asking. */
  prompt: string | null;
  /** The prompt asks about everyone again (research again, to fill gaps), not just who's unsettled. */
  again?: boolean;
  betCount: number;
  staged: StagedResearchDecision[];
  /** POST only: non-fatal notes on the paste (unsourced claims, repaired values). */
  problems?: string[];
}

/** What applying research to one league did. */
export interface ResearchApplySummary {
  eliminations: { name: string; method: string }[];
  events: { name: string; type: string }[];
  other: { name: string; kind: string }[];
  skipped: string[];
  unresolved: string[];
}

/**
 * A search isn't reproducible, so there's no revision id to point at the way a wiki extraction has.
 * This is the substitute, and it's what a reviewer checks against -- not optional metadata.
 */
export interface EpisodeResearchProvenance {
  provider: string;
  /** Null only for a JSON paste, which no model touched. */
  model: string | null;
  /** 1 when the provider searched and answered in one call, 2 when it had to structure separately. */
  passes: number;
  researchedAt: string;
  showSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  /** The show format whose checklist was asked. Absent on research from before formats (Survivor). */
  format?: string;
  castFrom: "season" | "league";
  castAsked: string[];
  queries: string[];
  /** Every page the search actually fetched, read off the response -- not what the model claims. */
  pagesRead: string[];
  usage?: ModelUsage;
  /** Already out before this episode, so not asked about. */
  castSkipped?: string[];
  /** The sites search was limited to. */
  domains?: string[];
  /** Sites that refused Anthropic's search crawler this run, so were dropped. */
  domainsBlocked?: string[];
  problems?: string[];
  /** provider:"paste" only -- what the admin actually pasted, since there's no page URL list to check against instead. */
  pastedNotes?: string;
  /** provider:"paste" only -- "json" was parsed directly (free, model null); "text" went through a structuring call. */
  pasteMode?: "json" | "text";
}

// ---------- season decisions (db/migrations/0019) ----------
// Episode results decided once per season by an admin, and applied to every league automatically.

/** What one read (a wiki pull or a research run) staged for review. */
export interface DecisionStageResult {
  /** New rows awaiting a decision. */
  inserted: number;
  /** Existing rows this read also reported (pending ones refreshed; decided ones left decided). */
  updated: number;
  /** Pending rows this source proposed before but no longer does, so removed. */
  withdrawn: number;
  total?: number;
  summary?: string;
  /** Names the source used that the season's cast doesn't have; those results were dropped. */
  unmatched?: string[];
  dropped?: { name: string; episode: number; why: string }[];
  dry?: boolean;
}

export type DecisionStatus = "pending" | "accepted" | "rejected";

export interface SeasonDecision {
  id: string;
  episode_number: number;
  post_merge: boolean;
  kind: "elimination" | "event" | "exiled" | "role" | "group" | "noexit";
  castaway_name: string;
  /**
   * The exit method for an elimination; the role value ("Traitor") for a role; the new tribe/team's
   * name for a group change ("" = no group now).
   */
  method: string;
  event_type: string;
  /** A finalist elimination's jury votes received (0036), when research found them. */
  jury_votes?: number | null;
  /** An event's count (0106), when research reported one: 3 home runs. Postgres NUMERIC, so text. */
  units?: string | null;
  confidence: "high" | "medium" | "low";
  from_wiki: boolean;
  from_research: boolean;
  sources: string[];
  status: DecisionStatus;
  /** What was actually committed when an admin corrected it before accepting. */
  applied: { castawayName?: string; method?: string; eventType?: string } | null;
  decided_at: string | null;
  /** Display name of whoever decided it. */
  decided_by_name: string | null;
  created_at: string;
  /** How many leagues this accepted decision has been applied to so far. */
  applied_leagues: number;
  /** League-decided seasons only (curator mode): the leagues that already have this result. */
  in_leagues?: string[];
}

/** One league's result from applying the season's accepted decisions. */
export interface LeagueDecisionSync {
  leagueId: string;
  leagueName: string;
  applied: number;
  undone: number;
  /** Accepted decisions that couldn't be applied here (a name this league's cast lacks). */
  skipped: { name: string; why: string }[];
  error?: string;
}

// Commissioner view of a show (GET /api/shows): non-archived only, no admin-only fields.
export interface CatalogShow {
  slug: string;
  name: string;
  castaway_term: string;
  tribe_term: string;
  /** Tile image (migration 0051); null falls back to a plain tile with the show's name. */
  art_url: string | null;
  /** How the art looks behind Overview's header (migration 0056); null is the default look. */
  art_style?: ArtStyle | null;
  /** Added by an admin rather than researched by a user (shows.created_by is null). */
  curated?: boolean;
  /** Researched by the signed-in user. */
  mine?: boolean;
  seasons: Pick<ShowSeason, "seasonNumber" | "name" | "status" | "castSize" | "premiereDate" | "finaleDate" | "resultsBy">[];
}

/**
 * One episode in a per-episode proposal (StateLogic.applyEliminationsImport). Keyed by NUMBER, not id: a proposal can sit
 * while the league changes, and a stale name fails to resolve and gets reported where a stale id would apply wrong.
 */
export interface ProposalEpisode {
  number: number;
  postMerge: boolean;
  title?: string | null;
  airDate?: string | null;
  eliminations?: { name: string; method: string }[];
  /**
   * Someone sent away from their tribe this episode by an Exile Island-style twist -- still in the
   * game, not eliminated. Informational only: never applied to league state (see
   * EpisodeLogic.applyEliminationsImport), it exists so the wiki extraction has somewhere valid to
   * put this instead of it bleeding into `eliminations`.
   */
  exiled?: string[];
  /**
   * `confidence` is 'high' only where the wiki states it outright. Immunity/reward inference, anything
   * read through a footnote marker, and any counted zero-votes-safe come back 'low' -- the review UI
   * distinguishes them rather than presenting all events alike.
   */
  events?: { name: string; type: string; confidence: "high" | "low" }[];
}

export interface EpisodeProposalPayload {
  episodes: ProposalEpisode[];
  mergeEpisode?: number | null;
  /** Non-fatal extraction notes worth a commissioner's attention before applying -- see validateEpisodes in db/wiki-sync.js. */
  problems?: string[];
}

export interface BlindDraftState {
  lockedPlayerIds: string[];
  revealedAt: string | null;
  /** Under a salary cap (step A10 part 3c): what each team cost at the reveal (a stock market's cash reads it). */
  paid?: Record<string, number>;
}

/** One pick of a turn-based draft, in its own log (state-logic.js SnakeDraftStrategy.pick). */
export interface DraftLogEntry {
  /** The overall pick it was made at (1-based). */
  n: number;
  playerId: string;
  castawayId: string;
  at: string;
  /** The account that made it for them (a commissioner or Game admin). */
  by?: string;
  /** The pick timer ran out and it came from their queue. */
  auto?: boolean;
  /** A10 part 3: dealt by a draw (names out of a hat), nobody's pick. */
  drawn?: boolean;
  /** A10 part 3b: what it cost (a snake pick under a salary cap, an auction's winning bid; part 3c: a draw's under a cap). */
  price?: number;
  /** A10 part 3b: an auction's place the bids didn't fill, filled at the lowest price. */
  filled?: boolean;
}

// A completed pickup (replenish) or add/drop (trade): Transactions. MidSeasonLogic.applyPickup /
// applyAddDrop append one of these; only Undo last waiver run and the spoiler views take one back.
export interface MidSeasonLogEntry {
  id: string;
  type: "replenish" | "trade";
  playerId: string;
  addedCastawayId: string;
  droppedCastawayId: string | null;
  at: string;
  /** The most recent episode with results as of the transaction (state-logic.js's
   * lastCompletedEpisode) -- what the move is really tied to, not a raw timestamp. Null/absent on
   * entries from before this existed, or if nothing had aired yet. */
  episode?: number | null;
  /** Waivers (docs/PLAN-midseason-waivers.md): how it was made -- processed claims, free agency, or
   * assigned when a pickup was still unfilled at airtime. Absent on live-round moves. */
  via?: "waivers" | "freeAgency" | "auto";
  /** The waiver week it belongs to. */
  periodId?: string;
  /** A stock market (step A10 part 3c): what the move sold for and paid, at the prices then, and its fee (the cash ledger). */
  sold?: number;
  paid?: number;
  fee?: number;
  /** The castaway fields the move overwrote, as they were (only keys they had), so it can be undone
   * exactly (MidSeasonLogic.revert). */
  prev?: {
    added: { acquiredVia?: string | null };
    dropped: { replenishClaimed?: boolean; formerOwnerId?: string | null; departedVia?: string | null } | null;
  };
}

export type ReplaceRule = "always" | "whenShort" | "windows" | "never";
export type WaiverFeel = "casual" | "balanced" | "competitive";
export interface WaiverWindows {
  schedule: "everyEpisode" | "every" | "manual";
  /** With schedule "every": a window after every this many episodes (2 or more). */
  every: number;
  /** Swaps each player may make per window: 0 up to the roster size ("Whole team"). */
  swaps: number;
}

/** Why a claim further up someone's list didn't go through. */
export interface WaiverPass {
  castawayId: string;
  /** ahead: someone higher in the waiver order took them; yours: your own earlier claim landed them;
   * gone: not a free agent by then; pickupFirst: pre-v2 runs only (pickups went before add/drops); cap: it would have taken the
   * team past its salary cap (step A10 part 3b); cash: a stock market's, not enough cash for it (part 3c). */
  reason: "ahead" | "pickupFirst" | "yours" | "gone" | "cap" | "cash";
  byPlayerId?: string;
}

/**
 * One move (or one that didn't happen) in a waiver run, and why. kind "pickup" is a replacement (the drop
 * was out of the game), "addDrop" a swap (still in): the names are pre-v2's.
 */
export interface WaiverResult {
  playerId: string;
  kind: "pickup" | "addDrop";
  /** noClaim: nothing in by the deadline; skipped: claims in, but no add/drop this week. */
  outcome: "got" | "missed" | "noClaim" | "skipped";
  castawayId?: string;
  droppedCastawayId?: string | null;
  /** Which choice it was among their pairs for the same drop, 1-based. */
  choice?: number;
  /** The round of the run it went through in (everyone's first pair, then everyone's next...). */
  round?: number;
  passed: WaiverPass[];
  txId?: string;
  /** The add/drop's drop wasn't theirs or still in the game by then. */
  dropGone?: boolean;
}

export interface WaiverRun {
  at: string;
  by: "schedule" | "commissioner";
  orderBefore: string[];
  orderAfter: string[];
  results: WaiverResult[];
}

/** One waiver week (StateLogic.WaiverLogic): opened by an episode's results, closed when the next airs. */
export interface WaiverPeriod {
  id: string;
  /** The episode whose results opened it. */
  episode: number;
  openedAt: string;
  processAt: string | null;
  /** When free agency ends (the next episode airs); null = when the next episode's results arrive. */
  closesAt: string | null;
  phase: "open" | "processed" | "closed";
  /** A waiver window: swaps allowed (see swaps), and replacements under replaceRule "windows". */
  window?: boolean;
  /** Swaps each player may make this week (0 outside a window). */
  swaps?: number;
  /** This window's own say on replacements (Open a waiver window's toggle); unset: the league's rule decides. */
  replace?: boolean;
  /** The commissioner opened or changed this window (Open a waiver window). */
  openedBy?: "commissioner";
  /** The commissioner turned the window off and nothing else ran this week: closed without a run. */
  turnedOff?: boolean;
  /** Pre-v2: whether it allows swaps (swaps > 0). Kept in step for one release. */
  addDrop: boolean;
  /** After Undo last waiver run: no scheduled processing (Process now, or at airtime). */
  hold?: boolean;
  /** Who has a claim saved: the public mirror of the private waiver_claims table. */
  claimsIn: string[];
  /** Who the commissioner has nudged this week (one Nudge each). */
  nudged?: string[];
  run: WaiverRun | null;
  /** Log entry ids of pickups assigned automatically at close. */
  autoFills: string[];
  /** Set on a viewer's copy only: an episode they haven't revealed opened it, so it's blanked. */
  hidden?: boolean;
}

/** "Add X, drop Y": one ranked line of a claim. Dropping someone out of the game replaces them; still in, swaps them. */
export interface WaiverPair {
  addId: string;
  dropId: string;
}

/**
 * One player's private claim (never in league state; GET /waivers returns your own): ranked pairs, and
 * for one release the pre-v2 view of them (pickupIds: the replacements' adds; dropId/addIds: the first
 * swap's drop and its adds).
 */
export interface WaiverClaim {
  pairs: WaiverPair[];
  pickupIds: string[];
  dropId: string | null;
  addIds: string[];
}

/** WaiverLogic.recommend's answer: settings to write, or why the teams can't be drafted from the cast. */
export type WaiverRecommendation =
  | {
      feasible: true;
      /** Free agents per drafted spot, minus one (the plan's s). */
      s: number;
      /** Undrafted castaways at the start (exclusive); null when shared. */
      freeAgents: number | null;
      settings: {
        replaceRule: ReplaceRule;
        replenishAt: number;
        waiverWindows: WaiverWindows;
        waiverProcessHours: number;
        replenishOrderBy: "rolling" | "leastPoints";
        freeAgencyEnabled: boolean;
        autoFill: boolean;
        waiverFeel: WaiverFeel;
      };
    }
  | { feasible: false; need: number; have: number };

export interface LeagueState {
  players: Player[];
  tribes: Tribe[];
  castaways: Castaway[];
  episodes: Episode[];
  finalePredictions: FinalePrediction[];
  finaleActual: { top3: (string | null)[]; winner: string | null };
  midSeason: {
    log: MidSeasonLogEntry[];
    /** The rolling waiver order (player ids, first = first dibs). Absent until a week processes. */
    priority?: string[];
    /** Waivers: every waiver week, oldest first. */
    waivers?: { periods: WaiverPeriod[] };
  };
  draftOrder: string[];
  draftPicksMade: number;
  draftForceStarted: boolean;
  /** When the draft was opened by hand, and when the turn now on the clock began (each pick and take-back stamps it). */
  draftStartedAt?: string;
  draftTurnAt?: string;
  /** The turn-based draft's picks in order; drafts from before it have none. */
  draftLog?: DraftLogEntry[];
  /** Whoever runs the game nudged the player on the clock (one per turn: the next pick clears it). */
  draftNudge?: { n: number; at: string; by: string };
  blindDraft: BlindDraftState;
  /** A10 part 3: a draw (state-logic.js DrawLogic), once drawn: its seed (the same seed deals the same teams), when, the order it
   *  dealt in, and the seats it came up short for (an exclusive hat that ran out). */
  draw?: { seed: string; at: string; order: string[]; short: string[] };
  /** A10 part 3b: an auction (state-logic.js AuctionLogic): who has locked in their sealed bids (the bids themselves are kept out
   *  of the state, in blind_draft_picks, as a blind draft's picks are), and once it's settled, when, its seed (the tie-break), the
   *  order it filled in, what each seat spent, and the seats it left short. */
  auction?: { lockedPlayerIds: string[]; at?: string; seed?: string; order?: string[]; spent?: Record<string, number>; short?: string[] };
  /** A10 part 4: keepers from last season's game (state-logic.js KeeperLogic): each seat's options (the server's, keepers.ts) best
   *  first, the keepers it named (by: the account that named them), and once they lock at the draft's start, what each kept. */
  keepers?: {
    options: Record<string, string[]>;
    chosen: Record<string, { ids: string[]; at: string; by?: string }>;
    kept?: Record<string, { castawayId: string; price?: number }[]>;
    at?: string;
  };
  /** A game that asks by phase (step A7, StateLogic.settlePhases): the season's phase starts it plays by, and where each later
   *  phase's window of questions opens. */
  phaseStarts?: Record<string, number>;
  phaseWindows?: Record<string, number>;
  settings: LeagueSettings;
}

export interface Notif {
  id: string;
  text: string;
  ts: number;
  tab: string;
  kind?: "bet-guess";
  betId?: string;
}

export interface Report {
  id: string;
  user_id: string;
  username: string;
  league_id: string | null;
  league_name: string | null;
  type: "issue" | "feature";
  message: string;
  route: string | null;
  created_at: string;
}

export interface ChatReaction {
  count: number;
  userIds: string[];
}

/** How far one league member has read chat (null = never opened it). */
export interface ChatRead {
  userId: string;
  /** Their player in the league being viewed; null when they're only in a linked league. */
  playerId: string | null;
  lastReadAt: string | null;
  /** Their account name, for anyone who isn't a player in the league being viewed. */
  name?: string | null;
}

export interface ChatMessage {
  id: string;
  user_id: string | null;
  author_name: string;
  /** "system": the retired automated result lines (no longer shown). "reveal": "conor revealed episode 9". */
  type: "message" | "system" | "reveal";
  text: string;
  created_at: string;
  edited_at: string | null;
  reactions: Record<string, ChatReaction>;
}

export interface ScoreRow {
  playerId: string;
  name: string;
  color: string;
  /** The league type's core score. Classic: every owned castaway's points so far (still in included). */
  locked: number;
  /** Classic only: the part of `locked` from castaways already out (final, can't change). */
  banked?: number;
  bonus: number;
  finale: number;
  total: number;
  roster: Castaway[];
  formerRoster: Castaway[];
  /** Pick'em only: the longest run of correct picks (what players are ranked by), and the run now. */
  longestStreak?: number;
  currentStreak?: number;
  /** A pool with lives, a buyback, mulligans or a second pick (step A10 part 2): lives left (null without lives), the episode
   *  they went out in for good (null while in), mulligans and buybacks left. */
  lives?: number | null;
  out?: number | null;
  mulligans?: number;
  buybacks?: number;
  /** A stock market (step A10 part 3c): cash, and worth (cash plus the team at today's prices: what it ranks by, rank worth). */
  cash?: number | null;
  worth?: number;
}

export interface DraftTurn {
  isComplete: boolean;
  playerId?: string;
  personalPickNumber?: number;
  overallPickNumber?: number;
}

// A row of league_invites as League Settings shows it (GET /api/leagues/[leagueId]/invites) --
// `identifier` is whatever the inviter typed (username or email), not resolved to an account.
export interface LeagueInvite {
  id: string;
  identifier: string;
  status: "pending" | "accepted" | "declined";
  invited_by: string;
  invited_by_username: string | null;
  created_at: string;
  responded_at: string | null;
  /** Set when the invite hands over a particular seat (a computer player, say) rather than adding one. */
  player_id: string | null;
}

// A pending invite addressed to the signed-in user, as the Dashboard shows it (GET /api/me/invites).
export interface MyInvite {
  id: string;
  league_id: string;
  league_name: string;
  invited_by_username: string | null;
  created_at: string;
  /** The seat they'd take over, when the invite hands one over (league_invites.player_id). */
  seat_name: string | null;
}
