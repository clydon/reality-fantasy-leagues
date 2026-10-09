"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowTerms } from "@/lib/use-show-terms";
import { NotInThisLeague, ReadOnlyNote, RowList, SettingsPage, StepperRow, ToggleRow } from "./settings-ui";

// League Settings > Lineups, Active Roster only (gated on the league type's hasActiveRoster flag):
// how many start and how many sit on the bench -- which together are the roster size (rosterSize) --
// and whether other players' starters stay hidden until lineups lock. What each event is worth moved
// to Scoring & rules (rules-section.tsx).
export function LineupsPage() {
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

  if (!StateLogic.getLeagueType(state).hasActiveRoster) {
    return (
      <SettingsPage title="Lineups">
        <NotInThisLeague what="lineups" />
      </SettingsPage>
    );
  }

  const { activeSlots, benchSlots } = state.settings;
  return (
    <SettingsPage title="Lineups">
      <ReadOnlyNote />
      <p className="text-base leading-relaxed text-muted-foreground">
        Each player drafts {activeSlots + benchSlots} {terms.castaways} and starts {activeSlots} of them each episode. Only starters score.
      </p>
      <RowList>
        <StepperRow label="Starters" value={activeSlots} min={1} disabled={!canManage} onChange={(n) => update("activeSlots", n)} />
        <StepperRow label="Bench" value={benchSlots} min={0} disabled={!canManage} onChange={(n) => update("benchSlots", n)} />
        <ToggleRow
          label="Hide starters until airtime"
          hint="Others only see whether you've set your lineup until it locks when the episode airs, so nobody can copy it."
          checked={!!state.settings.hideStartersUntilLock}
          disabled={!canManage}
          onChange={(v) => update("hideStartersUntilLock", v)}
        />
      </RowList>
    </SettingsPage>
  );
}
