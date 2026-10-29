import type { LeagueState, Membership, ChatMessage, ChatRead, LeagueInvite, MyInvite, CatalogShow, SuggestedBetAnswer, StoredFormat, Proposal, EpisodeResearchPanel, ResearchApplySummary, LeagueRuleset, WaiverClaim } from "@/lib/game/types";
import type { FormatData } from "@/lib/game/formats/index";
import type { ArtStyle } from "@/lib/show-art-style";
import type { DemoSeasonData } from "@/lib/game/demo-season-builder";
import type { ActionItem } from "@/lib/game/action-items.js";
import type { CommissionerItem } from "@/lib/game/commissioner-items";

export interface EpisodeTeamSummary {
  /** Every team's saved "why it mattered" line, by player id. */
  notes: Record<string, string>;
  /** Commissioner only: the one prompt that writes every team's line. Null for everyone else. */
  prompt: string | null;
  /** Whether the prompt could name the show's trusted sites to read the episode recap from. */
  hasSource: boolean;
}

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
/** The time zone this phone is in ("America/Los_Angeles"), or "" when the browser doesn't say. */
export function phoneTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

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

/** One bot research attempt (db/migrations/0065). ok is null while it runs. */
export interface BotResearchRun {
  id: string;
  episode: number;
  slot: string;
  kind: "quick" | "full" | "schedule" | "trivia" | "bingo" | "tiebreak" | "rulebook";
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  message: string | null;
  result: {
    left?: { name: string; how: string | null; matched: boolean }[];
    headline?: string | null;
    sources?: string[];
    inserted?: number;
    merged?: boolean;
    /** Trivia (db/trivia-research.js): every question written, live or dropped by the check, and those the parse dropped. */
    questions?: { episode: number; question: string; options: string[]; answer: string; source: string; status: "live" | "dropped"; note: string | null }[];
    dropped?: { index: number; why: string; question: string | null }[];
    /** Bingo (db/bingo-research.js): every square written, live or dropped (the parse's or the check's) with why; for the season's own bank. */
    squares?: { label: string; likelihood: "likely" | "maybe" | "longshot"; status: "live" | "dropped"; note: string | null }[];
    forSeason?: boolean;
    live?: number;
    /** A scheduled run that found the squares written already, and left them. */
    kept?: boolean;
  } | null;
  seconds: number | null;
}

export interface MeResponse {
  /** ui: the design this account opens on (user_settings.ui, docs/PLAN-new-design.md step 0c). */
  user: { id: string; username: string; isSuperAdmin: boolean; approved: boolean; ui: "classic" | "new" };
  // Already sorted for display by the server -- see /api/me.
  // landOn: the league the app opens on in this one's place -- its linked group's favorite, or null.
  // group: its linked group and that group's name (already defaulted to show + season), or null.
  // A group's leagues come back next to each other, in the group's order.
  leagues: {
    id: string;
    name: string;
    join_code: string;
    role: string;
    type: string;
    showId: string | null;
    landOn: string | null;
    group: { id: string; name: string } | null;
  }[];
  impersonating: boolean;
}

export interface MySettings {
  showResultsImmediately: boolean;
  whatsNewSeen: string | null;
  accountCreatedAt: string | null;
  /** The design this account opens on (docs/PLAN-new-design.md step 0c). */
  ui: "classic" | "new";
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
  // ?tz=: the time zone this phone is in, kept so a push says the reader's time (docs/PLAN-new-design.md step 15 part 2).
  me: () => localFetch<MeResponse>(`/api/me?tz=${encodeURIComponent(phoneTimeZone())}`),
  myActions: () =>
    localFetch<{
      items: (ActionItem & { leagueId: string; leagueName: string })[];
      commish?: (CommissionerItem & { leagueId: string; leagueName: string })[];
    }>("/api/me/actions"),
  // Return to my account: Better Auth's stop-impersonating through the desk's route, which writes the end of an hour
  // begun on the desk in that person's History and answers where to go back to (their desk page, or null for the front
  // door; docs/PLAN-desk-parity.md part 1b).
  stopImpersonating: () => localFetch<{ back: string | null }>("/api/desk/acting", { method: "DELETE" }),
  // Settings › Test couch's switches: Act as them on the desk's route, logged in their History, its return going home.
  actAsTestPlayer: (userId: string) =>
    localFetch<{ go: string }>(`/api/desk/people/${encodeURIComponent(userId)}/act`, { method: "POST", body: JSON.stringify({ from: "test-couch" }) }),
  leagueState: (leagueId: string) =>
    localFetch<LeagueStateResponse>(`/api/leagues/${leagueId}/state`),
  // Linked leagues (league-groups.ts): one shared chat and reveal for the same friends' leagues.
  getLeagueLinks: (leagueId: string) =>
    localFetch<{
      linked: { id: string; name: string }[];
      order: { id: string; name: string }[];
      favoriteId: string | null;
      // The group's own name (null when unset) and what it's called without one (show + season).
      name: string | null;
      defaultName: string;
      candidates: { id: string; name: string; problem: string | null; joiningUs: string[]; joiningThem: string[] }[];
    }>(`/api/leagues/${leagueId}/link`),
  linkLeague: (leagueId: string, otherLeagueId: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/link`, { method: "POST", body: JSON.stringify({ otherLeagueId }) }),
  // A commissioner's group order (every linked league once), the league its members open on, and/or
  // its name (null: back to show + season).
  setLeagueGroup: (leagueId: string, changes: { order?: string[]; favoriteId?: string | null; name?: string | null }) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/link`, { method: "PUT", body: JSON.stringify(changes) }),
  unlinkLeague: (leagueId: string) => localFetch<{ ok: true }>(`/api/leagues/${leagueId}/link`, { method: "DELETE" }),
  // Spoiler protection: this member has now seen results through episode `through`.
  // `jump`: a late joiner skipping to the latest episode, the one way their mark moves by more than one.
  markExplainerSeen: (leagueId: string) => localFetch<{ ok: true }>(`/api/leagues/${leagueId}/explainer-seen`, { method: "POST" }),
  markResultsSeen: (leagueId: string, through: number, jump?: boolean) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/results-seen`, { method: "POST", body: JSON.stringify({ through, jump: !!jump }) }),
  // Late joiners (StateLogic.GhostLogic): choose a start episode and draft; and a commissioner adding one.
  // The linked leagues one "Which episodes have you watched?" answer covers (late-join.ts lateJoinGroup).
  lateJoinGroup: (leagueId: string) =>
    localFetch<{ leagues: { id: string; name: string; pending: boolean; mark: number | null }[] }>(`/api/leagues/${leagueId}/late-join`),
  beginLateJoin: (leagueId: string, startEpisode: number, castawayIds: string[]) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/late-join`, { method: "POST", body: JSON.stringify({ startEpisode, castawayIds }) }),
  convertLateJoiner: (leagueId: string, id: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players/${id}/convert`, { method: "POST" }),
  getMySettings: () => localFetch<MySettings>("/api/me/settings"),
  // Only the fields sent change.
  setMySettings: (changes: { showResultsImmediately?: boolean; whatsNewSeen?: string; ui?: "classic" | "new" }) =>
    localFetch<MySettings>("/api/me/settings", { method: "PUT", body: JSON.stringify(changes) }),
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
  // playerId: hand over that seat (a computer player, say) rather than adding a new one.
  sendInvite: (leagueId: string, identifier: string, playerId?: string) =>
    localFetch<{ invite: LeagueInvite }>(`/api/leagues/${leagueId}/invites`, {
      method: "POST",
      body: JSON.stringify({ identifier, playerId }),
    }),
  // The same invite, to this league and every linked league you're in. `invite` is this league's,
  // null when they were already in it or invited; the rest say where it went and where it didn't.
  sendGroupInvite: (leagueId: string, identifier: string) =>
    localFetch<{
      invite: LeagueInvite | null;
      sent: { league_id: string; league_name: string }[];
      skipped: { league_id: string; league_name: string; reason: string }[];
    }>(`/api/leagues/${leagueId}/invites`, {
      method: "POST",
      body: JSON.stringify({ identifier, allLinked: true }),
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

  // Scoreboard "why it mattered" lines: everyone's saved line, plus (commissioner only) the one prompt
  // that writes them all. Saving is commissioner-only: { playerId: text }, empty text clears a line.
  episodeTeamSummary: (leagueId: string, epId: string) =>
    localFetch<EpisodeTeamSummary>(`/api/leagues/${leagueId}/episodes/${epId}/team-summary`),
  saveEpisodeTeamLines: (leagueId: string, epId: string, lines: Record<string, string>) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/episodes/${epId}/team-summary`, {
      method: "PUT",
      body: JSON.stringify({ lines }),
    }),

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
  // `juryVotes`: a finalist's jury votes received (Survivor scores each), when known.
  addElimination: (leagueId: string, epId: string, castawayId: string, method: string, juryVotes?: number | null) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/episodes/${epId}/eliminations`, {
      method: "POST",
      body: JSON.stringify({ castawayId, method, juryVotes: juryVotes ?? null }),
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

  // Mid-season waivers (docs/PLAN-midseason-waivers.md). Claims are private and live outside state, so
  // your own comes back from its own read; saving returns the league with "who has claims in" updated.
  // `playerId` on a write: the commissioner acting for someone. A save may carry one part (the pickup
  // list, or the add/drop): the part left out keeps what's saved (waivers.js saveClaim).
  getWaiverClaim: (leagueId: string) =>
    localFetch<{ periodId: string | null; claim: WaiverClaim | null; hidden: boolean }>(`/api/leagues/${leagueId}/waivers`),
  /** `{ pairs }` replaces the whole claim; `{ spot }` sets one spot's choices and keeps the rest (Claim for). */
  saveWaiverClaim: (leagueId: string, claim: Partial<WaiverClaim> | { spot: { dropId: string; addIds: string[] } }, playerId?: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/claims`, {
      method: "PUT",
      body: JSON.stringify({ ...claim, playerId }),
    }),
  freeAgencyMove: (leagueId: string, addId: string, dropId?: string | null, playerId?: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/free-agency`, {
      method: "POST",
      body: JSON.stringify({ addId, dropId: dropId ?? null, playerId }),
    }),
  processWaivers: (leagueId: string) => localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/process`, { method: "POST" }),
  /** Open a waiver window with `swaps` each (or change it); null turns it off (docs/PLAN-waivers-v2.md). */
  openWaiverWindow: (leagueId: string, swaps: number | null, replace?: boolean) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/window`, { method: "POST", body: JSON.stringify({ swaps, replace }) }),
  undoWaiverRun: (leagueId: string) => localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/undo`, { method: "POST" }),
  nudgeWaivers: (leagueId: string, playerId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/waivers/nudge`, { method: "POST", body: JSON.stringify({ playerId }) }),

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
  // `v`: the version last received; when nothing has changed since, the answer is just { unchanged: true }.
  getChat: (leagueId: string, v?: string | null) =>
    localFetch<{ messages: ChatMessage[]; reads: ChatRead[]; v?: string; unchanged?: undefined } | { unchanged: true; v: string }>(
      `/api/leagues/${leagueId}/chat${v ? `?v=${encodeURIComponent(v)}` : ""}`
    ),
  // The unread badge's count, worked out on the server; `since` is what this device has seen this session.
  getChatUnread: (leagueId: string, since: string | null) =>
    localFetch<{ unread: number }>(`/api/leagues/${leagueId}/chat/unread${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  markChatRead: (leagueId: string, at: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/chat/read`, { method: "POST", body: JSON.stringify({ at }) }),
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

  // League Settings -- commissioner-only server-side (requireLeagueRole('commissioner') on every
  // route in server/routes/roster.js), same generic field/value PATCH pattern as updateEpisode.
  renameLeague: (leagueId: string, name: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  updateLeagueSettings: (leagueId: string, field: string, value: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ field, value }),
    }),
  // Season rule changes (docs/PLAN-season-rule-changes.md): a commissioner adopts, declines or removes one.
  leagueRuleChange: (leagueId: string, changeId: string, action: "adopt" | "decline" | "remove", points?: Record<string, number>) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/rule-changes`, { method: "POST", body: JSON.stringify({ changeId, action, points }) }),
  // A league's own ruleset copy (docs/PLAN-scoring-rules-as-data.md phase 4, db/league-rulesets.js).
  // None of these return the league's state directly (the ruleset lives outside `state`, cached onto
  // it server-side) -- callers re-fetch via api.leagueState after a successful write.
  getLeagueRuleset: (leagueId: string) =>
    localFetch<{ custom: LeagueRuleset | null; following?: { kind: "builtin" | "show_format"; id: string } }>(
      `/api/leagues/${leagueId}/ruleset`
    ),
  forkLeagueRuleset: (leagueId: string, source: { from: "builtin" | "show_format" | "league_ruleset"; sourceId: string; name?: string }) =>
    localFetch<{ ruleset: LeagueRuleset }>(`/api/leagues/${leagueId}/ruleset`, { method: "POST", body: JSON.stringify(source) }),
  editLeagueRuleset: (leagueId: string, data: FormatData) =>
    localFetch<{ ruleset: LeagueRuleset }>(`/api/leagues/${leagueId}/ruleset`, { method: "PATCH", body: JSON.stringify({ data }) }),
  abandonLeagueRuleset: (leagueId: string) =>
    localFetch<{ abandoned: boolean; deleted: boolean }>(`/api/leagues/${leagueId}/ruleset`, { method: "DELETE" }),
  addPlayer: (leagueId: string, name: string, automated = false) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/players`, { method: "POST", body: JSON.stringify({ name, automated }) }),
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
  // "Import a cast" (docs/PLAN-cast-import-prompt.md): a pasted, reviewed cast answer. Returns what
  // was added and which starting roles were recorded alongside the new state.
  importCast: (leagueId: string, proposal: unknown) =>
    localFetch<{
      state: LeagueState;
      added: { tribes: string[]; castaways: string[]; skipped: string[] };
      roles: { recorded: string[]; unchanged: string[]; unresolved: string[] };
    }>(`/api/leagues/${leagueId}/castaways/import`, { method: "POST", body: JSON.stringify({ proposal }) }),
  // A commissioner's episode research (docs/PLAN-episode-research-compiled-cache.md): the panel (coverage,
  // narrowed prompt, what's staged), a pasted answer into the shared cache, and applying staged rows to
  // this league only.
  episodeResearch: (leagueId: string, epId: string, again = false) =>
    localFetch<EpisodeResearchPanel>(`/api/leagues/${leagueId}/episodes/${epId}/research${again ? "?again=1" : ""}`),
  submitEpisodeResearch: (leagueId: string, epId: string, notes: string, again = false, confirmed = false) =>
    localFetch<EpisodeResearchPanel>(`/api/leagues/${leagueId}/episodes/${epId}/research`, {
      method: "POST",
      body: JSON.stringify({ notes, again, confirmed }),
    }),
  clearEpisodeResearch: (leagueId: string, epId: string) =>
    localFetch<EpisodeResearchPanel>(`/api/leagues/${leagueId}/episodes/${epId}/research`, { method: "DELETE" }),
  applyEpisodeResearch: (
    leagueId: string,
    epId: string,
    items: { id: string; castawayName: string; method: string; eventType: string }[]
  ) =>
    localFetch<{ state: LeagueState; applied: ResearchApplySummary }>(`/api/leagues/${leagueId}/episodes/${epId}/research/apply`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  importLeagueState: (leagueId: string, raw: unknown) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/import`, { method: "POST", body: JSON.stringify(raw) }),
  resetLeague: (leagueId: string) =>
    localFetch<LeagueState>(`/api/leagues/${leagueId}/reset`, { method: "POST" }),
  leaveLeague: (leagueId: string) =>
    localFetch<{ ok: true }>(`/api/leagues/${leagueId}/leave`, { method: "POST" }),

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
  // pickers in League Settings); managing the catalog is the desk's (/api/desk/*).
  listShows: () => localFetch<{ shows: CatalogShow[] }>("/api/shows"),
  // The curated shows' art for the front door's show roll -- public, no auth.
  showArt: () => localFetch<{ shows: { name: string; artUrl: string; artStyle: ArtStyle | null }[] }>("/api/shows/art"),

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

  // Stored show formats, self-serve (docs/PLAN-rollout-order.md stage 4): any signed-in user, scoped to formats they
  // created, never able to switch an EXISTING show onto a format. Used by the create-league wizard's "+ Add it" tile.
  formatPrompt: (q: { name: string; wiki?: string; castaway?: string; tribe?: string; seasons?: string }) =>
    localFetch<{ prompt: string }>(
      `/api/formats/prompt?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`
    ),
  // A prompt parked at /b/<code> for the "Open in ChatGPT/Claude/..." links (components/ask-ai.tsx),
  // and (admin) who has read it.
  createBrief: (text: string) => localFetch<{ code: string }>("/api/briefs", { method: "POST", body: JSON.stringify({ text }) }),
  briefFetches: (code: string) =>
    localFetch<{ fetches: { reader: string; userAgent: string | null; via: "page" | "action"; at: string }[] }>(
      `/api/briefs/${encodeURIComponent(code)}/fetches`
    ),
  // The ask-AI bot (lib/server/ask-bot.ts), for admins and commissioners: whether this user may use it
  // and it's up, and running a prompt through it.
  askAiStatus: () => localFetch<{ allowed: boolean; available: boolean; busy: boolean }>("/api/ask-ai"),
  askAi: (prompt: string) =>
    localFetch<{ answer: string; seconds: number }>("/api/ask-ai", { method: "POST", body: JSON.stringify({ prompt }) }),
  createFormat: (answer: string) =>
    localFetch<{ format: StoredFormat }>("/api/formats", { method: "POST", body: JSON.stringify({ answer }) }),
  getFormat: (id: string) => localFetch<{ format: StoredFormat }>(`/api/formats/${encodeURIComponent(id)}`),
  saveFormat: (id: string, proposal: Proposal) =>
    localFetch<{ format: StoredFormat; leaguesUpdated: number }>(`/api/formats/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ proposal }),
    }),
  createShowFromFormat: (id: string, body: { domains?: string[] } = {}) =>
    localFetch<{ format: StoredFormat; show: { id: string; slug: string; name: string } | null }>(
      `/api/formats/${encodeURIComponent(id)}/create-show`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  deleteFormat: (id: string) => localFetch<{ ok: true }>(`/api/formats/${encodeURIComponent(id)}`, { method: "DELETE" }),

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
  // No type: the general "is this working" push. A type: that type's sample, so you can see it.
  sendTestPush: (type?: string) =>
    localFetch<{ sent: number; removed: number }>("/api/me/push-test", { method: "POST", body: JSON.stringify(type ? { type } : {}) }),

  // Not admin-gated -- any signed-in user can submit one (requireAuth server-side).
  submitReport: (type: "issue" | "feature", message: string, route: string, leagueId: string | null, leagueName: string | null) =>
    localFetch<{ ok: true }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ type, message, route, leagueId, leagueName }),
    }),
};
