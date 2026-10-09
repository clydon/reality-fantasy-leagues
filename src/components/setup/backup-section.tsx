"use client";

import { useRef } from "react";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { PlainButton } from "@/components/draft/draft-ui";
import { SettingsPage } from "./settings-ui";

// League Settings > Backup (port of renderSetup()'s Backup panel). Export is client-only (dumps `state`
// as a JSON download) and works identically in both modes; Import is live-only (there's no persisted
// league to import into in mock mode).
export function BackupPage() {
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
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
    if (
      !(await confirm("Import this backup? It will replace the league's entire current state.", { danger: true, confirmLabel: "Import" }))
    )
      return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const next = await api.importLeagueState(leagueId!, raw);
      setState(next);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not import that file.");
    }
  }

  return (
    <SettingsPage title="Backup">
      <p className="text-base leading-relaxed text-muted-foreground">
        Download everything in this league as a file, or restore it from one. Your own copy, separate from the app&rsquo;s database: worth
        taking before a big change.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <PlainButton onClick={handleExport}>Download backup</PlainButton>
        {mode === "live" && canManage && (
          <>
            <PlainButton onClick={() => fileInputRef.current?.click()}>Restore from a file</PlainButton>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </>
        )}
      </div>
    </SettingsPage>
  );
}

// Reset requires super-admin, not just commissioner -- matches the server's own check (POST /reset
// re-verifies isSuperAdmin even though the route's role guard is only 'commissioner'). Lives in the
// settings index's Danger zone.
export function ResetLeagueButton() {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);

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
    <div className="flex flex-col gap-1.5">
      <PlainButton danger onClick={handleReset}>
        Reset all data
      </PlainButton>
      <p className="text-[13px] text-muted-foreground">Site admins only. Clears this league&rsquo;s data and can&rsquo;t be undone.</p>
    </div>
  );
}
