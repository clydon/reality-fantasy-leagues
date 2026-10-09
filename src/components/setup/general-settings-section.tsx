"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowTerms } from "@/lib/use-show-terms";
import { Field, LockedValue, NotInThisLeague, ReadOnlyNote, RowList, SettingsPage, StepperRow, ToggleRow, fieldCls } from "./settings-ui";

// League Settings > Swaps & pickups: the two opt-in mid-season mechanics (Pickups, i.e. replenish,
// and Swap; both default off), Active Roster's thresholds for them, and who goes first. Roster size,
// which used to sit here too, is in League setup (Classic) or Lineups (Active Roster).
//
// Hidden from the index when the league type can't support either -- shared ownership has no free
// agents for them to draw on -- so the commissioner is never offered a switch that would do nothing.
const ORDER_LABELS = {
  rolling: "Reverse draft order, rolling",
  leastPoints: "Standings, fewest points first",
  mostPoints: "Standings, most points first",
};

export function PickupsPage() {
  const state = useLeagueStore((s) => s.state);
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

  const type = StateLogic.getLeagueType(state);
  const activeRoster = !!type.hasActiveRoster;
  if (!type.supportsReplenish && !type.supportsTrade) {
    return (
      <SettingsPage title="Swaps & pickups">
        <NotInThisLeague what="swaps or pickups" />
      </SettingsPage>
    );
  }
  const replenishAt = StateLogic.MidSeasonLogic.replenishAt(state);
  const swapEvery = StateLogic.MidSeasonLogic.swapEvery(state);
  const anyOn = StateLogic.replenishAvailable(state) || StateLogic.tradeAvailable(state);

  return (
    <SettingsPage title="Swaps & pickups">
      <ReadOnlyNote />
      <p className="text-base leading-relaxed text-muted-foreground">
        The commissioner starts each round. Then each player picks up, swaps or skips on their own turn, and the commissioner can act for
        anyone.
      </p>
      <RowList>
        {type.supportsReplenish && (
          <ToggleRow
            label="Pickups"
            hint={
              activeRoster
                ? `When a roster runs low on ${terms.castaways} still in the game, its owner picks up free agents to fill it again. Each pickup releases one of their eliminated ${terms.castaways}.`
                : `When someone on a team is eliminated, its owner picks up a replacement from the free agents.`
            }
            checked={state.settings.replenishEnabled}
            disabled={!canManage}
            onChange={(v) => update("replenishEnabled", v)}
          />
        )}
        {activeRoster && StateLogic.replenishAvailable(state) && (
          <StepperRow
            label="Pick up when down to"
            hint={`${terms.Castaways} still in the game. Default ${Math.max(0, state.settings.activeSlots - 1)}: the moment a team can't fill all ${state.settings.activeSlots} starting spots.`}
            value={replenishAt}
            min={0}
            disabled={!canManage}
            onChange={(n) => update("replenishAt", n)}
          />
        )}
        {type.supportsTrade && (
          <ToggleRow
            label="Swap"
            hint={
              activeRoster
                ? `At each swap window, every player may drop one ${terms.castaway} still in the game and add one who's free.`
                : `One at a time, each player may drop one ${terms.castaway} and add a free agent.`
            }
            checked={state.settings.tradeEnabled}
            disabled={!canManage}
            onChange={(v) => update("tradeEnabled", v)}
          />
        )}
        {activeRoster && StateLogic.tradeAvailable(state) && (
          <StepperRow
            label="Swap window every"
            hint={`${swapEvery === 1 ? "episode" : "episodes"}. Default 3: four or five windows a season, enough to fix a bad pick without chasing every result.`}
            value={swapEvery}
            min={1}
            disabled={!canManage}
            onChange={(n) => update("swapEvery", n)}
          />
        )}
      </RowList>
      {anyOn && !canManage && (
        <LockedValue
          label="Who goes first"
          value={ORDER_LABELS[state.settings.replenishOrderBy as keyof typeof ORDER_LABELS] ?? state.settings.replenishOrderBy}
          lock={false}
        />
      )}
      {anyOn && canManage && (
        <Field
          label="Who goes first"
          htmlFor="mid-order"
          hint={
            "Reverse draft order, rolling: starts with the draft's last pick, and whoever makes a move goes to the back, so waiting keeps your spot. Standings reset the order every round." +
            (state.settings.ownershipMode === "shared"
              ? " In a shared league everyone can add the same person, so this only sets the order of turns."
              : "")
          }
        >
          <select
            id="mid-order"
            className={fieldCls}
            value={state.settings.replenishOrderBy}
            onChange={(e) => update("replenishOrderBy", e.target.value)}
          >
            {Object.entries(ORDER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}
    </SettingsPage>
  );
}
