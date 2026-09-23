"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Port of renderSetup()'s Castaways panel (unlabeled in the live app too -- it directly follows
// Tribes). Removing a castaway is a hard delete (StateLogic.removeCastaway), unlike removing a
// tribe or player, which only un-assign -- matches the original exactly, including no confirm
// warning about drafted castaways since the live app doesn't have one there either.
export function CastawaysSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName("");
    await mutate(
      (s) => StateLogic.addCastaway(s, trimmed),
      () => api.addCastaway(leagueId!, trimmed)
    );
  }

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateCastaway(s, id, field, value),
      () => api.updateCastaway(leagueId!, id, field, value)
    );
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await mutate(
      (s) => StateLogic.removeCastaway(s, id),
      () => api.removeCastaway(leagueId!, id)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        {state.castaways.map((c) => {
          const owner = c.ownerId ? StateLogic.getPlayer(state, c.ownerId) : null;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm">
              <Input
                size="sm"
                className="min-w-[120px] flex-1"
                defaultValue={c.name}
                disabled={!canManage}
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c.id, "name", e.target.value.trim())}
              />
              <Select size="sm" value={c.tribeId ?? ""} disabled={!canManage} onChange={(e) => update(c.id, "tribeId", e.target.value || null)}>
                <option value="">— no tribe —</option>
                {state.tribes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Input
                size="sm"
                className="min-w-[140px] flex-1"
                placeholder="Photo URL"
                defaultValue={c.photoUrl ?? ""}
                disabled={!canManage}
                onBlur={(e) => e.target.value !== (c.photoUrl ?? "") && update(c.id, "photoUrl", e.target.value)}
              />
              <span className="text-xs text-muted-foreground">{owner ? owner.name : "Free agent"}</span>
              <span className="text-xs text-muted-foreground">
                {c.status === "eliminated" ? `#${c.placementOrder} — ${c.exitMethod}` : "Active"}
              </span>
              {canManage && (
                <Button variant="destructive" size="sm" onClick={() => remove(c.id, c.name)}>
                  Remove
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {canManage && (
        <div className="mt-3 flex gap-1.5">
          <Input
            className="min-w-0 flex-1"
            placeholder="New castaway name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd}>Add Castaway</Button>
        </div>
      )}
    </div>
  );
}
