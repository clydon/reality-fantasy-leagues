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

export interface Episode {
  id: string;
  number: number;
  postMerge: boolean;
  events: { castawayId: string; method: string }[];
  bets: Bet[];
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
  defaultBetPoints: number;
  finaleTop3Points: number;
  finaleWinnerPoints: number;
  finalePredictionScope: string;
  draftScheduledAt?: string | null;
  leagueTypeId: string;
  showId: string;
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

export interface LeagueState {
  players: Player[];
  tribes: Tribe[];
  castaways: Castaway[];
  episodes: Episode[];
  finalePredictions: FinalePrediction[];
  finaleActual: { top3: (string | null)[]; winner: string | null };
  midSeason: { replenish: { sequence: unknown[]; index: number } | null; trade: TradeState | null };
  draftOrder: string[];
  draftPicksMade: number;
  draftForceStarted: boolean;
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
