"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Port of renderSetup()'s General Settings panel: teamSize (roster cap, consumed by
// DraftLogic.currentTurn's totalPicksNeeded) and replenishOrderBy (mid-season pick-order
// direction).
export function GeneralSettingsSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  async function update(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">General Settings</h3>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          Roster size (picks per player):
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={state.settings.teamSize}
            onBlur={(e) => update("teamSize", parseInt(e.target.value) || 1)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Replenish order:
          <Select
            disabled={!canManage}
            defaultValue={state.settings.replenishOrderBy}
            onChange={(e) => update("replenishOrderBy", e.target.value)}
          >
            <option value="mostPoints">Most points first</option>
            <option value="leastPoints">Least points first</option>
          </Select>
        </label>
      </div>
    </div>
  );
}
