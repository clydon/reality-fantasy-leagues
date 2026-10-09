"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { confirm } from "@/lib/confirm-store";
import { useShowTerms } from "@/lib/use-show-terms";
import { EpisodeChanges, EpisodeRecap } from "./episode-recap";
import { EpisodeResearchPanel } from "./episode-research-panel";

// A commissioner's editing of one episode's results (docs/PLAN-ux-redesign.md, 2e): what's recorded,
// each with its own Undo, then a form per kind of result, then research to fill gaps. Behind "Edit
// results" on the episode's page, never the default view -- most leagues get results automatically.
export function EpisodeEditor({ ep, state, onDone }: { ep: Episode; state: LeagueState; onDone: () => void }) {
  const terms = useShowTerms();
  const router = useRouter();
  const format = StateLogic.formatOf(state);
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
  const mutate = useMutate();
  // Entering a result is seeing it: without this a commissioner's own entry would vanish behind
  // "Results are in!" the moment it saved.
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);

  const activeCast = state.castaways.filter((c) => c.status === "active");

  async function renumber(n: number) {
    if (!Number.isInteger(n) || n < 1 || n === ep.number) return;
    await mutate(
      (s) => StateLogic.updateEpisode(s, ep.id, "number", n),
      () => api.updateEpisode(leagueId!, ep.id, "number", n)
    );
    // The page is addressed by number, so follow the episode to its new one.
    router.replace(`/episodes/${n}`);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-caption text-[24px]">Editing results</h3>
        <Button onClick={onDone} className="max-nav:min-h-11">
          Done
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h4 className="section-title">Recorded</h4>
        <EpisodeRecap ep={ep} state={state} onUndoExit={handleRemoveElimination} />
        <EpisodeChanges ep={ep} state={state} onUndoRole={handleRemoveRole} onUndoMove={handleRemoveMove} />
      </section>

      <Form title={`Someone left`} hint="In the order they left, if more than one.">
        <Select aria-label={terms.castaway} value={elimCastawayId} onChange={(e) => setElimCastawayId(e.target.value)}>
          <option value="">Choose a {terms.castaway.toLowerCase()}</option>
          {activeCast.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="How they left" value={elimMethod} onChange={(e) => setElimMethod(e.target.value)}>
          {format.exitMethods.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        {isFinalistExit(elimMethod) && (
          <Input type="number" min={0} placeholder="Jury votes received" value={elimJury} onChange={(e) => setElimJury(e.target.value)} />
        )}
        <Button className="self-start max-nav:min-h-11" onClick={handleAddElimination}>
          Add
        </Button>
      </Form>

      {/* Secret roles by hand (The Traitors) -- for when the season's admin decisions don't cover
          this league. Anyone still in the game can take one; one per person per episode. */}
      {format.roles && (
        <Form title="Someone took a role" hint={`Who became a Traitor this episode. Everyone else is ${format.roles.default}.`}>
          <Select aria-label={terms.castaway} value={roleCastawayId} onChange={(e) => setRoleCastawayId(e.target.value)}>
            <option value="">Choose a {terms.castaway.toLowerCase()}</option>
            {activeCast
              .filter((c) => !(ep.roles || []).some((r) => r.castawayId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Select aria-label="Role" value={roleValue} onChange={(e) => setRoleValue(e.target.value)}>
            {format.roles.values.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Button className="self-start max-nav:min-h-11" disabled={!roleCastawayId} onClick={handleAddRole}>
            Add
          </Button>
        </Form>
      )}

      {format.hasGroups && (
        <Form
          title={`Someone changed ${terms.tribe.toLowerCase()}`}
          hint={`A swap, the merge, a new team or partner. Pick a ${terms.tribe.toLowerCase()} or type a new name; leave it blank if they now play on their own.`}
        >
          <Select aria-label={terms.castaway} value={moveCastawayId} onChange={(e) => setMoveCastawayId(e.target.value)}>
            <option value="">Choose a {terms.castaway.toLowerCase()}</option>
            {activeCast
              .filter((c) => !(ep.groups || []).some((g) => g.castawayId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Input
            aria-label={`${terms.tribe} name`}
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
          <Button className="self-start max-nav:min-h-11" disabled={!moveCastawayId} onClick={handleAddMove}>
            Add
          </Button>
        </Form>
      )}

      {/* Paste-and-apply episode research, for a league no admin is researching (and a quick way to
          pull in what another league on the season already found). */}
      <EpisodeResearchPanel ep={ep} state={state} />

      <Form title="Episode number" hint="Only if this episode was numbered wrong.">
        <div>
          <Input
            type="number"
            min={1}
            aria-label="Episode number"
            className="w-24"
            defaultValue={ep.number}
            onBlur={(e) => renumber(parseInt(e.target.value, 10))}
          />
        </div>
      </Form>
    </div>
  );
}

function Form({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h4 className="text-base font-bold">{title}</h4>
      {hint && <p className="-mt-1 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-2 [&>input]:w-full [&>select]:w-full sm:[&>input]:max-w-sm sm:[&>select]:max-w-sm">{children}</div>
    </section>
  );
}
