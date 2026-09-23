import type { LeagueState, Membership, ChatMessage, AdminUser, AdminLeague, AdminMembership, Player, Report, LeagueInvite, MyInvite } from "@/lib/game/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// This repo's own backend (src/app/api/*) -- same-origin, no CORS/credentials dance needed. Used
// to be one of two fetch wrappers here (the other, apiFetch, called the live SurvivorDraft
// Express server over CORS) while this repo's backend was built out domain by domain -- see the
// standalone-backend plan in project memory. That migration is done; every call in this file
// hits this repo's own routes now, and login/signOut go through Better Auth's client
// (auth-client.ts) directly rather than through here at all.
async function localFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
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
  me: () => localFetch<MeResponse>("/api/me"),
  // Better Auth's own admin-plugin endpoint (not a custom route -- it already does exactly this,
  // swapping the session cookie back to the impersonator's). Needs an explicit empty JSON body --
  // Better Auth 400s on "Invalid JSON in request body" for a truly bodyless POST.
  stopImpersonating: () => localFetch<{ ok: true }>("/api/auth/admin/stop-impersonating", { method: "POST", body: "{}" }),
  leagueState: (leagueId: string) =>
    localFetch<LeagueStateResponse>(`/api/leagues/${leagueId}/state`),
  createLeague: (name: string) =>
    localFetch<{ league: { id: string; name: string; join_code: string }; state: LeagueState }>("/api/leagues", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  // `reclaimed`: the user's own previously-disabled seat was restored rather than a new one made.
  joinLeague: (code: string) =>
    localFetch<{ league: { id: string; name: string }; reclaimed: boolean }>("/api/leagues/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  // League invites live in their own table (league_invites), not the JSONB league state -- same
  // as chat, so these return their own shapes and have no mock-mode branch.
  sendInvite: (leagueId: string, identifier: string) =>
    localFetch<{ invite: LeagueInvite }>(`/api/leagues/${leagueId}/invites`, {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),
  listLeagueInvites: (leagueId: string) => localFetch<{ invites: LeagueInvite[] }>(`/api/leagues/${leagueId}/invites`),
  revokeInvite: (leagueId: string, inviteId: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/invites/${inviteId}`, { method: "DELETE" }),
  myInvites: () => localFetch<{ invites: MyInvite[] }>("/api/me/invites"),
  acceptInvite: (inviteId: string) =>
    localFetch<{ league: { id: string; name: string }; reclaimed: boolean }>(`/api/invites/${inviteId}/accept`, { method: "POST" }),
  declineInvite: (inviteId: string) => localFetch<{ ok: true }>(`/api/invites/${inviteId}/decline`, { method: "POST" }),

  proposeBet: (leagueId: string, epId: string, label: string, points: number) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets`, {
      method: "POST",
      body: JSON.stringify({ label, points }),
    }),
  removeBet: (leagueId: string, epId: string, betId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}`, { method: "DELETE" }),
  addBetPrediction: (leagueId: string, epId: string, betId: string, playerId: string, guess: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions`, {
      method: "POST",
      body: JSON.stringify({ playerId, guess }),
    }),
  setBetPredictionCorrect: (leagueId: string, epId: string, betId: string, predId: string, value: boolean) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions/${predId}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),

  reorderDraft: (leagueId: string, fromIndex: number, toIndex: number) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/order`, {
      method: "POST",
      body: JSON.stringify({ fromIndex, toIndex }),
    }),
  draftPick: (leagueId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/pick`, {
      method: "POST",
      body: JSON.stringify({ castawayId }),
    }),
  undraft: (leagueId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/pick/${castawayId}`, { method: "DELETE" }),
  forceStartDraft: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/force-start`, { method: "POST" }),

  addEpisode: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes`, { method: "POST" }),
  removeEpisode: (leagueId: string, epId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}`, { method: "DELETE" }),
  updateEpisode: (leagueId: string, epId: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  addElimination: (leagueId: string, epId: string, castawayId: string, method: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/eliminations`, {
      method: "POST",
      body: JSON.stringify({ castawayId, method }),
    }),
  removeElimination: (leagueId: string, epId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/eliminations/${castawayId}`, {
      method: "DELETE",
    }),
  updateBet: (leagueId: string, epId: string, betId: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeBetPrediction: (leagueId: string, epId: string, betId: string, predId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/predictions/${predId}`, {
      method: "DELETE",
    }),

  startReplenish: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/start`, { method: "POST" }),
  replenishAssign: (leagueId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/assign`, {
      method: "POST",
      body: JSON.stringify({ castawayId }),
    }),
  cancelReplenish: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/replenish/cancel`, { method: "POST" }),

  startTrade: (leagueId: string) => localFetch<LeagueState>(`/api/leagues/${leagueId}/trade/start`, { method: "POST" }),
  tradeSwap: (leagueId: string, dropId: string, addId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/trade/swap`, {
      method: "POST",
      body: JSON.stringify({ dropId, addId }),
    }),
  tradeSkip: (leagueId: string) => localFetch<LeagueState>(`/api/leagues/${leagueId}/trade/skip`, { method: "POST" }),
  cancelTrade: (leagueId: string) => localFetch<LeagueState>(`/api/leagues/${leagueId}/trade/cancel`, { method: "POST" }),

  setFinalePick: (leagueId: string, playerId: string, idx: number, value: string | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/finale/predictions/${playerId}`, {
      method: "PATCH",
      body: JSON.stringify({ idx, value }),
    }),
  setFinaleWinnerPick: (leagueId: string, playerId: string, value: string | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/finale/predictions/${playerId}/winner`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  setActualTop3: (leagueId: string, idx: number, value: string | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/finale/actual/top3`, {
      method: "PATCH",
      body: JSON.stringify({ idx, value }),
    }),
  setActualWinner: (leagueId: string, value: string | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/finale/actual/winner`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),

  // Chat lives in its own Postgres tables (chat_messages/chat_reactions), not the JSONB league
  // state, so these return their own shapes rather than a LeagueState.
  getChat: (leagueId: string) => localFetch<{ messages: ChatMessage[] }>(`/api/leagues/${leagueId}/chat`),
  sendChatMessage: (leagueId: string, text: string) =>
    localFetch<{ message: ChatMessage }>(`/api/leagues/${leagueId}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  editChatMessage: (leagueId: string, messageId: string, text: string) =>
    localFetch<{ message: ChatMessage }>(`/api/leagues/${leagueId}/chat/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),
  deleteChatMessage: (leagueId: string, messageId: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/chat/${messageId}`, { method: "DELETE" }),
  reactToChatMessage: (leagueId: string, messageId: string, emoji: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/chat/${messageId}/react`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),

  // Admin routes -- superAdmin-only server-side (requireSuperAdmin), cross-league scope (not
  // the per-league LeagueState everything else here reads/writes).
  adminListUsers: () => localFetch<{ users: AdminUser[] }>("/api/admin/users"),
  adminCreateUser: (username: string) =>
    localFetch<{ user: AdminUser; tempPassword: string }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  adminResetPassword: (userId: string) =>
    localFetch<{ tempPassword: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
    }),
  adminUserLeagues: (userId: string) => localFetch<{ leagues: { id: string; name: string; role: string }[] }>(`/api/admin/users/${userId}/leagues`),
  adminDeleteUser: (userId: string) => localFetch<{ ok: true }>(`/api/admin/users/${userId}`, { method: "DELETE" }),
  // Response body isn't used (the impersonation cookie swap is the whole point); the caller does
  // a full reload right after, same as stopImpersonating.
  adminImpersonate: (userId: string) => localFetch<unknown>(`/api/admin/users/${userId}/impersonate`, { method: "POST" }),

  adminListLeagues: () => localFetch<{ leagues: AdminLeague[] }>("/api/admin/leagues"),
  adminDeleteLeague: (leagueId: string) => localFetch<{ ok: true }>(`/api/admin/leagues/${leagueId}`, { method: "DELETE" }),
  adminLeagueMemberships: (leagueId: string) =>
    localFetch<{ players: Player[]; memberships: AdminMembership[] }>(`/api/admin/leagues/${leagueId}/memberships`),
  adminLinkMembership: (leagueId: string, userId: string, playerId: string, role: "member" | "commissioner") =>
    localFetch<{ membership: AdminMembership }>(`/api/admin/leagues/${leagueId}/memberships`, {
      method: "POST",
      body: JSON.stringify({ userId, playerId, role }),
    }),
  adminUnlinkMembership: (leagueId: string, membershipId: string) =>
    localFetch<{ ok: true }>(`/api/admin/leagues/${leagueId}/memberships/${membershipId}`, { method: "DELETE" }),
  adminDeletePlayer: (leagueId: string, playerId: string) =>
    localFetch<{ ok: true; player: Player }>(`/api/admin/leagues/${leagueId}/players/${playerId}`, { method: "DELETE" }),

  // League Settings -- commissioner-only server-side (requireLeagueRole('commissioner') on every
  // route in server/routes/roster.js), same generic field/value PATCH pattern as updateEpisode.
  renameLeague: (leagueId: string, name: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  updateLeagueSettings: (leagueId: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  addPlayer: (leagueId: string, name: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players`, { method: "POST", body: JSON.stringify({ name }) }),
  updatePlayer: (leagueId: string, id: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removePlayer: (leagueId: string, id: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}`, { method: "DELETE" }),
  activatePlayer: (leagueId: string, id: string, castawayIds: string[]) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ castawayIds }),
    }),
  addTribe: (leagueId: string, name: string, color: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/tribes`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),
  updateTribe: (leagueId: string, id: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/tribes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeTribe: (leagueId: string, id: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/tribes/${id}`, { method: "DELETE" }),
  addCastaway: (leagueId: string, name: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/castaways`, { method: "POST", body: JSON.stringify({ name }) }),
  updateCastaway: (leagueId: string, id: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/castaways/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  removeCastaway: (leagueId: string, id: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/castaways/${id}`, { method: "DELETE" }),
  // Whole-state replace -- the raw parsed JSON of a previously-exported backup, migrated
  // server-side (StateLogic.migrateLeagueState) before being saved.
  importLeagueState: (leagueId: string, raw: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/import`, { method: "POST", body: JSON.stringify(raw) }),
  resetLeague: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/reset`, { method: "POST" }),
  leaveLeague: (leagueId: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/leave`, { method: "POST" }),

  adminListReports: () => localFetch<{ reports: Report[] }>("/api/admin/reports"),
  adminDeleteReport: (id: string) => localFetch<{ ok: true }>(`/api/admin/reports/${id}`, { method: "DELETE" }),
  // Not admin-gated -- any signed-in user can submit one (requireAuth server-side).
  submitReport: (type: "issue" | "feature", message: string, route: string, leagueId: string | null, leagueName: string | null) =>
    localFetch<{ ok: true }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ type, message, route, leagueId, leagueName }),
    }),
};
