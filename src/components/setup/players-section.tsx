"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShowTerms } from "@/lib/use-show-terms";
import { confirm } from "@/lib/confirm-store";

// Port of renderSetup()'s Players panel: color/name edit, remove, and activating a player who
// joined after the draft concluded (RosterLogic.addPlayer marks them inactive in that case --
// there's no fair turn order left to slot them into, so the commissioner assigns free agents
// directly instead of a live pick).
export function PlayersSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const playerAccounts = useLeagueStore((s) => s.playerAccounts);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [newName, setNewName] = useState("");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateIds, setActivateIds] = useState<string[]>([]);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName("");
    await mutate(
      (s) => StateLogic.addPlayer(s, trimmed),
      () => api.addPlayer(leagueId!, trimmed)
    );
  }

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updatePlayer(s, id, field, value),
      () => api.updatePlayer(leagueId!, id, field, value)
    );
  }

  async function remove(id: string, name: string) {
    const warning = hasRoster
      ? `Remove "${name}"? Their drafted ${terms.castaways} will become free agents.`
      : `Remove "${name}"?`;
    if (!(await confirm(warning, { danger: true, confirmLabel: "Remove" }))) return;
    await mutate(
      (s) => StateLogic.removePlayer(s, id),
      () => api.removePlayer(leagueId!, id)
    );
  }

  async function activate(id: string) {
    const ids = activateIds;
    setActivatingId(null);
    setActivateIds([]);
    await mutate(
      (s) => StateLogic.activatePlayer(s, id, ids),
      () => api.activatePlayer(leagueId!, id, ids)
    );
  }

  const freeAgents = StateLogic.freeAgents(state);
  const hasRoster = StateLogic.getLeagueType(state).hasRoster;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Players</h3>
      <div className="flex flex-col gap-2">
        {state.players.map((p) => {
          const account = playerAccounts.find((a) => a.player_id === p.id);
          const activeCount = StateLogic.activeOwnedCount(state, p.id);
          return (
            <div key={p.id} className="rounded-md border border-border p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="color"
                  className="h-7 w-7 shrink-0 rounded border border-border p-0"
                  value={p.color}
                  disabled={!canManage}
                  onChange={(e) => update(p.id, "color", e.target.value)}
                />
                <Input
                  size="sm"
                  className="min-w-0 flex-1"
                  defaultValue={p.name}
                  disabled={!canManage}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && update(p.id, "name", e.target.value.trim())}
                />
                {hasRoster && (
                  <span className="text-xs text-muted-foreground">
                    {activeCount}/{StateLogic.rosterSize(state)} roster
                  </span>
                )}
                {account ? (
                  <span className="text-xs text-muted-foreground">
                    {account.username} ({account.role})
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not linked to an account</span>
                )}
                {p.active === false && <span className="text-xs font-semibold text-primary">Inactive — needs activation</span>}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-1.5">
                  {hasRoster && p.active === false && (
                    <Button variant="secondary" size="sm" onClick={() => setActivatingId(activatingId === p.id ? null : p.id)}>
                      Activate
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => remove(p.id, p.name)}>
                    Remove
                  </Button>
                </div>
              )}
              {hasRoster && activatingId === p.id && (
                <div className="mt-2 rounded-md border border-dashed border-border bg-secondary/40 p-2.5">
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Pick up to {StateLogic.rosterSize(state)} free agents to assign directly (no fair turn order left post-draft):
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {freeAgents.map((c) => (
                      <label key={c.id} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={activateIds.includes(c.id)}
                          onChange={(e) =>
                            setActivateIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id)))
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => activate(p.id)}>
                    Assign &amp; Activate
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canManage && (
        <div className="mt-3 flex gap-1.5">
          <Input
            className="min-w-0 flex-1"
            placeholder="New player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd}>Add Player</Button>
        </div>
      )}
    </div>
  );
}
