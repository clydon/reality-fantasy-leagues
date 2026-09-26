import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_OVERVIEW_ORDER, type OverviewSectionId } from "./overview-layout";

// A super admin's own trial layout for Overview -- reorder/hide sections to see what's actually
// useful before settling on a real layout for everyone (see overview-customize-panel.tsx). Purely a
// personal, client-side preference for now (localStorage via zustand's persist, not synced anywhere)
// -- nothing here changes what any other user sees, in a real league or a demo. Works in demo mode
// too since it's keyed on nothing but the browser: see overview-dashboard.tsx's gate on
// useIsSuperAdmin() for the other half of "on demos too."
interface OverviewLayoutStore {
  order: OverviewSectionId[];
  hidden: Record<string, boolean>;
  moveUp: (id: OverviewSectionId) => void;
  moveDown: (id: OverviewSectionId) => void;
  toggleHidden: (id: OverviewSectionId) => void;
  reset: () => void;
}

function swap(order: OverviewSectionId[], id: OverviewSectionId, dir: -1 | 1): OverviewSectionId[] {
  const idx = order.indexOf(id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

export const useOverviewLayoutStore = create<OverviewLayoutStore>()(
  persist(
    (set) => ({
      order: DEFAULT_OVERVIEW_ORDER,
      hidden: {},
      moveUp: (id) => set((s) => ({ order: swap(s.order, id, -1) })),
      moveDown: (id) => set((s) => ({ order: swap(s.order, id, 1) })),
      toggleHidden: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } })),
      reset: () => set({ order: DEFAULT_OVERVIEW_ORDER, hidden: {} }),
    }),
    { name: "rfl-overview-layout" }
  )
);
