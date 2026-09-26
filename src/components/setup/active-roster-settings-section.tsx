"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useShowTerms } from "@/lib/use-show-terms";

// Active Roster's own settings section, gated on the league type's hasActiveRoster flag exactly the
// way FinaleSettingsSection gates on supportsFinalePredictions -- rather than being dumped into
// General Settings, which is about the roster/replenish concepts every roster league shares.
//
// The point-value list is generated from the league's format's event catalog (formats/), so adding an
// event type to that catalog gives it an input here automatically. Same "one point input per category"
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

  const recommended = StateLogic.defaultEventPoints(state);
  const usingRecommended = Object.keys(recommended).every(
    (id) => StateLogic.ActiveRosterLogic.pointsFor(state, id) === recommended[id]
  );
  async function applyRecommended() {
    await update("eventPoints", { ...state.settings.eventPoints, ...recommended });
  }

  if (!StateLogic.getLeagueType(state).hasActiveRoster) return null;

  const activeSlots = state.settings.activeSlots;
  const benchSlots = state.settings.benchSlots;

  return (
    <>
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
    </div>

    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">League Scoring</h3>
        {canManage && !usingRecommended && (
          <Button variant="secondary" size="xs" className="ml-auto" onClick={applyRecommended}>
            Use recommended values
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Points per event — decimals are fine (e.g. 0.5). Only your active {terms.castaways} earn these. Set a category
        to <b>0</b> to switch it off. Recommended values are balanced for{" "}
        <b>{state.settings.ownershipMode === "shared" ? "shared" : "exclusive"}</b> ownership
        {state.settings.ownershipMode === "shared"
          ? "."
          : ": winner-heavy categories count for less, so owning the winner outright doesn't decide the league."}
      </p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {StateLogic.formatOf(state).events.map((ev) => (
          <label key={ev.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
            <span>
              {ev.label}
              {ev.implied && (
                <span className="ml-1 text-xs text-muted-foreground" title="Scored automatically from how they left or their role">
                  (automatic)
                </span>
              )}
            </span>
            <Input
              // Keyed on the value so "Use recommended values" (a whole-map write) refreshes every box.
              key={`${ev.id}:${StateLogic.ActiveRosterLogic.pointsFor(state, ev.id)}`}
              type="number"
              step="0.5"
              inputMode="decimal"
              className="w-20"
              disabled={!canManage}
              defaultValue={StateLogic.ActiveRosterLogic.pointsFor(state, ev.id)}
              onBlur={(e) => {
                const n = parseFloat(e.target.value);
                const next = Number.isFinite(n) ? StateLogic.roundPoints(n) : 0;
                if (next !== StateLogic.ActiveRosterLogic.pointsFor(state, ev.id)) updateEventPoints(ev.id, next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
    </>
  );
}
