"use client";

import { useEffect } from "react";
import { create } from "zustand";

// Admin > "Show paid AI actions": whether buttons that spend money on an AI call (wiki episode pulls,
// web research, prose paste-structuring, turning on auto-research) are shown at all. Off by default,
// so nothing paid is one stray click away; pulling a cast is exempt (cheap, once a season).
//
// Per browser, not app-wide: it's one admin's guard rail. Starts hidden and is read from storage after
// mount, so the first render never flashes paid buttons.
const KEY = "rfl.admin.showPaidAi";
// Admin > "Show episode results": off, an admin who's playing and behind can research, review and
// accept a season's results by the count -- names and outcomes stay hidden until they ask. Same
// per-browser, safe-default-first shape as the paid toggle.
const SPOILERS_KEY = "rfl.admin.showSpoilers";

interface PaidAiState {
  showPaid: boolean;
  setShowPaid: (v: boolean) => void;
  showSpoilers: boolean;
  setShowSpoilers: (v: boolean) => void;
}

export const usePaidAiStore = create<PaidAiState>((set) => ({
  showPaid: false,
  setShowPaid: (showPaid) => {
    set({ showPaid });
    try {
      localStorage.setItem(KEY, showPaid ? "1" : "0");
    } catch {
      /* not persisted this time -- the safe default comes back next visit */
    }
  },
  showSpoilers: false,
  setShowSpoilers: (showSpoilers) => {
    set({ showSpoilers });
    try {
      localStorage.setItem(SPOILERS_KEY, showSpoilers ? "1" : "0");
    } catch {
      /* not persisted this time */
    }
  },
}));

export const useShowPaidAi = () => usePaidAiStore((s) => s.showPaid);
export const useShowSpoilers = () => usePaidAiStore((s) => s.showSpoilers);

/** Call once where the toggle lives: loads the saved preference after mount. */
export function useLoadPaidAiPref() {
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") usePaidAiStore.setState({ showPaid: true });
      if (localStorage.getItem(SPOILERS_KEY) === "1") usePaidAiStore.setState({ showSpoilers: true });
    } catch {
      /* no storage: stay hidden */
    }
  }, []);
}
