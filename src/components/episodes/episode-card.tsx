"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { EpisodeBetRow } from "./episode-bet-row";
import { EpisodeActiveRosterSection } from "./episode-active-roster-section";
import { EpisodeRecap } from "./episode-recap";
import { episodePlayerPoints } from "@/lib/game/active-roster-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/icons";
import { confirm } from "@/lib/confirm-store";
import { cn } from "cn";
import { useShowTerms } from "@/lib/use-show-terms";

const PODIUM_COLORS = ["#c9a227", "#9aa3ab", "#b0703c"]; // gold, silver, bronze

// Port of renderEpisodeCard() (public/app.js). `<details open>`'s per-episode expand/collapse
// state (the live app's `openEpisodes` global Set) becomes this component's own `open` state --
// same idea, one instance per card instead of a shared collection keyed by id.
export function EpisodeCard({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const format = StateLogic.formatOf(state);
  // False for an episode before the league's start episode (settings.startEpisode): watched, not scored.
  const inPlay = StateLogic.inPlay(state, ep.number);
  const [open, setOpen] = useState(false);
  const [editingEp, setEditingEp] = useState(false);
  const [elimCastawayId, setElimCastawayId] = useState("");
  const [elimMethod, setElimMethod] = useState(format.exitMethods[0]);
  const [elimJury, setElimJury] = useState("");
  // Survivor scores each jury vote a finalist gets (formats/survivor.js), so a finalist's exit asks.
  const isFinalistExit = (m: string) => format.id === "survivor" && (m === "Lost Final Tribal (Jury Vote)" || m === format.winnerExitMethod);
  const [roleCastawayId, setRoleCastawayId] = useState("");
  const [roleValue, setRoleValue] = useState(format.roles?.values[0] ?? "");
  const [moveCastawayId, setMoveCastawayId] = useState("");
  const [moveGroup, setMoveGroup] = useState("");

  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  // Entering a result is seeing it: without this a commissioner's own entry would vanish behind
  // "Results are in!" the moment it saved.
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);

  const activeCast = state.castaways.filter((c) => c.status === "active");

  async function updateField(field: "number" | "postMerge", value: number | boolean) {
    await mutate(
      (s) => StateLogic.updateEpisode(s, ep.id, field, value),
      () => api.updateEpisode(leagueId!, ep.id, field, value)
    );
  }

  async function handleDeleteEpisode() {
    if (
      !(await confirm("Delete this episode and its logged events? (Elimination placements from it will be undone.)", {
        danger: true,
        confirmLabel: "Delete",
      }))
    )
      return;
    await mutate(
      (s) => StateLogic.removeEpisode(s, ep.id),
      () => api.removeEpisode(leagueId!, ep.id)
    );
  }

  async function handleAddElimination() {
    if (!elimCastawayId) {
      alert(`Select which ${terms.castaway} was eliminated first.`);
      return;
    }
    const n = parseInt(elimJury, 10);
    const juryVotes = isFinalistExit(elimMethod) && Number.isInteger(n) && n >= 0 ? n : null;
    markResultsSeen(ep.number);
    await mutate(
      (s) => StateLogic.addElimination(s, ep.id, elimCastawayId, elimMethod, juryVotes),
      () => api.addElimination(leagueId!, ep.id, elimCastawayId, elimMethod, juryVotes)
    );
    setElimJury("");
    setElimCastawayId("");
  }

  async function handleRemoveElimination(castawayId: string) {
    const c = StateLogic.getCastaway(state, castawayId);
    if (
      c?.replenishClaimed &&
      !(await confirm("This loss was already used in a Replenish round. Undoing it will NOT take back the replenish pick already granted. Continue?"))
    )
      return;
    await mutate(
      (s) => StateLogic.removeElimination(s, ep.id, castawayId),
      () => api.removeElimination(leagueId!, ep.id, castawayId)
    );
  }

  async function handleAddRole() {
    if (!roleCastawayId || !roleValue) return;
    markResultsSeen(ep.number);
    await mutate(
      (s) => StateLogic.addRole(s, ep.id, roleCastawayId, roleValue),
      () => api.addRole(leagueId!, ep.id, roleCastawayId, roleValue)
    );
    setRoleCastawayId("");
  }

  async function handleRemoveRole(castawayId: string) {
    await mutate(
      (s) => StateLogic.removeRole(s, ep.id, castawayId),
      () => api.removeRole(leagueId!, ep.id, castawayId)
    );
  }

  async function handleAddMove() {
    if (!moveCastawayId) return;
    const group = moveGroup.trim() || null;
    markResultsSeen(ep.number);
    await mutate(
      (s) => StateLogic.addGroupChange(s, ep.id, moveCastawayId, group),
      () => api.addGroupChange(leagueId!, ep.id, moveCastawayId, group)
    );
    setMoveCastawayId("");
  }

  async function handleRemoveMove(castawayId: string) {
    await mutate(
      (s) => StateLogic.removeGroupChange(s, ep.id, castawayId),
      () => api.removeGroupChange(leagueId!, ep.id, castawayId)
    );
  }

  // Active Roster: the episode's top three players, visible on the collapsed card. Players' points,
  // not who left, so it doesn't give away the episode's result the way an exit would.
  const podium = StateLogic.getLeagueType(state).hasActiveRoster
    ? episodePlayerPoints(state, ep.id)
        .filter((r) => r.points > 0)
        .slice(0, 3)
    : [];

  return (
    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
      <button className="flex w-full items-start justify-between gap-2 p-4 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          {/* The episode's name, not who left: the header shouldn't spoil the result before it's
              opened. Episodes without a title (added by hand) just show their number. */}
          <div className="text-sm font-semibold">
            Episode {ep.number}
            {ep.title ? <> — {ep.title}</> : null}
          </div>
          {ep.airDate && <div className="mt-0.5 text-xs text-muted-foreground">Aired {ep.airDate}</div>}
          {podium.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {podium.map(({ player, points }, i) => (
                <span key={player.id} className="flex items-center gap-1">
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full font-mono text-[0.6rem] font-bold text-white"
                    style={{ background: PODIUM_COLORS[i] }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-semibold">{player.name}</span>
                  <span className="font-mono text-muted-foreground">{points}</span>
                </span>
              ))}
            </div>
          )}
          {((format.hasMerge && ep.postMerge) || (ep.bets || []).length > 0 || !inPlay) && (
            <div className="mt-1 flex gap-1.5">
              {!inPlay && (
                <span
                  className="rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-bold text-muted-foreground"
                  title="Before this league's start episode — watched, not scored"
                >
                  Before league start
                </span>
              )}
              {format.hasMerge && ep.postMerge && (
                <span className="rounded bg-[#5089c4] px-1.5 py-0.5 text-[0.65rem] font-bold text-white">Post-Merge</span>
              )}
              {(ep.bets || []).length > 0 && (
                <span
                  className="rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-bold"
                  title={`${ep.bets.length} prediction${ep.bets.length === 1 ? "" : "s"} logged`}
                >
                  Predictions
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDownIcon className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Spoiler protection: this episode's results are in but this viewer hasn't revealed them. */}
      {open && ep.resultsHidden && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4 text-sm">
          <span className="flex-1 text-muted-foreground">Results are in — hidden until you reveal them.</span>
          <Button size="sm" onClick={() => markResultsSeen(ep.number)}>
            Reveal results
          </Button>
        </div>
      )}
      {open && !ep.resultsHidden && (
        <div className="border-t border-border p-4">
          {/* The commissioner's controls row, and the divider that separates it from the results --
              neither exists for a member, who'd otherwise get an empty row and a stray line. */}
          {canManage && (
          <div className="mb-2 flex flex-wrap items-center gap-3">
            {/* No Post-merge checkbox: the episode import sets postMerge from the season's own data, and
                the header badge shows it to everyone. */}
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
          )}
          {editingEp && canManage && (
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                Episode #:
                <Input
                  type="number"
                  className="w-16 text-sm"
                  defaultValue={ep.number}
                  onBlur={(e) => updateField("number", parseInt(e.target.value) || 1)}
                />
              </label>
              <Button variant="destructive" size="sm" onClick={handleDeleteEpisode}>
                Delete Episode
              </Button>
            </div>
          )}

          <div className={cn("mb-4", canManage && "border-t border-border pt-3")}>
            <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Recap</h4>
            <EpisodeRecap ep={ep} state={state} onUndoExit={editingEp && canManage ? handleRemoveElimination : undefined} />
            {/* Secret roles taken on this episode (The Traitors). Only here once the league has this
                episode's results, so a league catching up doesn't see them early. */}
            {(ep.roles || []).length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {(ep.roles || []).map((r) => (
                  <div key={r.castawayId} className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-[#b0563f] px-1.5 py-0.5 text-xs font-bold text-white">{r.role}</span>
                    <span>{StateLogic.getCastaway(state, r.castawayId)?.name ?? "?"}</span>
                    {editingEp && canManage && (
                      <Button variant="destructive" size="sm" className="ml-auto" onClick={() => handleRemoveRole(r.castawayId)}>
                        Undo
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Tribe/team changes this episode (swaps, the merge, new teams or partners). Like roles,
                only here once the league has this episode's results. */}
            {(ep.groups || []).length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {(ep.groups || []).map((g) => {
                  const tribe = g.tribeId ? StateLogic.Core.getTribe(state, g.tribeId) : null;
                  return (
                    <div key={g.castawayId} className="flex items-center gap-2 text-sm">
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-bold text-white"
                        style={{ background: tribe?.color ?? "#4a5245" }}
                      >
                        → {tribe?.name ?? "on their own"}
                      </span>
                      <span>{StateLogic.getCastaway(state, g.castawayId)?.name ?? "?"}</span>
                      {editingEp && canManage && (
                        <Button variant="destructive" size="sm" className="ml-auto" onClick={() => handleRemoveMove(g.castawayId)}>
                          Undo
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {canManage && (
              <div className="mt-3 border-t border-border pt-3">
                <h4 className="mb-1 text-xs font-bold">Add Eliminated Player</h4>
                <p className="mb-2 text-xs text-muted-foreground">In order of elimination, if multiple.</p>
                <div className="flex flex-wrap gap-1.5">
                  <Select value={elimCastawayId} onChange={(e) => setElimCastawayId(e.target.value)}>
                    <option value="">— Select {terms.castaway} —</option>
                    {activeCast.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={elimMethod} onChange={(e) => setElimMethod(e.target.value)}>
                    {format.exitMethods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                  {isFinalistExit(elimMethod) && (
                    <Input
                      type="number"
                      min={0}
                      className="w-28"
                      placeholder="Jury votes"
                      value={elimJury}
                      onChange={(e) => setElimJury(e.target.value)}
                    />
                  )}
                  <Button onClick={handleAddElimination}>+ Add Eliminated Player</Button>
                </div>
              </div>
            )}
            {/* Secret roles by hand (The Traitors) -- for when the season's admin decisions don't cover
                this league. Anyone still in the game can take one; one per person per episode. */}
            {canManage && format.roles && (
              <div className="mt-3 border-t border-border pt-3">
                <h4 className="mb-1 text-xs font-bold">Record a Role</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Who became a Traitor this episode. Everyone else is {format.roles.default}.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Select value={roleCastawayId} onChange={(e) => setRoleCastawayId(e.target.value)}>
                    <option value="">— Select {terms.castaway} —</option>
                    {activeCast
                      .filter((c) => !(ep.roles || []).some((r) => r.castawayId === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                  <Select value={roleValue} onChange={(e) => setRoleValue(e.target.value)}>
                    {format.roles.values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Select>
                  <Button disabled={!roleCastawayId} onClick={handleAddRole}>
                    + Record Role
                  </Button>
                </div>
              </div>
            )}
            {canManage && format.hasGroups && (
              <div className="mt-3 border-t border-border pt-3">
                <h4 className="mb-1 text-xs font-bold">Record a {terms.tribe} Change</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  A swap, the merge, a new team or partner. Pick an existing {terms.tribe.toLowerCase()} or type a new name;
                  leave it blank if they now play on their own.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Select value={moveCastawayId} onChange={(e) => setMoveCastawayId(e.target.value)}>
                    <option value="">— Select {terms.castaway} —</option>
                    {activeCast
                      .filter((c) => !(ep.groups || []).some((g) => g.castawayId === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                  <Input
                    className="w-40 text-sm"
                    list={`groups-${ep.id}`}
                    placeholder={`${terms.tribe} name`}
                    value={moveGroup}
                    onChange={(e) => setMoveGroup(e.target.value)}
                  />
                  <datalist id={`groups-${ep.id}`}>
                    {state.tribes.map((t) => (
                      <option key={t.id} value={t.name} />
                    ))}
                  </datalist>
                  <Button disabled={!moveCastawayId} onClick={handleAddMove}>
                    + Record Change
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Before the league's start episode there's nothing to field -- it's history. Eliminator
              Pool picks are made on Overview only (see pickem-pick-grid.tsx), never here. */}
          {inPlay && StateLogic.getLeagueType(state).hasActiveRoster && <EpisodeActiveRosterSection ep={ep} state={state} />}

          {/* Side bets are proposed and guessed on Overview (bet-card.tsx) -- here it's how they went,
              plus the commissioner's grading and editing behind each bet's ✏️. */}
          {state.settings.bonusEnabled && (ep.bets || []).length > 0 && (
            <div className="border-t border-border pt-3">
              <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Predictions</h4>
              <div className="divide-y divide-border rounded-md border border-border">
                {(ep.bets || []).map((bet) => (
                  <EpisodeBetRow key={bet.id} ep={ep} bet={bet} state={state} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
