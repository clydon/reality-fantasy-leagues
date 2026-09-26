"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

// Pick'em only: just the one setting (points per correct weekly pick) this league type needs, so
// it's a single field rather than a whole section per se -- but still its own gated block,
// matching FinaleSettingsSection's exact pattern (gated on a league-type flag, hidden entirely
// for a league type that doesn't use it) rather than being dumped into General Settings, which
// is about roster/replenish concepts this league type doesn't have.
export function PickEmSettingsSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  async function update(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  if (!StateLogic.getLeagueType(state).hasWeeklyPicks) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Eliminator Pool Settings</h3>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          Points per correct pick:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={state.settings.pickemCorrectPoints}
            onBlur={(e) => update("pickemCorrectPoints", parseInt(e.target.value) || 0)}
          />
        </label>
      </div>
    </div>
  );
}
