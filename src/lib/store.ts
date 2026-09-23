import { create } from "zustand";
import type { LeagueState } from "@/lib/game/types";
import { buildMockSeasonState } from "@/lib/game/mock-state";

// POC-scoped store: one league's state, exactly like the live app's single global `state`
// object (see CLAUDE.md's state model) but through Zustand instead of a bare global. Two
// sources: the ported mock/demo dataset (matches the live app's demo mode), or `state` fetched
// live from the real Express API (see src/lib/api.ts + AuthGate) -- `mode` tracks which one is
// currently displayed so the UI can show a "Demo data" indicator when it's not real.
interface LeagueStore {
  mode: "mock" | "live";
  state: LeagueState;
  leagueName: string | null;
  useMock: () => void;
  loadLive: (state: LeagueState, leagueName: string) => void;
}

export const useLeagueStore = create<LeagueStore>((set) => ({
  mode: "mock",
  state: buildMockSeasonState(),
  leagueName: null,
  useMock: () => set({ mode: "mock", state: buildMockSeasonState(), leagueName: null }),
  loadLive: (state, leagueName) => set({ mode: "live", state, leagueName }),
}));
