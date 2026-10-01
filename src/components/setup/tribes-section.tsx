"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/lib/confirm-store";
import { ColorInput } from "@/components/ui/color-input";

// Port of renderSetup()'s Tribes panel. Removing a tribe un-assigns (not removes) any castaways
// in it -- RosterLogic.removeTribe sets their tribeId back to null rather than touching the
// castaway records themselves.
export function TribesSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const mutate = useMutate();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#45a89a");

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName("");
    await mutate(
      (s) => StateLogic.addTribe(s, trimmed, newColor),
      () => api.addTribe(leagueId!, trimmed, newColor)
    );
  }

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateTribe(s, id, field, value),
      () => api.updateTribe(leagueId!, id, field, value)
    );
  }

  async function remove(id: string, name: string) {
    if (!(await confirm(`Remove ${terms.tribe} "${name}"? Its ${terms.castaways} become ${terms.tribe}-less, not removed.`, { danger: true, confirmLabel: "Remove" }))) return;
    await mutate(
      (s) => StateLogic.removeTribe(s, id),
      () => api.removeTribe(leagueId!, id)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{terms.Tribes}</h3>
      {state.tribes.length === 0 ? (
        <div className="mb-2 text-sm italic text-muted-foreground">No {terms.tribes} yet.</div>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {state.tribes.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm">
              <ColorInput value={t.color} disabled={!canManage} onChange={(hex) => update(t.id, "color", hex)} />
              <Input
                size="sm"
                className="min-w-0 flex-1"
                defaultValue={t.name}
                disabled={!canManage}
                onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && update(t.id, "name", e.target.value.trim())}
              />
              {canManage && (
                <Button variant="destructive" size="sm" onClick={() => remove(t.id, t.name)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <div className="flex gap-1.5">
          <ColorInput value={newColor} onChange={setNewColor} swatchClassName="h-9 w-9" />
          <Input
            className="min-w-0 flex-1"
            placeholder={`New ${terms.tribe} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd}>Add {terms.Tribe}</Button>
        </div>
      )}
    </div>
  );
}
