"use client";

import { useEffect } from "react";
import { useIsSuperAdmin } from "@/lib/store";
import { useReportsStore } from "@/lib/reports-store";
import { formatDateTime } from "@/lib/game/selectors";

// Direct port of renderAdminReports() (public/app.js) -- a genuinely tabular view (per that
// file's own comment: "genuinely tabular data, unlike everything else here"), so this is the one
// place in this POC that uses a real <table> instead of the card-grid vocabulary everywhere else.
// Same super-admin gate as AdminTab (isSuperAdmin alone, not mode -- see that file's comment for
// why the mode check was wrong), and same reasoning: no mock-mode equivalent exists in the live
// app either.
export function ReportsTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const { reports, loaded, load, deleteReport } = useReportsStore();

  useEffect(() => {
    if (isSuperAdmin && !loaded) load();
  }, [isSuperAdmin, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperAdmin) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Bug &amp; Feature Reports</h2>
        <p className="text-sm text-muted-foreground">
          Reports is only available when signed in as a real super-admin account — same as the live app, which never
          shows this nav link to anyone else, demo mode included.
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Bug &amp; Feature Reports</h2>
      {reports.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No reports yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[0.88rem]">
            <thead>
              <tr>
                {["From", "Type", "Where", "Message", "When", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b-2 border-border px-2.5 py-2 text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-2.5 py-2 align-top">{r.username}</td>
                  <td className="border-b border-border px-2.5 py-2 align-top">{r.type === "feature" ? "💡 Idea" : "🐛 Issue"}</td>
                  <td className="border-b border-border px-2.5 py-2 align-top">
                    {r.route || "—"}
                    {r.league_name && <div className="text-xs text-muted-foreground">{r.league_name}</div>}
                  </td>
                  <td className="whitespace-pre-wrap border-b border-border px-2.5 py-2 align-top">{r.message}</td>
                  <td className="whitespace-nowrap border-b border-border px-2.5 py-2 align-top text-xs text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2 align-top">
                    <button
                      className="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                      onClick={() => deleteReport(r.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
