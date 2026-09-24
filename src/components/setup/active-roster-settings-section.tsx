"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useShowTerms } from "@/lib/use-show-terms";

// Active Roster's own settings section, gated on the league type's hasActiveRoster flag exactly the
// way FinaleSettingsSection gates on supportsFinalePredictions -- rather than being dumped into
// General Settings, which is about the roster/replenish concepts every roster league shares.
//
// The point-value list is generated from state-logic.js's ACTIVE_ROSTER_EVENTS, so adding an event
// type to that catalog gives it an input here automatically. Same "one point input per category"
// shape as SideBetSettingsSection, including that a commissioner can zero a category out rather than
// being stuck with whichever ones the catalog happens to ship.
export function ActiveRosterSettingsSection({ state }: { state: LeagueState }) {
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

  // eventPoints is one settings field holding a map, so a single input writes the whole object back
  // with that one key changed -- updateSettings is a flat field/value setter, it has no notion of
  // nested paths.
  async function updateEventPoints(type: string, points: number) {
    const next = { ...state.settings.eventPoints, [type]: points };
    await update("eventPoints", next);
  }

  if (!StateLogic.getLeagueType(state).hasActiveRoster) return null;

  const activeSlots = state.settings.activeSlots;
  const benchSlots = state.settings.benchSlots;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Active Roster Settings</h3>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          Active slots:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={activeSlots}
            onBlur={(e) => update("activeSlots", Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Bench slots:
          <Input
            type="number"
            className="w-16"
            disabled={!canManage}
            defaultValue={benchSlots}
            onBlur={(e) => update("benchSlots", Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Each player drafts <b>{activeSlots + benchSlots}</b> {terms.castaways} and fields <b>{activeSlots}</b> each
          episode.
        </span>
      </div>

      <h4 className="mb-1.5 text-xs font-bold">Points per event</h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Only your active {terms.castaways} earn these. Set a category to <b>0</b> to switch it off.
      </p>
      <div className="flex flex-col gap-1.5">
        {StateLogic.ACTIVE_ROSTER_EVENTS.map((ev) => (
          <label key={ev.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{ev.label}</span>
            <Input
              type="number"
              className="w-16"
              disabled={!canManage}
              defaultValue={StateLogic.ActiveRosterLogic.pointsFor(state, ev.id)}
              onBlur={(e) => updateEventPoints(ev.id, parseInt(e.target.value) || 0)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
