import { create } from "zustand";

// Port of openReportModal()/closeReportModal()'s single #reportModal toggle (public/app.js) --
// a tiny store rather than component state since the trigger (Sidebar, MobileNav's More sheet)
// and the modal itself (mounted once in AuthGate's shell) are different components.
interface ReportModalStore {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useReportModalStore = create<ReportModalStore>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
}));
