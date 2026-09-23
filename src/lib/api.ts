import type { LeagueState, Membership, ChatMessage, AdminUser, AdminLeague, AdminMembership, Player, Report } from "@/lib/game/types";

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
  impersonating: boolean;
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
  logout: () => apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  stopImpersonating: () => apiFetch<{ ok: true }>("/api/auth/stop-impersonating", { method: "POST" }),
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

  // Chat lives in its own Postgres tables (chat_messages/chat_reactions), not the JSONB league
  // state, so these return their own shapes rather than a LeagueState.
  getChat: (leagueId: string) => apiFetch<{ messages: ChatMessage[] }>(`/api/leagues/${leagueId}/chat`),
  sendChatMessage: (leagueId: string, text: string) =>
    apiFetch<{ message: ChatMessage }>(`/api/leagues/${leagueId}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  editChatMessage: (leagueId: string, messageId: string, text: string) =>
    apiFetch<{ message: ChatMessage }>(`/api/leagues/${leagueId}/chat/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),
  deleteChatMessage: (leagueId: string, messageId: string) =>
    apiFetch<{ ok: true }>(`/api/leagues/${leagueId}/chat/${messageId}`, { method: "DELETE" }),
  reactToChatMessage: (leagueId: string, messageId: string, emoji: string) =>
    apiFetch<{ ok: true }>(`/api/leagues/${leagueId}/chat/${messageId}/react`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),

  // Admin routes -- superAdmin-only server-side (requireSuperAdmin), cross-league scope (not
  // the per-league LeagueState everything else here reads/writes).
  adminListUsers: () => apiFetch<{ users: AdminUser[] }>("/api/admin/users"),
  adminCreateUser: (username: string) =>
    apiFetch<{ user: { id: string; username: string }; tempPassword: string }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  adminResetPassword: (userId: string) =>
    apiFetch<{ user: { id: string; username: string }; tempPassword: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
    }),
  adminUserLeagues: (userId: string) => apiFetch<{ leagues: { id: string; name: string; role: string }[] }>(`/api/admin/users/${userId}/leagues`),
  adminDeleteUser: (userId: string) => apiFetch<{ ok: true }>(`/api/admin/users/${userId}`, { method: "DELETE" }),
  adminImpersonate: (userId: string) =>
    apiFetch<{ ok: true; username: string }>(`/api/admin/users/${userId}/impersonate`, { method: "POST" }),

  adminListLeagues: () => apiFetch<{ leagues: AdminLeague[] }>("/api/admin/leagues"),
  adminDeleteLeague: (leagueId: string) => apiFetch<{ ok: true }>(`/api/admin/leagues/${leagueId}`, { method: "DELETE" }),
  adminLeagueMemberships: (leagueId: string) =>
    apiFetch<{ players: Player[]; memberships: AdminMembership[] }>(`/api/admin/leagues/${leagueId}/memberships`),
  adminLinkMembership: (leagueId: string, userId: string, playerId: string, role: "member" | "commissioner") =>
    apiFetch<{ membership: AdminMembership }>(`/api/admin/leagues/${leagueId}/memberships`, {
      method: "POST",
      body: JSON.stringify({ userId, playerId, role }),
    }),
  adminUnlinkMembership: (leagueId: string, membershipId: string) =>
    apiFetch<{ ok: true }>(`/api/admin/leagues/${leagueId}/memberships/${membershipId}`, { method: "DELETE" }),
  adminDeletePlayer: (leagueId: string, playerId: string) =>
    apiFetch<{ ok: true; player: Player }>(`/api/admin/leagues/${leagueId}/players/${playerId}`, { method: "DELETE" }),

  // League Settings -- commissioner-only server-side (requireLeagueRole('commissioner') on every
  // route in server/routes/roster.js), same generic field/value PATCH pattern as updateEpisode.
  renameLeague: (leagueId: string, name: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  updateLeagueSettings: (leagueId: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  addPlayer: (leagueId: string, name: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/players`, { method: "POST", body: JSON.stringify({ name }) }),
  updatePlayer: (leagueId: string, id: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removePlayer: (leagueId: string, id: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}`, { method: "DELETE" }),
  activatePlayer: (leagueId: string, id: string, castawayIds: string[]) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ castawayIds }),
    }),
  addTribe: (leagueId: string, name: string, color: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/tribes`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),
  updateTribe: (leagueId: string, id: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/tribes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeTribe: (leagueId: string, id: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/tribes/${id}`, { method: "DELETE" }),
  addCastaway: (leagueId: string, name: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/castaways`, { method: "POST", body: JSON.stringify({ name }) }),
  updateCastaway: (leagueId: string, id: string, field: string, value: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/castaways/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeCastaway: (leagueId: string, id: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/castaways/${id}`, { method: "DELETE" }),
  // Whole-state replace -- the raw parsed JSON of a previously-exported backup, migrated
  // server-side (StateLogic.migrateLeagueState) before being saved.
  importLeagueState: (leagueId: string, raw: unknown) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/import`, { method: "POST", body: JSON.stringify(raw) }),
  resetLeague: (leagueId: string) =>
    apiFetch<LeagueState>(`/api/leagues/${leagueId}/reset`, { method: "POST" }),
  leaveLeague: (leagueId: string) =>
    apiFetch<{ ok: true }>(`/api/leagues/${leagueId}/leave`, { method: "POST" }),

  adminListReports: () => apiFetch<{ reports: Report[] }>("/api/admin/reports"),
  adminDeleteReport: (id: string) => apiFetch<{ ok: true }>(`/api/admin/reports/${id}`, { method: "DELETE" }),
  // Not admin-gated -- any signed-in SurvivorDraft user can submit one (requireAuth server-side).
  submitReport: (type: "issue" | "feature", message: string, route: string, leagueId: string | null, leagueName: string | null) =>
    apiFetch<{ ok: true }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ type, message, route, leagueId, leagueName }),
    }),
};
