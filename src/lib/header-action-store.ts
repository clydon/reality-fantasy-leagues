import { create } from "zustand";

// A page's own ⋯ in the mobile header (docs/PLAN-ux-declutter.md: the finished Draft's actions move
// up there instead of taking a row above its plate). A page sets it while it's mounted and clears it
// on the way out; the header shows it in place of chat while it's set.
export interface HeaderAction {
  label: string;
  onClick: () => void;
}

export const useHeaderAction = create<{ action: HeaderAction | null; set: (action: HeaderAction | null) => void }>((set) => ({
  action: null,
  set: (action) => set({ action }),
}));
