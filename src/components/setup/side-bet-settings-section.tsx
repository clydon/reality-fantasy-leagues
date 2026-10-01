"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

// Port of renderSetup()'s Prediction Settings panel. bonusEnabled is a master on/off for the whole
// Side Bets system (both scoring and visibility -- see ScoringLogic.compute/EliminationOrder-
// ScoringStrategy.compute's `if(state.settings.bonusEnabled)` gate).
export function SideBetSettingsSection({ state }: { state: LeagueState }) {
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
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Prediction Settings</h3>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            disabled={!canManage}
            defaultChecked={state.settings.bonusEnabled}
            onChange={(e) => update("bonusEnabled", e.target.checked)}
          />
          Enable Predictions
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Default points if correct:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={state.settings.defaultBetPoints}
            onBlur={(e) => update("defaultBetPoints", parseInt(e.target.value) || 0)}
          />
        </label>
      </div>
    </div>
  );
}
