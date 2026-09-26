"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InfoHint } from "@/components/info-hint";

// Port of renderSetup()'s General Settings panel: teamSize (roster cap, consumed by
// DraftLogic.currentTurn's totalPicksNeeded) and replenishOrderBy (mid-season pick-order
// direction), plus the two opt-in mid-season toggles (Replenish/Swap, both default off). Gated on
// hasRoster -- every field here is a roster concept (replenish specifically is a roster-loss
// backfill mechanic), meaningless for a league type with no roster at all (pickem).
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

  const leagueType = StateLogic.getLeagueType(state);
  if (!leagueType.hasRoster) return null;

  // Every field below is independently gated (teamSize by !hasActiveRoster, the two toggles by
  // supports*, replenish order by replenishAvailable) -- a shared-ownership Active Roster league
  // fails all of them at once (no teamSize field, and shared ownership forces supportsReplenish/
  // supportsTrade false), which would otherwise leave the header floating over an empty panel.
  const hasAnyField =
    !leagueType.hasActiveRoster ||
    leagueType.supportsReplenish ||
    leagueType.supportsTrade ||
    StateLogic.replenishAvailable(state);
  if (!hasAnyField) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">General Settings</h3>
      <div className="flex flex-wrap items-center gap-4">
        {/* Active Roster derives its roster size from activeSlots+benchSlots (see rosterSize), so an
            independent teamSize field there would silently do nothing. */}
        {!leagueType.hasActiveRoster && (
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
        )}
        {/* Both mid-season mechanics are opt-in (default off). Hidden entirely when the league
            type can't support them at all -- shared ownership has no free agents for either to draw
            on -- so the commissioner is never offered a switch that would do nothing. */}
        {leagueType.supportsReplenish && (
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              disabled={!canManage}
              checked={state.settings.replenishEnabled}
              onChange={(e) => update("replenishEnabled", e.target.checked)}
            />
            Enable Replenish
            <InfoHint text="When a player's roster spot is eliminated, they draft a replacement from the remaining free agents." />
          </label>
        )}
        {leagueType.supportsTrade && (
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              disabled={!canManage}
              checked={state.settings.tradeEnabled}
              onChange={(e) => update("tradeEnabled", e.target.checked)}
            />
            Enable Swap
            <InfoHint text="Players can trade a castaway on their roster for one on another player's roster." />
          </label>
        )}
        {StateLogic.replenishAvailable(state) && (
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
        )}
      </div>
    </div>
  );
}
