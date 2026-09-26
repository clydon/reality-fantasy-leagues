"use client";

import { useRef } from "react";
import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore, useCanManage, useIsSuperAdmin } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm-store";

// Port of renderSetup()'s Backup panel. Export is client-only (dumps `state` as a JSON download)
// and works identically in both modes; Import and Reset are live-only (there's no persisted
// league to import into or reset in mock mode), matching the "no mock equivalent" pattern already
// established for Admin. Reset requires super-admin, not just commissioner -- matches the live
// app's server-side check (POST /reset re-verifies req.user.isSuperAdmin even though the route's
// role guard is only 'commissioner').
export function BackupSection({ state }: { state: LeagueState }) {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const isSuperAdmin = useIsSuperAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(leagueName || "league").replace(/\s+/g, "_")}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(await confirm("Import this backup? It will replace the league's entire current state.", { danger: true, confirmLabel: "Import" }))) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const next = await api.importLeagueState(leagueId!, raw);
      setState(next);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not import that file.");
    }
  }

  async function handleReset() {
    if (!(await confirm("Reset ALL data for this league? This cannot be undone.", { danger: true, confirmLabel: "Reset" }))) return;
    try {
      const next = await api.resetLeague(leagueId!);
      setState(next);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Reset failed.");
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Backup</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Download this league&rsquo;s entire state as a JSON file, or restore it from one — a manual safety net
        independent of the database, useful before a risky change or to keep your own copy.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleExport}>
          Export JSON
        </Button>
        {mode === "live" && canManage && (
          <>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </Button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </>
        )}
        {mode === "live" && isSuperAdmin && (
          <Button variant="destructive" onClick={handleReset}>
            Reset All Data
          </Button>
        )}
      </div>
    </div>
  );
}
