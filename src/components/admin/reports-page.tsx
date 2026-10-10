"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Report } from "@/lib/game/types";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { formatDateTime } from "@/lib/game/selectors";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, MoreButton } from "@/components/setup/settings-ui";
import { AdminPage, Notice, Rows, count, errorText } from "./admin-ui";

// Reports, inside the admin area now (docs/PLAN-ux-redesign.md 3g): what people sent with "Report an
// issue", newest first. A report is deleted once it's dealt with, so whatever's here is still open --
// which is why To do lists them.

export function ReportsPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-reports"], queryFn: () => api.adminListReports() });
  const [menu, setMenu] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reports = data?.reports ?? [];

  async function remove(r: Report) {
    setMenu(null);
    if (!(await confirm("Delete this report?", { danger: true, confirmLabel: "Delete" }))) return;
    setError(null);
    try {
      await api.adminDeleteReport(r.id);
      await refetch();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <AdminPage title="Reports" subtitle={data ? count(reports.length, "report") : undefined} back={{ href: "/admin", label: "To do" }}>
      {error && <Notice tone="bad">{error}</Notice>}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground">Nothing open.</p>
      ) : (
        <Rows>
          {reports.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                  {r.type === "feature" ? <Chip>Idea</Chip> : <Chip>Issue</Chip>}
                  <span className="font-semibold text-foreground">{r.username}</span>
                  <span>{formatDateTime(r.created_at)}</span>
                </span>
                <span className="whitespace-pre-wrap text-[15px] leading-snug">{r.message}</span>
                {(r.route || r.league_name) && <span className="text-[13px] text-muted-foreground">{[r.route, r.league_name].filter(Boolean).join(" · ")}</span>}
              </span>
              <MoreButton label="Report actions" onClick={() => setMenu(r)} />
            </div>
          ))}
        </Rows>
      )}
      {menu && (
        <BottomSheet open onOpenChange={(o) => !o && setMenu(null)} title={menu.type === "feature" ? "Idea" : "Issue"} description={menu.username}>
          <SheetAction danger onClick={() => remove(menu)}>
            Delete report
          </SheetAction>
        </BottomSheet>
      )}
    </AdminPage>
  );
}
