import { create } from "zustand";

// "How this league works" (docs/PLAN-league-explainer.md). The card it's on lives here rather than in
// the component: a late joiner's first load is redirected to /late-join mid-sequence, which remounts it.

interface ExplainerStore {
  open: boolean;
  /** Opened from More (not the once-after-joining showing): closing it records nothing. */
  replay: boolean;
  card: number;
  /** Changes the made-up results (the "Shuffle" link). */
  shuffles: number;
  /** Leagues it was closed in this session, so it doesn't reopen before the server has heard. */
  closedIn: string[];
  show: (replay: boolean) => void;
  go: (card: number) => void;
  shuffle: () => void;
  close: (leagueId: string | null) => void;
}

export const useExplainerStore = create<ExplainerStore>((set) => ({
  open: false,
  replay: false,
  card: 0,
  shuffles: 0,
  closedIn: [],
  show: (replay) => set({ open: true, replay, card: 0 }),
  go: (card) => set({ card }),
  shuffle: () => set((s) => ({ shuffles: s.shuffles + 1 })),
  close: (leagueId) => set((s) => ({ open: false, closedIn: leagueId ? [...s.closedIn, leagueId] : s.closedIn })),
}));
