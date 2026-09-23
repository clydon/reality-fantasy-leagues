import { create } from "zustand";
import type { LeagueState, Membership } from "@/lib/game/types";
import { buildMockSeasonState } from "@/lib/game/mock-state";

// POC-scoped store: one league's state, exactly like the live app's single global `state`
// object (see CLAUDE.md's state model) but through Zustand instead of a bare global. Two
// sources: the ported mock/demo dataset (matches the live app's demo mode), or `state` fetched
// live from the real Express API (see src/lib/api.ts + AuthGate) -- `mode` tracks which one is
// currently displayed so the UI can show a "Demo data" indicator when it's not real, and so
// components can branch their mutations exactly like app.js's `isDemoMode` checks do (see
// CLAUDE.md: "isDemoMode is checked at the top of nearly every mutator").
//
// Mock mode mirrors the live app's actual demo-mode behavior, not an idealized one: full
// commissioner powers (propose/delete/grade bets) but no personal player identity to guess with
// -- enterDemoMode() in public/app.js never sets currentMembership either, so canGuess is false
// there too. See canManage()/canGuess() below.
export interface PlayerAccount {
  player_id: string;
  role: string;
  username: string;
}

interface LeagueStore {
  mode: "mock" | "live";
  state: LeagueState;
  leagueId: string | null;
  leagueName: string | null;
  membership: Membership | null;
  userId: string | null; // the signed-in user's own id (not their player id) -- chat reactions/ownership key off this, same as public/app.js's currentUser.id
  isSuperAdmin: boolean; // global account flag, independent of role within the currently-loaded league -- gates the Admin tab, same as public/app.js's currentUser.isSuperAdmin
  // Which player each account is linked to, for League Settings' Players section -- previously
  // fetched by api.leagueState() but discarded, since nothing needed it until now.
  playerAccounts: PlayerAccount[];
  useMock: () => void;
  loadLive: (
    leagueId: string,
    state: LeagueState,
    leagueName: string,
    membership: Membership,
    userId: string,
    isSuperAdmin: boolean,
    playerAccounts: PlayerAccount[]
  ) => void;
  setState: (state: LeagueState) => void;
  // Separate from loadLive: "My Leagues" (GET /api/auth/me) reflects real membership only, even
  // for a super-admin (see the live app's server/routes/auth.js comment on that route) -- a pure
  // super-admin with no personal league would never reach loadLive at all otherwise, yet the
  // Admin tab needs their identity regardless of whether they have a league of their own to view.
  setIdentity: (userId: string, isSuperAdmin: boolean) => void;
  // Port of pollForNotifications()'s deliberately-narrow state patch: only midSeason is synced
  // from a background poll, not the whole state object, so a poll landing mid-edit elsewhere
  // (e.g. a half-filled Episode form) can't clobber it. See use-league-poll.ts.
  setMidSeason: (midSeason: LeagueState["midSeason"]) => void;
}

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  mode: "mock",
  state: buildMockSeasonState(),
  leagueId: null,
  leagueName: null,
  membership: null,
  userId: null,
  isSuperAdmin: false,
  playerAccounts: [],
  useMock: () =>
    set({
      mode: "mock",
      state: buildMockSeasonState(),
      leagueId: null,
      leagueName: null,
      membership: null,
      userId: null,
      isSuperAdmin: false,
      playerAccounts: [],
    }),
  loadLive: (leagueId, state, leagueName, membership, userId, isSuperAdmin, playerAccounts) =>
    set({ mode: "live", leagueId, state, leagueName, membership, userId, isSuperAdmin, playerAccounts }),
  setIdentity: (userId, isSuperAdmin) => set({ userId, isSuperAdmin }),
  setMidSeason: (midSeason) => set({ state: { ...get().state, midSeason } }),
  // Mock-mode mutators (StateLogic.*) mutate `state` in place, same as the live app; spreading it
  // into a new top-level object is what actually triggers Zustand/React to notice the change.
  setState: (state) => set({ state: { ...state } }),
}));

// Proper selector hooks (not getState() snapshots) so components re-render when mode/membership
// change on their own, not only incidentally alongside a `state` update.
export function useCanManage(): boolean {
  return useLeagueStore((s) => s.mode === "mock" || s.membership?.role === "commissioner");
}

export function useCanGuess(): boolean {
  return useLeagueStore((s) => s.mode !== "mock" && !!s.membership?.playerId);
}

export function useMyPlayerId(): string | null {
  return useLeagueStore((s) => s.membership?.playerId ?? null);
}

// Whether there's a real, signed-in SurvivorDraft session -- NOT the same as `mode === 'live'`,
// which only flips once a real league also loads. A super-admin with no personal league is
// genuinely authenticated (userId set via setIdentity) but stays mode:'mock' since there's no
// league state to show; features that just need "a real user, for a request the server will
// authenticate" (e.g. submitting a report) should check this, not mode.
export function useIsAuthenticated(): boolean {
  return useLeagueStore((s) => !!s.userId);
}

export function useIsSuperAdmin(): boolean {
  return useLeagueStore((s) => s.isSuperAdmin);
}
