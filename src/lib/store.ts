import { create } from "zustand";
import type { LeagueState } from "@/lib/game/types";
import { buildMockSeasonState } from "@/lib/game/mock-state";

// POC-scoped store: one league's state, exactly like the live app's single global `state`
// object (see CLAUDE.md's state model) but through Zustand instead of a bare global. No
// network/persistence yet -- this is the mock/demo dataset only, matching the live app's demo
// mode rather than a real per-league fetch, until the API-wiring phase after this POC.
interface LeagueStore {
  state: LeagueState;
  reset: () => void;
}

export const useLeagueStore = create<LeagueStore>((set) => ({
  state: buildMockSeasonState(),
  reset: () => set({ state: buildMockSeasonState() }),
}));
