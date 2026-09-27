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
  const activeRoster = !!leagueType.hasActiveRoster;
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
            <InfoHint
              text={
                activeRoster
                  ? "When a roster is down to a set number of players still in the game, its owner adds players back up to one more than that — enough to keep fielding a full lineup. Each pick releases one of their eliminated players."
                  : "When a player's roster spot is eliminated, they draft a replacement from the remaining free agents."
              }
            />
          </label>
        )}
        {activeRoster && StateLogic.replenishAvailable(state) && (
          <label className="flex items-center gap-1.5 text-sm">
            Replenish when a roster is down to
            <Input
              type="number"
              min={0}
              className="w-14"
              disabled={!canManage}
              defaultValue={StateLogic.MidSeasonLogic.replenishAt(state)}
              onBlur={(e) => {
                const n = parseInt(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n !== StateLogic.MidSeasonLogic.replenishAt(state)) update("replenishAt", n);
              }}
            />
            still in the game
            <InfoHint text={`Default ${Math.max(0, state.settings.activeSlots - 1)}: the moment someone can't fill all ${state.settings.activeSlots} active slots. Higher is more forgiving of early boots; it never refills a bench.`} />
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
            <InfoHint
              text={
                activeRoster
                  ? "At each scheduled swap window, every player may drop one of their players still in the game and add one who's available."
                  : "Players can trade a castaway on their roster for one on another player's roster."
              }
            />
          </label>
        )}
        {activeRoster && StateLogic.tradeAvailable(state) && (
          <label className="flex items-center gap-1.5 text-sm">
            Swap window every
            <Input
              type="number"
              min={1}
              className="w-14"
              disabled={!canManage}
              defaultValue={StateLogic.MidSeasonLogic.swapEvery(state)}
              onBlur={(e) => {
                const n = parseInt(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n !== StateLogic.MidSeasonLogic.swapEvery(state)) update("swapEvery", n);
              }}
            />
            episodes
            <InfoHint text="Default 3. Every week turns into chasing whoever just won immunity and makes the draft matter less; every three gives four or five windows a season — enough to fix a bad pick or react to the merge." />
          </label>
        )}
        {(StateLogic.replenishAvailable(state) || StateLogic.tradeAvailable(state)) && (
          <label className="flex items-center gap-1.5 text-sm">
            Priority:
            <Select
              disabled={!canManage}
              defaultValue={state.settings.replenishOrderBy}
              onChange={(e) => update("replenishOrderBy", e.target.value)}
            >
              <option value="rolling">Reverse draft order, rolling</option>
              <option value="leastPoints">Standings — fewest points first</option>
              <option value="mostPoints">Standings — most points first</option>
            </Select>
            <InfoHint
              text={
                "Who goes first in a replenish or swap round. Rolling (recommended): starts with the last pick of the draft; whoever makes a move goes to the back, so waiting keeps your spot. Fewest points first resets every round from the standings." +
                (state.settings.ownershipMode === "shared"
                  ? " In a shared league everyone can add the same person, so this only sets the order of turns."
                  : "")
              }
            />
          </label>
        )}
      </div>
    </div>
  );
}
