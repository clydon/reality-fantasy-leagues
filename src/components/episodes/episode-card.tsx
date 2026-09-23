"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { EpisodeBetRow } from "./episode-bet-row";
import { cn } from "cn";

// Port of renderEpisodeCard() (public/app.js). `<details open>`'s per-episode expand/collapse
// state (the live app's `openEpisodes` global Set) becomes this component's own `open` state --
// same idea, one instance per card instead of a shared collection keyed by id.
export function EpisodeCard({ ep, state, defaultOpen }: { ep: Episode; state: LeagueState; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingEp, setEditingEp] = useState(false);
  const [elimCastawayId, setElimCastawayId] = useState("");
  const [elimMethod, setElimMethod] = useState(StateLogic.EXIT_METHODS[0]);
  const [newBetLabel, setNewBetLabel] = useState("");
  const [newBetPoints, setNewBetPoints] = useState(state.settings.defaultBetPoints);

  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  const activeCast = state.castaways.filter((c) => c.status === "active");
  const summary = ep.events.length
    ? ep.events.map((ev) => StateLogic.getCastaway(state, ev.castawayId)?.name || "?").join(", ")
    : "no eliminations logged";

  async function updateField(field: "number" | "postMerge", value: number | boolean) {
    await mutate(
      (s) => StateLogic.updateEpisode(s, ep.id, field, value),
      () => api.updateEpisode(leagueId!, ep.id, field, value)
    );
  }

  async function handleDeleteEpisode() {
    if (!confirm("Delete this episode and its logged events? (Elimination placements from it will be undone.)")) return;
    await mutate(
      (s) => StateLogic.removeEpisode(s, ep.id),
      () => api.removeEpisode(leagueId!, ep.id)
    );
  }

  async function handleAddElimination() {
    if (!elimCastawayId) {
      alert("Select which castaway was eliminated first.");
      return;
    }
    await mutate(
      (s) => StateLogic.addElimination(s, ep.id, elimCastawayId, elimMethod),
      () => api.addElimination(leagueId!, ep.id, elimCastawayId, elimMethod)
    );
    setElimCastawayId("");
  }

  async function handleRemoveElimination(castawayId: string) {
    const c = StateLogic.getCastaway(state, castawayId);
    if (
      c?.replenishClaimed &&
      !confirm("This loss was already used in a Replenish round. Undoing it will NOT take back the replenish pick already granted. Continue?")
    )
      return;
    await mutate(
      (s) => StateLogic.removeElimination(s, ep.id, castawayId),
      () => api.removeElimination(leagueId!, ep.id, castawayId)
    );
  }

  async function handleAddBet() {
    const trimmed = newBetLabel.trim();
    if (!trimmed) return;
    setNewBetLabel("");
    await mutate(
      (s) => StateLogic.addBet(s, ep.id, trimmed, newBetPoints, null),
      () => api.proposeBet(leagueId!, ep.id, trimmed, newBetPoints)
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <button className="flex w-full items-start justify-between gap-2 p-4 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="text-sm font-semibold">
            Episode {ep.number} — {summary}
          </div>
          {(ep.postMerge || (ep.bets || []).length > 0) && (
            <div className="mt-1 flex gap-1.5">
              {ep.postMerge && (
                <span className="rounded bg-[#5089c4] px-1.5 py-0.5 text-[0.65rem] font-bold text-white">Post-Merge</span>
              )}
              {(ep.bets || []).length > 0 && (
                <span
                  className="rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-bold"
                  title={`${ep.bets.length} side bet${ep.bets.length === 1 ? "" : "s"} logged`}
                >
                  Bets
                </span>
              )}
            </div>
          )}
        </div>
        <span className={cn("mt-1 text-xs text-muted-foreground transition-transform", open && "rotate-180")}>▾</span>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              Episode #:
              <input
                type="number"
                className="w-16 rounded border border-border bg-card px-1.5 py-0.5 text-sm"
                defaultValue={ep.number}
                disabled={!canManage}
                onBlur={(e) => updateField("number", parseInt(e.target.value) || 1)}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                defaultChecked={ep.postMerge}
                disabled={!canManage}
                onChange={(e) => updateField("postMerge", e.target.checked)}
              />
              Post-merge
            </label>
            {canManage && (
              <button
                className={cn("rounded border border-border px-2 py-0.5 text-xs", editingEp && "bg-secondary")}
                title="Edit / remove"
                onClick={() => setEditingEp((e) => !e)}
              >
                ✏️
              </button>
            )}
          </div>
          {editingEp && canManage && (
            <div className="mb-2">
              <button className="rounded border border-destructive/40 px-2 py-1 text-xs text-destructive" onClick={handleDeleteEpisode}>
                Delete Episode
              </button>
            </div>
          )}

          <div className="mb-4 border-t border-border pt-3">
            <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Eliminations</h4>
            {ep.events.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">None logged yet.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ep.events.map((ev) => {
                  const c = StateLogic.getCastaway(state, ev.castawayId);
                  const owner = c?.ownerId ? StateLogic.getPlayer(state, c.ownerId) : null;
                  return (
                    <div key={ev.castawayId} className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-white">
                        #{c?.placementOrder ?? "?"}
                      </span>
                      <span>{c?.name ?? "?"}</span>
                      {owner && (
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                          style={{ background: owner.color }}
                          title={owner.name}
                        >
                          {owner.name[0]}
                        </span>
                      )}
                      <span className="text-muted-foreground">{ev.method}</span>
                      {editingEp && canManage && (
                        <button
                          className="ml-auto rounded border border-destructive/40 px-1.5 py-0.5 text-xs text-destructive"
                          onClick={() => handleRemoveElimination(ev.castawayId)}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {canManage && (
              <div className="mt-3 border-t border-border pt-3">
                <h4 className="mb-1 text-xs font-bold">Add Eliminated Player</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  If more than one person left this episode, add them one at a time in the order it happened. This will be
                  boot <b>#{StateLogic.nextPlacementOrder(state)}</b>.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <select
                    className="rounded border border-border bg-card px-1.5 py-1 text-sm"
                    value={elimCastawayId}
                    onChange={(e) => setElimCastawayId(e.target.value)}
                  >
                    <option value="">— Select castaway —</option>
                    {activeCast.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-border bg-card px-1.5 py-1 text-sm"
                    value={elimMethod}
                    onChange={(e) => setElimMethod(e.target.value)}
                  >
                    {StateLogic.EXIT_METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <button className="rounded bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground" onClick={handleAddElimination}>
                    + Add Eliminated Player
                  </button>
                </div>
              </div>
            )}
          </div>

          {state.settings.bonusEnabled && (
            <div className="border-t border-border pt-3">
              <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Side Bets</h4>
              {(ep.bets || []).length === 0 ? (
                <div className="mb-2 text-sm italic text-muted-foreground">No bets logged for this episode.</div>
              ) : (
                (ep.bets || []).map((bet) => <EpisodeBetRow key={bet.id} ep={ep} bet={bet} state={state} />)
              )}
              <div className="flex flex-wrap gap-1.5">
                <input
                  className="min-w-[180px] flex-1 rounded border border-border bg-card px-2 py-1 text-sm"
                  placeholder="New bet, e.g. 'Who wins reward?'"
                  value={newBetLabel}
                  onChange={(e) => setNewBetLabel(e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  pts if correct:
                  <input
                    type="number"
                    className="w-14 rounded border border-border bg-card px-1.5 py-1 text-xs"
                    value={newBetPoints}
                    onChange={(e) => setNewBetPoints(parseInt(e.target.value) || 0)}
                  />
                </label>
                <button className="rounded bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground" onClick={handleAddBet}>
                  Add Bet
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
