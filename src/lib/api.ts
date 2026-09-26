import type { LeagueState, Membership, ChatMessage, AdminUser, AdminLeague, AdminMembership, Player, Report, LeagueInvite, MyInvite, WikiProposal, AppliedProposal, AdminShow, CatalogShow, ShowSeason, WikiSeasonSyncResult, SeasonCastMember, SeasonResearchResult, SuggestedBetAnswer, SeasonDecisionsResponse, LeagueDecisionSync } from "@/lib/game/types";
import type { DemoSeasonData } from "@/lib/game/demo-season-builder";

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
  // Semantic-search grading aid (db/embeddings.js). Fetched on demand -- see the route's own comment
  // on why this isn't joined into every episode-card render.
  suggestBetAnswer: (leagueId: string, epId: string, betId: string) =>
    localFetch<SuggestedBetAnswer>(`/api/leagues/${leagueId}/episodes/${epId}/bets/${betId}/suggested-answer`),

  // Pick'em only.
  setPickEmPick: (leagueId: string, epId: string, playerId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/picks`, {
      method: "PUT",
      body: JSON.stringify({ playerId, castawayId }),
    }),
  removePickEmPick: (leagueId: string, epId: string, playerId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/picks/${playerId}`, { method: "DELETE" }),

  // Active Roster only: per-episode lineups, the commissioner lineup lock, and the scoring-event log.
  setActiveRosterLineup: (leagueId: string, epId: string, playerId: string, castawayIds: string[]) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/lineups/${playerId}`, {
      method: "PUT",
      body: JSON.stringify({ castawayIds }),
    }),
  lockLineups: (leagueId: string, epId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/lineups/lock`, { method: "POST" }),
  unlockLineups: (leagueId: string, epId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/lineups/lock`, { method: "DELETE" }),
  addScoringEvent: (leagueId: string, epId: string, type: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/scoring-events`, {
      method: "POST",
      body: JSON.stringify({ type, castawayId }),
    }),
  removeScoringEvent: (leagueId: string, epId: string, eventId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/scoring-events/${eventId}`, { method: "DELETE" }),

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

  // Blind draft (shared-ownership classic-draft only). The submitted picks are NOT part of league
  // state -- they're held server-side until every player has locked in (see
  // src/lib/server/blind-draft.ts), so reading your own back takes its own request rather than
  // coming along with the state blob like everything else here.
  lockBlindPicks: (leagueId: string, playerId: string, castawayIds: string[]) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/blind/lock`, {
      method: "POST",
      body: JSON.stringify({ playerId, castawayIds }),
    }),
  unlockBlindPicks: (leagueId: string, playerId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/draft/blind/lock/${playerId}`, { method: "DELETE" }),
  myBlindPicks: (leagueId: string, playerId: string) =>
    localFetch<{ castawayIds: string[] | null }>(`/api/leagues/${leagueId}/draft/blind/lock/${playerId}`),

  // `number` opens one specific episode (catch-up mode's "Open episode N"); omitted, it appends the
  // next one, which is what the Episodes tab's own button does.
  addEpisode: (leagueId: string, number?: number) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes`, {
      method: "POST",
      body: JSON.stringify(number ? { number } : {}),
    }),
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
  addRole: (leagueId: string, epId: string, castawayId: string, role: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/roles`, {
      method: "POST",
      body: JSON.stringify({ castawayId, role }),
    }),
  removeRole: (leagueId: string, epId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/roles/${castawayId}`, {
      method: "DELETE",
    }),
  addGroupChange: (leagueId: string, epId: string, castawayId: string, group: string | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/groups`, {
      method: "POST",
      body: JSON.stringify({ castawayId, group }),
    }),
  removeGroupChange: (leagueId: string, epId: string, castawayId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/groups/${castawayId}`, {
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
  adminUserLeagues: (userId: string) =>
    localFetch<{ leagues: { id: string; name: string; role: "member" | "commissioner"; membership_id: string; player_id: string }[] }>(
      `/api/admin/users/${userId}/leagues`
    ),
  adminUpdateUser: (userId: string, changes: { username?: string; email?: string }) =>
    localFetch<{ user: AdminUser }>(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(changes) }),
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

  // Wiki connector (db/wiki-sync.js). Proposals live in their own table, not in league state, so
  // these return their own shapes and have no mock-mode branch -- same as invites and chat.
  listWikiProposals: (leagueId: string) =>
    localFetch<{ proposals: WikiProposal[] }>(`/api/leagues/${leagueId}/wiki-proposals`),
  // `applied` is shaped by `kind` -- the three apply paths report different things, so the caller
  // narrows on kind rather than this pretending they share a shape.
  applyWikiProposal: (leagueId: string, id: string) =>
    localFetch<{
      state: LeagueState;
      kind: "cast" | "eliminations" | "scoringEvents";
      applied: AppliedProposal | null;
    }>(`/api/leagues/${leagueId}/wiki-proposals/${id}`, { method: "POST" }),
  rejectWikiProposal: (leagueId: string, id: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/wiki-proposals/${id}`, { method: "DELETE" }),

  // Catch-up mode (StateLogic.RevealLogic): raise this league's reveal pointer by one episode, which
  // applies that episode's admin-accepted results (db/migrations/0019).
  revealNextEpisode: (leagueId: string) =>
    localFetch<{
      state: LeagueState;
      revealedThroughEpisode: number;
      /** Accepted results applied to this league by the reveal. */
      applied: number;
      /** Accepted results that couldn't be applied here (a name this league's cast lacks). */
      skipped: { name: string; why: string }[];
      /** Results for this episode the admin hasn't decided yet; they land on their own once decided. */
      awaitingReview: number;
      /** Castaways sorted into their starting tribe by this reveal, if the season held them back. */
      tribed: string[];
    }>(
      `/api/leagues/${leagueId}/reveal-next`,
      { method: "POST" }
    ),

  // Show/season catalog. The plain /api/shows read is commissioner-facing (the Show and Season
  // pickers in League Settings); everything under /api/admin/* is super-admin catalog management.
  listShows: () => localFetch<{ shows: CatalogShow[] }>("/api/shows"),

  // Demo Season picker catalog (db/migrations/0026_demo_seasons_generic.sql) -- public, no auth, so a
  // logged-out visitor can try a real season before they have an account.
  listDemoSeasons: () =>
    localFetch<{ seasons: { id: string; showId: string; name: string; episodeCount: number }[] }>("/api/demo-seasons"),
  getDemoSeason: (id: string) => localFetch<{ season: DemoSeasonData }>(`/api/demo-seasons/${id}`),

  // App-wide Overview layout, one per league type (db/migrations/0027_app_settings.sql) -- GET is
  // public (every viewer, including a demo visitor, renders from it); PATCH is super-admin only.
  getOverviewLayout: () =>
    localFetch<{ layouts: Record<string, { order: string[]; hidden: Record<string, boolean> } | undefined> }>(
      "/api/app-settings/overview-layout"
    ),
  updateOverviewLayout: (leagueTypeId: string, order: string[], hidden: Record<string, boolean>) =>
    localFetch<{ leagueTypeId: string; layout: { order: string[]; hidden: Record<string, boolean> } }>(
      "/api/app-settings/overview-layout",
      { method: "PATCH", body: JSON.stringify({ leagueTypeId, order, hidden }) }
    ),

  adminListShows: () => localFetch<{ shows: AdminShow[] }>("/api/admin/shows"),
  adminCreateShow: (body: {
    name: string;
    castawayTerm?: string;
    tribeTerm?: string;
    wikiApiUrl?: string;
    castSectionHeading?: string;
    format?: string;
  }) =>
    localFetch<{ show: { id: string; slug: string; name: string } }>("/api/admin/shows", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminUpdateShow: (
    id: string,
    changes: Partial<{
      name: string;
      castawayTerm: string;
      tribeTerm: string;
      wikiApiUrl: string;
      castSectionHeading: string;
      researchDomains: string;
      format: string;
      archived: boolean;
    }>
  ) =>
    localFetch<{ show: { id: string; slug: string; name: string; archived: boolean } }>(`/api/admin/shows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  adminDeleteShow: (id: string) => localFetch<{ ok: true }>(`/api/admin/shows/${id}`, { method: "DELETE" }),
  adminCreateSeason: (
    showId: string,
    body: { seasonNumber: number; name?: string; wikiUrl?: string; status?: string; castSize?: number; premiereDate?: string; finaleDate?: string }
  ) =>
    localFetch<{ season: ShowSeason }>(`/api/admin/shows/${showId}/seasons`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminUpdateSeason: (id: string, changes: Record<string, unknown>) =>
    localFetch<{ season: ShowSeason; leaguesOnOldNumber: number }>(`/api/admin/seasons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  // The season's staged cast, as Admin > Shows & Seasons reviews it (db/migrations/0011). Approving
  // is what puts it into leagues -- there's no per-league cast proposal any more.
  adminSeasonCast: (id: string) =>
    localFetch<{
      cast: SeasonCastMember[];
      approvedAt: string | null;
      /** Held until a catching-up league reveals this episode; null sends tribes with the cast. */
      tribesFromEpisode: number | null;
      leagueCount: number;
      castawayTerm: string;
      tribeTerm: string;
    }>(`/api/admin/seasons/${id}/cast`),
  adminEditSeasonCast: (id: string, change: { tribesFromEpisode?: number | null; remove?: string }) =>
    localFetch<{ cast: SeasonCastMember[]; approvedAt: null; tribesFromEpisode: number | null }>(
      `/api/admin/seasons/${id}/cast`,
      { method: "PATCH", body: JSON.stringify(change) }
    ),
  adminApproveSeasonCast: (id: string) =>
    localFetch<{
      approvedAt: string;
      castSize: number;
      applied: { leagueId: string; leagueName: string; added: string[]; skipped: string[]; error?: string }[];
    }>(`/api/admin/seasons/${id}/cast/approve`, { method: "POST" }),
  adminDeleteSeason: (id: string) =>
    localFetch<{ ok: true; leaguesAffected: number }>(`/api/admin/seasons/${id}`, { method: "DELETE" }),
  // On-demand wiki pull for one season. Slow by nature (it reads the wiki, then runs an LLM
  // extraction) -- callers show a pending state rather than assuming this returns quickly.
  adminSyncSeason: (id: string, kind: "cast" | "episodes", force = false, model?: string) =>
    localFetch<WikiSeasonSyncResult>(`/api/admin/seasons/${id}/sync`, {
      method: "POST",
      body: JSON.stringify({ kind, force, model }),
    }),

  /**
   * Research one episode of a season with a web-searching model (db/episode-research.js). Slow and
   * paid, so the UI asks for one episode at a time; `force` re-researches an episode that already
   * has a cached answer.
   */
  // Season decisions (db/migrations/0019): every episode result for a season, decided once by an
  // admin. Deciding syncs every league on the season, and the response says what each one got.
  adminListDecisions: (seasonId: string) => localFetch<SeasonDecisionsResponse>(`/api/admin/seasons/${seasonId}/decisions`),
  adminDecide: (
    seasonId: string,
    decisionId: string,
    action: "accept" | "reject",
    edits?: { castawayName?: string; method?: string; eventType?: string }
  ) =>
    localFetch<{ ok: true; leagues: LeagueDecisionSync[] }>(`/api/admin/seasons/${seasonId}/decisions/${decisionId}`, {
      method: "POST",
      body: JSON.stringify({ action, ...(edits || {}) }),
    }),
  // Throw away one episode's research and the undecided results it staged (e.g. run before it aired).
  adminDiscardResearch: (seasonId: string, episode: number) =>
    localFetch<{ ok: true; removedResults: number }>(`/api/admin/seasons/${seasonId}/research?episode=${episode}`, {
      method: "DELETE",
    }),
  adminAcceptEpisode: (seasonId: string, episode: number) =>
    localFetch<{ ok: true; accepted: number; leagues: LeagueDecisionSync[] }>(
      `/api/admin/seasons/${seasonId}/decisions/accept-episode`,
      { method: "POST", body: JSON.stringify({ episode }) }
    ),

  adminResearchEpisode: (id: string, episode: number, opts: { force?: boolean; provider?: string; model?: string } = {}) =>
    localFetch<SeasonResearchResult>(`/api/admin/seasons/${id}/research`, {
      method: "POST",
      body: JSON.stringify({ episode, ...opts }),
    }),

  // Web Push (src/lib/push-client.ts calls these; src/lib/server/push-core.js sends).
  registerPushSubscription: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    localFetch<{ ok: true }>("/api/me/push-subscriptions", { method: "POST", body: JSON.stringify(sub) }),
  unregisterPushSubscription: (endpoint: string) =>
    localFetch<{ ok: true }>("/api/me/push-subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  getNotificationPrefs: () =>
    localFetch<{ types: { id: string; label: string; description: string; enabled: boolean }[]; deviceCount: number }>(
      "/api/me/notification-prefs"
    ),
  setNotificationPrefs: (enabled: Record<string, boolean>) =>
    localFetch<{ types: { id: string; label: string; description: string; enabled: boolean }[]; deviceCount: number }>(
      "/api/me/notification-prefs",
      { method: "PUT", body: JSON.stringify({ enabled }) }
    ),
  sendTestPush: () => localFetch<{ sent: number; removed: number }>("/api/me/push-test", { method: "POST" }),

  adminListReports: () => localFetch<{ reports: Report[] }>("/api/admin/reports"),
  adminDeleteReport: (id: string) => localFetch<{ ok: true }>(`/api/admin/reports/${id}`, { method: "DELETE" }),
  // Not admin-gated -- any signed-in user can submit one (requireAuth server-side).
  submitReport: (type: "issue" | "feature", message: string, route: string, leagueId: string | null, leagueName: string | null) =>
    localFetch<{ ok: true }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ type, message, route, leagueId, leagueName }),
    }),
};
