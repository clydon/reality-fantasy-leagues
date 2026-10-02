"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShowTerms } from "@/lib/use-show-terms";
import { confirm } from "@/lib/confirm-store";
import { ColorInput } from "@/components/ui/color-input";

// Port of renderSetup()'s Players panel: color/name edit, remove, and activating a player who
// joined after the draft concluded (RosterLogic.addPlayer marks them inactive in that case --
// there's no fair turn order left to slot them into, so the commissioner assigns free agents
// directly instead of a live pick).
//
// A seat with no account behind it can be a computer player (player.automated, src/lib/game/bot-logic.js),
// which makes its own moves, and any such seat can be handed over to a real account by invite: whoever
// accepts takes over the team (see join-league.ts).
const LEVEL_HELP = {
  casual: "Casual: plays its favourites and rarely swaps.",
  solid: "Solid: follows the form and avoids anyone in danger.",
  sharp: "Sharp: reads every warning sign and swaps whenever it pays.",
};

export function PlayersSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const playerAccounts = useLeagueStore((s) => s.playerAccounts);
  const mode = useLeagueStore((s) => s.mode);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [newName, setNewName] = useState("");
  const [newAutomated, setNewAutomated] = useState(false);
  const [handingOverId, setHandingOverId] = useState<string | null>(null);
  const [handOverTo, setHandOverTo] = useState("");
  const [handOverNote, setHandOverNote] = useState<{ playerId: string; text: string; error?: boolean } | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateIds, setActivateIds] = useState<string[]>([]);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const automated = newAutomated;
    setNewName("");
    setNewAutomated(false);
    await mutate(
      (s) => StateLogic.addPlayer(s, trimmed, { automated }),
      () => api.addPlayer(leagueId!, trimmed, automated)
    );
  }

  async function handOver(playerId: string) {
    const to = handOverTo.trim();
    if (!to) return;
    try {
      await api.sendInvite(leagueId!, to, playerId);
      setHandOverNote({ playerId, text: `Invite sent to ${to}. They take over this team when they accept.` });
      setHandingOverId(null);
      setHandOverTo("");
    } catch (err) {
      setHandOverNote({ playerId, text: err instanceof ApiError ? err.message : "Could not send the invite.", error: true });
    }
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
                <ColorInput value={p.color} disabled={!canManage} onChange={(hex) => update(p.id, "color", hex)} />
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
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!p.automated}
                      disabled={!canManage || !!p.disabled}
                      onChange={(e) => update(p.id, "automated", e.target.checked)}
                    />
                    Computer player
                  </label>
                )}
                {!account && p.automated && (
                  <select
                    aria-label="How well it plays"
                    className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs"
                    value={p.botLevel ?? "solid"}
                    disabled={!canManage}
                    onChange={(e) => update(p.id, "botLevel", e.target.value)}
                  >
                    <option value="casual">Casual</option>
                    <option value="solid">Solid</option>
                    <option value="sharp">Sharp</option>
                  </select>
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
                  {!account && !p.disabled && mode === "live" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setHandingOverId(handingOverId === p.id ? null : p.id);
                        setHandOverTo("");
                        setHandOverNote(null);
                      }}
                    >
                      Hand over…
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => remove(p.id, p.name)}>
                    Remove
                  </Button>
                </div>
              )}
              {!account && p.automated && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Plays itself: drafts, sets its lineup and makes its picks using how everyone&apos;s doing so far.{" "}
                  {LEVEL_HELP[p.botLevel ?? "solid"]}
                </p>
              )}
              {handingOverId === p.id && (
                <div className="mt-2 rounded-md border border-dashed border-border bg-secondary/40 p-2.5">
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Invite someone to take over this team. When they accept, it&apos;s theirs, points and all, under their own name
                    {p.automated ? ", and the computer stops playing it" : ""}.
                  </p>
                  <div className="flex gap-1.5">
                    <Input
                      size="sm"
                      className="min-w-0 flex-1"
                      placeholder="Username or email"
                      value={handOverTo}
                      onChange={(e) => setHandOverTo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handOver(p.id)}
                    />
                    <Button size="sm" onClick={() => handOver(p.id)} disabled={!handOverTo.trim()}>
                      Send Invite
                    </Button>
                  </div>
                </div>
              )}
              {handOverNote?.playerId === p.id && (
                <p className={handOverNote.error ? "mt-1.5 text-xs text-destructive" : "mt-1.5 text-xs text-muted-foreground"}>
                  {handOverNote.text}
                </p>
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Input
            className="min-w-0 flex-1 basis-40"
            placeholder="New player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <label className="flex items-center gap-1 text-sm" title="Drafts, sets lineups and makes picks by itself">
            <input type="checkbox" checked={newAutomated} onChange={(e) => setNewAutomated(e.target.checked)} />
            Computer player
          </label>
          <Button onClick={handleAdd}>Add Player</Button>
        </div>
      )}
    </div>
  );
}
