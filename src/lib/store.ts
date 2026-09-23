import { create } from "zustand";
import type { LeagueState, Membership } from "@/lib/game/types";
import { buildMockSeasonState } from "@/lib/game/mock-state";
import { api, type MeResponse } from "@/lib/api";

export type LeagueSummary = MeResponse["leagues"][number];

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
  // Whether AuthGate has finished its initial decision and is showing the app shell (mock or
  // live) rather than the login screen. Lives here, not as AuthGate's own local state, so any
  // component (Sidebar, MobileNav) can flip it back to false to return to the login screen --
  // needed for "Sign in"/"Exit Tour" while previewing mock data, see auth-gate.tsx.
  entered: boolean;
  setEntered: (entered: boolean) => void;
  mode: "mock" | "live";
  state: LeagueState;
  leagueId: string | null;
  leagueName: string | null;
  membership: Membership | null;
  userId: string | null; // the signed-in user's own id (not their player id) -- chat reactions/ownership key off this, same as public/app.js's currentUser.id
  isSuperAdmin: boolean; // global account flag, independent of role within the currently-loaded league -- gates the Admin tab, same as public/app.js's currentUser.isSuperAdmin
  // True while a super-admin is impersonating another user (GET /api/auth/me's `impersonating`
  // flag) -- drives the "Viewing as X — Return to my account" banner, port of the live app's
  // updateImpersonationBanner()/currentUser.impersonating.
  impersonating: boolean;
  // Which player each account is linked to, for League Settings' Players section -- previously
  // fetched by api.leagueState() but discarded, since nothing needed it until now.
  playerAccounts: PlayerAccount[];
  // Every league the signed-in user belongs to (GET /api/auth/me), for the league switcher --
  // previously fetched by AuthGate's loadFirstLeague() and discarded after picking leagues[0].
  leagues: LeagueSummary[];
  setLeagues: (leagues: LeagueSummary[]) => void;
  // Loads a different one of `leagues` as the active league, same request sequence
  // loadFirstLeague() already does for the initial load.
  switchLeague: (leagueId: string) => Promise<void>;
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
  setIdentity: (userId: string, isSuperAdmin: boolean, impersonating: boolean) => void;
  // Port of pollForNotifications()'s deliberately-narrow state patch: only midSeason is synced
  // from a background poll, not the whole state object, so a poll landing mid-edit elsewhere
  // (e.g. a half-filled Episode form) can't clobber it. See use-league-poll.ts.
  setMidSeason: (midSeason: LeagueState["midSeason"]) => void;
  // Drops the loaded league (back to mode:'mock' with demo state underneath) WITHOUT clearing
  // identity, unlike useMock() -- for leaving your last league, where AuthGate should then show
  // the Dashboard to a still-signed-in user rather than treat them as an anonymous tour.
  clearLeague: () => void;
  // One-off message shown above the current tab (e.g. "Welcome back" after reclaiming a seat) --
  // there's no toast system in this app, so this is the lightweight equivalent.
  flash: string | null;
  setFlash: (flash: string | null) => void;
}

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  entered: false,
  setEntered: (entered) => set({ entered }),
  mode: "mock",
  state: buildMockSeasonState(),
  leagueId: null,
  leagueName: null,
  membership: null,
  userId: null,
  isSuperAdmin: false,
  impersonating: false,
  playerAccounts: [],
  leagues: [],
  useMock: () =>
    set({
      mode: "mock",
      state: buildMockSeasonState(),
      leagueId: null,
      leagueName: null,
      membership: null,
      userId: null,
      isSuperAdmin: false,
      impersonating: false,
      playerAccounts: [],
      leagues: [],
      flash: null,
    }),
  loadLive: (leagueId, state, leagueName, membership, userId, isSuperAdmin, playerAccounts) =>
    set({ mode: "live", leagueId, state, leagueName, membership, userId, isSuperAdmin, playerAccounts }),
  setIdentity: (userId, isSuperAdmin, impersonating) => set({ userId, isSuperAdmin, impersonating }),
  setLeagues: (leagues) => set({ leagues }),
  switchLeague: async (leagueId) => {
    const { league, state, membership, playerAccounts } = await api.leagueState(leagueId);
    set({ mode: "live", leagueId: league.id, state, leagueName: league.name, membership, playerAccounts });
  },
  setMidSeason: (midSeason) => set({ state: { ...get().state, midSeason } }),
  clearLeague: () =>
    set({ mode: "mock", state: buildMockSeasonState(), leagueId: null, leagueName: null, membership: null, playerAccounts: [] }),
  flash: null,
  setFlash: (flash) => set({ flash }),
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

export function useIsImpersonating(): boolean {
  return useLeagueStore((s) => s.impersonating);
}

// True for the "Take a Tour" / previewing-without-an-account case specifically -- not just any
// mock mode, since a real signed-in super-admin with zero personal leagues also stays mode:'mock'
// (see useIsAuthenticated's comment) but isn't "previewing a tour," they're just leagueless.
// Drives the exit-demo affordance (see auth-gate.tsx) -- port of the live app's isDemoMode gate
// on its persistent "Exit Demo" button, narrowed to the pre-auth case since useMock() already
// clears identity regardless of how demo mode was entered (see that action's own comment).
export function useIsPreviewingDemo(): boolean {
  return useLeagueStore((s) => s.mode === "mock" && !s.userId);
}
