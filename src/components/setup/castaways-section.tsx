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
import { Select } from "@/components/ui/select";
import { confirm } from "@/lib/confirm-store";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";
import { useSeasonCastMode } from "@/lib/season-cast-api";
import { SeasonCastNotice } from "./season-cast-notice";

// Port of renderSetup()'s Castaways panel. Removing a castaway is a hard delete
// (StateLogic.removeCastaway), unlike removing a tribe or player, which only un-assign -- matches
// the original exactly, including no confirm warning about drafted castaways since the live app
// doesn't have one there either.
//
// Collapsed by default: the full cast list is the longest, least-often-touched section in League
// Settings (set once at draft time), so it shouldn't push everything below it down the page on
// every visit -- same idea as EpisodeCard's own per-card `open` state.
//
// On a league with a season, this list is the SEASON's cast (docs/PLAN-universal-season-cast.md): the
// server writes it to every league on the season, and once it's shared and finished nobody here can
// change it -- the inputs lock and SeasonCastNotice says why.
export function CastawaysSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const baseMutate = useMutate();
  const { mode: cast, refresh } = useSeasonCastMode();
  const editable = canManage && cast.kind !== "shared";
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  // Any cast write can change the season cast's situation (the first one creates it), so re-read it.
  const mutate: typeof baseMutate = async (mock, live) => {
    const ok = await baseMutate(mock, live);
    if (ok) refresh();
    return ok;
  };
  // A starting tribe the season holds back (season_cast.tribes_from_episode) isn't on the castaway in
  // this league yet; the creating commissioner still sees what they set.
  const heldTribe = (seasonCastId: string | null | undefined) =>
    cast.kind === "creating" && seasonCastId ? cast.cast.find((r) => r.id === seasonCastId)?.tribeName ?? null : null;

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
    if (!(await confirm(`Delete "${name}"? This cannot be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    await mutate(
      (s) => StateLogic.removeCastaway(s, id),
      () => api.removeCastaway(leagueId!, id)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {terms.Castaways} ({state.castaways.length})
        </h3>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <SeasonCastNotice state={state} cast={cast} onChanged={refresh} />
          <div className="flex flex-col gap-2">
            {state.castaways.map((c) => {
              // Shared-ownership leagues can have several owners per castaway, so all of them are
              // named rather than just ownerIds[0]. "Free agent" is an exclusive-mode idea (shared
              // mode never takes anyone off the board), hence the unowned label differs by mode below.
              const ownerNames = c.ownerIds
                .map((id) => StateLogic.getPlayer(state, id)?.name)
                .filter((n): n is string => !!n);
              const held = !c.tribeId ? heldTribe(c.seasonCastId) : null;
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm">
                  <CastawayAvatar expandable
                    castaway={c}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[0.6rem] font-bold text-muted-foreground"
                  />
                  <Input
                    size="sm"
                    className="min-w-[120px] flex-1"
                    defaultValue={c.name}
                    disabled={!editable}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c.id, "name", e.target.value.trim())}
                  />
                  <Select size="sm" value={c.tribeId ?? ""} disabled={!editable} onChange={(e) => update(c.id, "tribeId", e.target.value || null)}>
                    <option value="">— no {terms.tribe} —</option>
                    {state.tribes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  {held && (
                    <span className="text-xs text-muted-foreground">
                      {held}, held until episode {cast.kind === "creating" ? cast.tribesFromEpisode : ""}
                    </span>
                  )}
                  <Input
                    size="sm"
                    className="min-w-[140px] flex-1"
                    placeholder="Photo URL"
                    defaultValue={c.photoUrl ?? ""}
                    disabled={!editable}
                    onBlur={(e) => e.target.value !== (c.photoUrl ?? "") && update(c.id, "photoUrl", e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {ownerNames.length > 0
                      ? ownerNames.join(", ")
                      : state.settings.ownershipMode === "shared"
                      ? "Unpicked"
                      : "Free agent"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.status === "eliminated" ? `#${c.placementOrder} — ${c.exitMethod}` : "Active"}
                  </span>
                  {editable && (
                    <Button variant="destructive" size="sm" onClick={() => remove(c.id, c.name)}>
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {editable && (
            <div className="mt-3 flex gap-1.5">
              <Input
                className="min-w-0 flex-1"
                placeholder={`New ${terms.castaway} name`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button onClick={handleAdd}>Add {terms.Castaway}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
