import { create } from "zustand";
import type { Report } from "@/lib/game/types";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";

// Port of the live app's separate adminReports global + enterReportsTab()/renderAdminReports()
// (public/app.js) -- its own store rather than folded into admin-store.ts, matching how the
// original keeps Reports as a genuinely separate tab from Admin (own state, own route), even
// though both are super-admin-gated the same way.
interface ReportsStore {
  reports: Report[];
  loaded: boolean;
  load: () => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
}

export const useReportsStore = create<ReportsStore>((set, get) => ({
  reports: [],
  loaded: false,
  async load() {
    const { reports } = await api.adminListReports();
    set({ reports, loaded: true });
  },
  async deleteReport(id) {
    if (!(await confirm("Delete this report?", { danger: true, confirmLabel: "Delete" }))) return;
    await api.adminDeleteReport(id);
    set({ reports: get().reports.filter((r) => r.id !== id) });
  },
}));
