// Hand-written types for the league state shape produced/consumed by state-logic.js.
// state-logic.js itself stays plain, untyped JS (verbatim copy from the live app — see the
// provenance note at its top) so these are a best-effort description of its actual shape,
// not a source of truth generated from it.

export interface Player {
  id: string;
  name: string;
  color: string;
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
  ownerId: string | null;
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
  top3: string[];
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
}

export interface Membership {
  role: "member" | "commissioner";
  playerId: string | null;
}

export interface LeagueState {
  players: Player[];
  tribes: Tribe[];
  castaways: Castaway[];
  episodes: Episode[];
  finalePredictions: FinalePrediction[];
  finaleActual: { top3: string[]; winner: string | null } | null;
  midSeason: { replenish: unknown | null; trade: unknown | null };
  draftOrder: string[];
  draftPicksMade: number;
  settings: LeagueSettings;
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
  playerId: string | null;
  personalPickNumber: number;
  isComplete: boolean;
}
