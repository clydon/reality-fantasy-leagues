import type { LeagueState, Membership } from "@/lib/game/types";

// Thin fetch wrapper for the live Express API (see SurvivorDraft/server/routes/*.js). Requires
// that API's dev-only CORS middleware (server/index.js) to be running and configured to allow
// this app's origin -- see that repo's README/CLAUDE.md. `credentials: "include"` sends the
// session cookie; the API's CORS config must echo back this exact origin with
// `credentials: true` (not "*") for the browser to accept it.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8934";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface MeResponse {
  user: { id: string; username: string; isSuperAdmin: boolean };
  leagues: { id: string; name: string; join_code: string; role: string }[];
}

export interface LeagueStateResponse {
  league: { id: string; name: string };
  membership: Membership;
  state: LeagueState;
  playerAccounts: { player_id: string; role: string; username: string }[];
}

// Mutation routes below return the raw updated LeagueState directly (res.json(state)), not
// wrapped in an envelope -- matches server/routes/episodes.js exactly, same contract app.js uses.
export const api = {
  login: (username: string, password: string) =>
    apiFetch<{ user: MeResponse["user"] }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch<MeResponse>("/api/auth/me"),
  leagueState: (leagueId: string) =>
    apiFetch<LeagueStateResponse>(`/api/leagues/${leagueId}/state`),

  proposeBet: (leagueId: string, epId: string, label: string, points: number) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets`, {
      method: "POST",
      body: JSON.stringify({ label, points }),
    }),
  removeBet: (leagueId: string, epId: string, betId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}`, { method: "DELETE" }),
  addBetPrediction: (leagueId: string, epId: string, betId: string, playerId: string, guess: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions`, {
      method: "POST",
      body: JSON.stringify({ playerId, guess }),
    }),
  setBetPredictionCorrect: (leagueId: string, epId: string, betId: string, predId: string, value: boolean) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions/${predId}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),

  reorderDraft: (leagueId: string, fromIndex: number, toIndex: number) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/draft/order`, {
      method: "POST",
      body: JSON.stringify({ fromIndex, toIndex }),
    }),
  draftPick: (leagueId: string, castawayId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/draft/pick`, {
      method: "POST",
      body: JSON.stringify({ castawayId }),
    }),
  undraft: (leagueId: string, castawayId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/draft/pick/${castawayId}`, { method: "DELETE" }),
  forceStartDraft: (leagueId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/draft/force-start`, { method: "POST" }),

  addEpisode: (leagueId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes`, { method: "POST" }),
  removeEpisode: (leagueId: string, epId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}`, { method: "DELETE" }),
  updateEpisode: (leagueId: string, epId: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  addElimination: (leagueId: string, epId: string, castawayId: string, method: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/eliminations`, {
      method: "POST",
      body: JSON.stringify({ castawayId, method }),
    }),
  removeElimination: (leagueId: string, epId: string, castawayId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/eliminations/${castawayId}`, {
      method: "DELETE",
    }),
  updateBet: (leagueId: string, epId: string, betId: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeBetPrediction: (leagueId: string, epId: string, betId: string, predId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions/${predId}`, {
      method: "DELETE",
    }),

  startReplenish: (leagueId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/start`, { method: "POST" }),
  replenishAssign: (leagueId: string, castawayId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/assign`, {
      method: "POST",
      body: JSON.stringify({ castawayId }),
    }),
  cancelReplenish: (leagueId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/cancel`, { method: "POST" }),

  startTrade: (leagueId: string) => apiFetch<LeagueState>(`/api/leagues/${leagueId}/trade/start`, { method: "POST" }),
  tradeSwap: (leagueId: string, dropId: string, addId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/trade/swap`, {
      method: "POST",
      body: JSON.stringify({ dropId, addId }),
    }),
  tradeSkip: (leagueId: string) => apiFetch<LeagueState>(`/api/leagues/${leagueId}/trade/skip`, { method: "POST" }),
  cancelTrade: (leagueId: string) => apiFetch<LeagueState>(`/api/leagues/${leagueId}/trade/cancel`, { method: "POST" }),

  setFinalePick: (leagueId: string, playerId: string, idx: number, value: string | null) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/finale/predictions/${playerId}`, {
      method: "PATCH",
      body: JSON.stringify({ idx, value }),
    }),
  setFinaleWinnerPick: (leagueId: string, playerId: string, value: string | null) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/finale/predictions/${playerId}/winner`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  setActualTop3: (leagueId: string, idx: number, value: string | null) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/finale/actual/top3`, {
      method: "PATCH",
      body: JSON.stringify({ idx, value }),
    }),
  setActualWinner: (leagueId: string, value: string | null) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/finale/actual/winner`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
};
