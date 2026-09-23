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
interface LeagueStore {
  mode: "mock" | "live";
  state: LeagueState;
  leagueId: string | null;
  leagueName: string | null;
  membership: Membership | null;
  userId: string | null; // the signed-in user's own id (not their player id) -- chat reactions/ownership key off this, same as public/app.js's currentUser.id
  useMock: () => void;
  loadLive: (leagueId: string, state: LeagueState, leagueName: string, membership: Membership, userId: string) => void;
  setState: (state: LeagueState) => void;
}

export const useLeagueStore = create<LeagueStore>((set) => ({
  mode: "mock",
  state: buildMockSeasonState(),
  leagueId: null,
  leagueName: null,
  membership: null,
  userId: null,
  useMock: () =>
    set({ mode: "mock", state: buildMockSeasonState(), leagueId: null, leagueName: null, membership: null, userId: null }),
  loadLive: (leagueId, state, leagueName, membership, userId) =>
    set({ mode: "live", leagueId, state, leagueName, membership, userId }),
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
