import { create } from "zustand";

// Lets something outside the mobile nav open its More menu (the What's New "Show me" link): a request
// counter the nav watches, so each request opens it once.
export const useMoreSheetRequest = create<{ requests: number; open: () => void }>((set) => ({
  requests: 0,
  open: () => set((s) => ({ requests: s.requests + 1 })),
}));
