"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowTerms } from "@/lib/use-show-terms";
import { Field, GroupHead, LockedValue, ReadOnlyNote, RowList, SettingsPage, StepperRow, ToggleRow, fieldCls } from "./settings-ui";

// League Settings > Predictions: the weekly predictions (side bets) and, for league types that have
// them (supportsFinalePredictions, the same flag the Waivers page checks), finale predictions, each as a
// toggle row with its points underneath. bonusEnabled is a master on/off for the whole predictions
// system, both scoring and visibility (StateLogic.betsOn), beside a draft: nothing else scores them.
export function PredictionsPage() {
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

  const s = state.settings;
  const finale = StateLogic.getLeagueType(state).supportsFinalePredictions;

  return (
    <SettingsPage title="Predictions">
      <ReadOnlyNote />
      <section className="flex flex-col">
        <GroupHead>Each episode</GroupHead>
        <RowList>
          <ToggleRow
            label="Predictions"
            hint="Anyone can ask a question about the next episode; everyone who calls it right scores. A question needs at least two answers to pay out."
            checked={!!StateLogic.betsOn(state)}
            disabled={!canManage}
            onChange={(v) => update("bonusEnabled", v)}
          />
          {!!StateLogic.betsOn(state) && (
            <StepperRow
              label="Points if right"
              hint="The starting value for a new question."
              value={s.defaultBetPoints}
              min={0}
              disabled={!canManage}
              onChange={(n) => update("defaultBetPoints", n)}
            />
          )}
        </RowList>
      </section>

      {finale && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col">
            <GroupHead>Finale</GroupHead>
            <RowList>
              <ToggleRow
                label="Finale predictions"
                hint={`Before the finale, everyone names their final three and the winner.`}
                checked={s.finalePredictionsEnabled}
                disabled={!canManage}
                onChange={(v) => update("finalePredictionsEnabled", v)}
              />
              {s.finalePredictionsEnabled && (
                <StepperRow
                  label="Each correct finalist"
                  value={s.finaleTop3Points}
                  min={0}
                  disabled={!canManage}
                  onChange={(n) => update("finaleTop3Points", n)}
                />
              )}
              {s.finalePredictionsEnabled && (
                <StepperRow
                  label="Correct winner"
                  value={s.finaleWinnerPoints}
                  min={0}
                  disabled={!canManage}
                  onChange={(n) => update("finaleWinnerPoints", n)}
                />
              )}
            </RowList>
          </div>
          {s.finalePredictionsEnabled && !canManage && (
            <LockedValue
              label="Who they can name"
              value={s.finalePredictionScope === "ownPicksOnly" ? "Only their own team" : `Any ${terms.castaway}`}
              lock={false}
            />
          )}
          {s.finalePredictionsEnabled && canManage && (
            <Field label="Who they can name" htmlFor="finale-scope">
              <select
                id="finale-scope"
                className={fieldCls}
                value={s.finalePredictionScope}
                onChange={(e) => update("finalePredictionScope", e.target.value)}
              >
                <option value="open">Any {terms.castaway}</option>
                <option value="ownPicksOnly">Only their own team</option>
              </select>
            </Field>
          )}
        </section>
      )}
    </SettingsPage>
  );
}
