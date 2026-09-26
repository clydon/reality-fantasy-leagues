import { create } from "zustand";

// Same tiny pattern as report-modal-store.ts: the trigger (Sidebar, MobileNav's tab slot and More
// sheet) and the modal itself (mounted once in AuthGate's shell) are different components.
interface DemoSeasonPickerStore {
  open: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

export const useDemoSeasonPickerStore = create<DemoSeasonPickerStore>((set) => ({
  open: false,
  openPicker: () => set({ open: true }),
  closePicker: () => set({ open: false }),
}));
