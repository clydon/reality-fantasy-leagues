"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useShowTerms } from "@/lib/use-show-terms";

// Port of renderSetup()'s Finale Prediction Settings panel. Gated by the same
// supportsFinalePredictions flag Mid-Season's panel checks (state-logic.js's LEAGUE_TYPES) --
// settings for a feature a league type doesn't support shouldn't be editable either.
export function FinaleSettingsSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  async function update(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  if (!StateLogic.getLeagueType(state).supportsFinalePredictions) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Finale Prediction Settings</h3>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          Points per correct Top-3 name:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={state.settings.finaleTop3Points}
            onBlur={(e) => update("finaleTop3Points", parseInt(e.target.value) || 0)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Points for correct Winner:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={state.settings.finaleWinnerPoints}
            onBlur={(e) => update("finaleWinnerPoints", parseInt(e.target.value) || 0)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Prediction scope:
          <Select
            disabled={!canManage}
            defaultValue={state.settings.finalePredictionScope}
            onChange={(e) => update("finalePredictionScope", e.target.value)}
          >
            <option value="open">Open — predict any {terms.castaway}</option>
            <option value="ownPicksOnly">Own picks only</option>
          </Select>
        </label>
      </div>
    </div>
  );
}
