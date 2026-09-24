// Hand-written types for the league state shape produced/consumed by state-logic.js.
// state-logic.js itself stays plain, untyped JS (forked from the live app — see the provenance
// note at its top) so these are a best-effort description of its actual shape, not a source of
// truth generated from it.

export interface Player {
  id: string;
  name: string;
  color: string;
  disabled?: boolean;
  active?: boolean;
  // Set by disablePlayer so the same account can reclaim the seat on rejoin (reclaimPlayer).
  formerName?: string;
  disabledFromUserId?: string;
}

export interface Tribe {
  id: string;
  name: string;
  color: string;
}

export interface Castaway {
  id: string;
  name: string;
  tribeId: string;
  // Every league type uses this array, never a scalar owner -- exclusive-ownership leagues are
  // just the case where it never exceeds length 1 (see Core's ownership helpers in state-logic.js).
  ownerIds: string[];
  photoUrl?: string;
  status: "active" | "eliminated";
  placementOrder?: number;
  exitMethod?: string;
  exitEpisodeId?: string;
  replenishClaimed?: boolean;
  acquiredVia?: "draft" | "replenish" | "trade" | null;
  formerOwnerId?: string | null;
  departedVia?: "replenish" | "trade" | null;
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

// Active Roster: one point-earning occurrence in an episode. Deliberately NOT stored in
// Episode.events, which already means eliminations -- see ActiveRosterLogic.addEvent's note.
export interface ScoringEvent {
  id: string;
  /** One of ACTIVE_ROSTER_EVENTS' ids (state-logic.js). */
  type: string;
  castawayId: string;
}

export interface PickEmPick {
  playerId: string;
  castawayId: string;
}

export interface Episode {
  id: string;
  number: number;
  postMerge: boolean;
  /**
   * Both optional and both filled in only by the wiki connector's eliminations import, which gets them
   * for free off the episode guide. Never overwritten once set, and absent on every hand-created
   * episode -- the Episode Card renders them when present and omits them otherwise.
   */
  title?: string | null;
  airDate?: string | null;
  events: { castawayId: string; method: string }[];
  /**
   * Who an Exile Island-style twist sent away from their tribe this episode. Still in the game --
   * this is a RECORD, not a mechanic: nothing in ScoringLogic or ActiveRosterLogic reads it, and it
   * changes no owner, tribe or placement. See EpisodeLogic.addExiled for why it's kept inert.
   * Always present (EpisodeLogic.create initializes it, migrateLeagueState backfills old saves).
   */
  exiled: { castawayId: string; at: string }[];
  bets: Bet[];
  // Pick'em only (state-logic.js's PickEmLogic) -- one entry per player who's made a pick for
  // this episode, upserted in place rather than accumulated. Always present (EpisodeLogic.add
  // initializes it, migrateLeagueState backfills it on old saves) but only ever populated for a
  // 'pickem' league.
  picks: PickEmPick[];
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
}

export interface FinalePrediction {
  playerId: string;
  top3: (string | null)[];
  winner: string | null;
}

export interface LeagueSettings {
  teamSize: number;
  bonusEnabled: boolean;
  replenishOrderBy: "mostPoints" | "leastPoints";
  // Optional mid-season mechanics, both default false. Gated together with the league type's own
  // capability -- see replenishAvailable/tradeAvailable in state-logic.js.
  replenishEnabled: boolean;
  tradeEnabled: boolean;
  defaultBetPoints: number;
  // Same opt-in shape as replenishEnabled/tradeEnabled above, gated together with the league
  // type's own supportsFinalePredictions -- see finalePredictionsAvailable in state-logic.js.
  finalePredictionsEnabled: boolean;
  finaleTop3Points: number;
  finaleWinnerPoints: number;
  finalePredictionScope: string;
  draftScheduledAt?: string | null;
  leagueTypeId: string;
  /** The catalog show's slug. Null on a new league until the commissioner picks one. */
  showId: string | null;
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
  benchSlots: number;
  /** Points per scoring-event type, keyed by ACTIVE_ROSTER_EVENTS id. 0 switches a category off. */
  eventPoints: Record<string, number>;
  // Pick'em only, defaulted for every league regardless of type (see defaultState's comment) --
  // points awarded for a correct weekly pick.
  pickemCorrectPoints: number;
}

export interface Membership {
  role: "member" | "commissioner";
  playerId: string | null;
}

export interface ReplenishTurn {
  isComplete: boolean;
  playerId?: string;
  personalPickNumber?: number;
  overallPickNumber?: number;
  scoreAtStart?: number;
}

export interface TradeState {
  queue: { playerId: string }[];
  index: number;
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
  premiereDate: string | null;
  finaleDate: string | null;
}

// Admin view of a show: everything, including archived ones and how many leagues reference it.
export interface AdminShow {
  id: string;
  slug: string;
  name: string;
  castaway_term: string;
  tribe_term: string;
  wiki_api_url: string | null;
  /** Override for which wikitext section holds the cast. Null = wiki-sync infers it. */
  cast_section_heading: string | null;
  archived: boolean;
  created_at: string;
  league_count: number;
  seasons: ShowSeason[];
}

// Commissioner view of a show (GET /api/shows): non-archived only, no admin-only fields.
export interface CatalogShow {
  slug: string;
  name: string;
  castaway_term: string;
  tribe_term: string;
  seasons: Pick<ShowSeason, "seasonNumber" | "name" | "status" | "castSize" | "premiereDate" | "finaleDate">[];
}

// A reviewed-but-unapplied suggestion from the wiki connector (db/wiki-sync.js), as the League
// Settings review UI shows it. Lives in its own table, not in league state -- see
// db/migrations/0005_wiki_proposals.sql.
/**
 * What applying a proposal did. One variant per proposal kind -- they genuinely report different
 * things, so the review UI narrows on the `kind` the apply response carries rather than treating them
 * as one shape. All three have a `skipped` list, because all three are additive.
 */
export type AppliedProposal =
  | { tribes: string[]; castaways: string[]; skipped: string[] }
  | {
      episodesCreated: number[];
      eliminations: { episode: number; name: string; method: string }[];
      skipped: string[];
      unresolved: string[];
    }
  | {
      episodesCreated: number[];
      events: { episode: number; name: string; type: string }[];
      skipped: string[];
      unresolved: string[];
    };

/** Cast-import payload: the whole season's cast and its starting groups. */
export interface CastProposalPayload {
  tribes?: { name: string; color?: string }[];
  castaways?: { name: string; tribeName?: string | null; photoUrl?: string | null }[];
}

/** One episode in a per-episode proposal. Keyed by NUMBER, not id -- see WikiProposal's comment. */
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

/**
 * A reviewed-but-unapplied suggestion from the wiki connector.
 *
 * Payloads reference castaways and episodes BY NAME and BY NUMBER rather than by id, deliberately: a
 * proposal can sit pending while the league changes, and a stale id would apply silently wrong where a
 * stale name simply fails to resolve and gets reported. Resolution happens at apply time, through
 * Core.findCastawayByName.
 */
export interface WikiProposal {
  id: string;
  kind: "cast" | "scoringEvents" | "eliminations";
  status: "pending" | "applied" | "rejected";
  payload: CastProposalPayload & Partial<EpisodeProposalPayload>;
  provenance: {
    seasonNumber: number;
    showSlug?: string;
    model: string;
    extractedAt: string;
    pages: { title: string; revisionId: number | null }[];
    castSection?: string;
    sections?: string[];
  };
  created_at: string;
}

/**
 * One pending decision from the wiki connector's per-episode fan-out (db/migrations/0009) -- an
 * elimination, a scoring event, or an exile, each accepted/rejected/edited on its own rather than
 * as part of a whole-payload proposal like WikiProposal above. Rendered in the Episode Card's
 * "Reveal Outcome" section, grouped by episode_number.
 */
export interface WikiProposalItem {
  id: string;
  episode_number: number;
  post_merge: boolean;
  kind: "elimination" | "event" | "exiled";
  castaway_name: string;
  /** Elimination only (an EXIT_METHODS value); '' for other kinds. */
  method: string;
  /** Event only (an EVENT_TYPES value); '' for other kinds. */
  event_type: string;
  /** Event only, meaningless for the other two kinds (which are always read off a stated column). */
  confidence: "high" | "low";
  created_at: string;
}

export interface BlindDraftState {
  lockedPlayerIds: string[];
  revealedAt: string | null;
}

// A completed replenish assignment or trade swap, for the visual history shown under each
// panel -- ReplenishLogic.assign/TradeLogic.swap append one of these, never mutate/remove them.
export interface MidSeasonLogEntry {
  id: string;
  type: "replenish" | "trade";
  playerId: string;
  addedCastawayId: string;
  droppedCastawayId: string | null;
  at: string;
}

export interface LeagueState {
  players: Player[];
  tribes: Tribe[];
  castaways: Castaway[];
  episodes: Episode[];
  finalePredictions: FinalePrediction[];
  finaleActual: { top3: (string | null)[]; winner: string | null };
  midSeason: {
    replenish: { sequence: unknown[]; index: number } | null;
    trade: TradeState | null;
    log: MidSeasonLogEntry[];
  };
  draftOrder: string[];
  draftPicksMade: number;
  draftForceStarted: boolean;
  blindDraft: BlindDraftState;
  settings: LeagueSettings;
}

// Shaped by Better Auth's user model (+ the admin/username plugins) now, not a custom `users`
// table -- no must_change_password concept exists there, so admin-created accounts' temp
// passwords are just shown once in the UI, same security property, simpler mechanism.
export interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  // Newest Better Auth session row's createdAt -- null if they've never signed in (or every
  // session has since been cleaned up).
  lastLoginAt: string | null;
}

export interface AdminLeague {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  created_at: string;
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

export interface AdminMembership {
  id: string;
  player_id: string;
  role: "member" | "commissioner";
  user_id: string;
  username: string;
}

export interface ChatReaction {
  count: number;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  user_id: string | null;
  author_name: string;
  type: "message" | "system";
  text: string;
  created_at: string;
  edited_at: string | null;
  reactions: Record<string, ChatReaction>;
}

export interface ScoreRow {
  playerId: string;
  name: string;
  color: string;
  locked: number;
  bonus: number;
  finale: number;
  total: number;
  roster: Castaway[];
  formerRoster: Castaway[];
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
}

// A pending invite addressed to the signed-in user, as the Dashboard shows it (GET /api/me/invites).
export interface MyInvite {
  id: string;
  league_id: string;
  league_name: string;
  invited_by_username: string | null;
  created_at: string;
}
