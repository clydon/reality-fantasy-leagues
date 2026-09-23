"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Port of renderSetup()'s League Name + Draft Schedule panels, plus new League Type / Show
// pickers (not in the live app at all -- see state-logic.js's LEAGUE_TYPES/SHOWS). Both are
// populated from the real registry so a second entry becomes selectable the moment one is
// registered, but stay disabled today since there's only one of each and the draft may already
// be running -- "commissioner picks before the season starts" only means something once a second
// option actually exists.
export function LeagueInfoSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [name, setName] = useState(leagueName ?? "");

  const draftStarted = StateLogic.isDraftStarted(state);
  const leagueType = StateLogic.getLeagueType(state);
  const typeLocked = !canManage || draftStarted || Object.keys(StateLogic.LEAGUE_TYPES).length <= 1;
  const showLocked = !canManage || draftStarted || Object.keys(StateLogic.SHOWS).length <= 1;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === leagueName) return;
    await mutate(
      () => {
        /* mock mode has no persisted league name to rename */
      },
      () => api.renameLeague(leagueId!, trimmed)
    );
  }

  async function updateSetting(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">League Info</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Name:
          <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Draft scheduled for:
          <Input
            type="datetime-local"
            disabled={!canManage}
            defaultValue={state.settings.draftScheduledAt ? state.settings.draftScheduledAt.slice(0, 16) : ""}
            onBlur={(e) => updateSetting("draftScheduledAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </label>
        {state.draftForceStarted && <span className="text-xs text-muted-foreground">(force-started — schedule is moot)</span>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          League Type:
          <Select value={leagueType.id} disabled={typeLocked} onChange={(e) => updateSetting("leagueTypeId", e.target.value)}>
            {Object.values(StateLogic.LEAGUE_TYPES).map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Show:
          <Select
            value={state.settings.showId}
            disabled={showLocked}
            onChange={(e) => updateSetting("showId", e.target.value)}
          >
            {Object.values(StateLogic.SHOWS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{leagueType.description}</p>
    </div>
  );
}
