"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { PhotoSquare, PlainButton } from "@/components/draft/draft-ui";
import { useSeasonCastMode } from "@/lib/season-cast-api";
import { SeasonCastNotice } from "./season-cast-notice";
import { TribesSection } from "./tribes-section";
import { CastImportSection } from "./cast-import-section";
import { WikiConnectorSection } from "./wiki-connector-section";
import { GroupHead, MoreButton, RowList, SettingsPage, TextSheet } from "./settings-ui";

// League Settings > Tribes & castaways (docs/PLAN-ux-redesign.md, 2b): tribes as colour + name rows,
// then the cast as a photo list with each one's tribe and where they stand, then importing a cast.
// Editing a castaway (name, tribe, photo, remove) is in its ⋯ sheet, not a row of always-on inputs.
//
// On a league with a season, the cast is the SEASON's (docs/PLAN-universal-season-cast.md): the server
// writes it to every league on the season, and once it's shared and finished nobody here can change it
// -- the ⋯ buttons go and SeasonCastNotice says why. Removing a castaway is a hard delete
// (StateLogic.removeCastaway), unlike removing a tribe or player, which only un-assign.
export function CastPage() {
  const state = useLeagueStore((s) => s.state);
  const terms = useShowTerms();
  const { mode: cast, refresh } = useSeasonCastMode();
  return (
    <SettingsPage title={`${terms.Tribes} & ${terms.castaways}`}>
      <SeasonCastNotice state={state} cast={cast} onChanged={refresh} />
      <TribesSection state={state} />
      <CastawaysSection state={state} />
      <CastImportSection state={state} />
      <WikiConnectorSection state={state} />
    </SettingsPage>
  );
}

function CastawaysSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const baseMutate = useMutate();
  const { mode: cast, refresh } = useSeasonCastMode();
  const editable = canManage && cast.kind !== "shared";
  const [sheet, setSheet] = useState<{ kind: "menu" | "rename" | "tribe" | "photo"; id: string } | { kind: "add" } | null>(null);
  const close = () => setSheet(null);
  const target = sheet && "id" in sheet ? state.castaways.find((c) => c.id === sheet.id) : undefined;

  // Any cast write can change the season cast's situation (the first one creates it), so re-read it.
  const mutate: typeof baseMutate = async (mock, live) => {
    const ok = await baseMutate(mock, live);
    if (ok) refresh();
    return ok;
  };
  // A starting tribe the season holds back (season_cast.tribes_from_episode) isn't on the castaway in
  // this league yet; the creating commissioner still sees what they set.
  const heldTribe = (c: Castaway) =>
    !c.tribeId && cast.kind === "creating" && c.seasonCastId ? (cast.cast.find((r) => r.id === c.seasonCastId)?.tribeName ?? null) : null;

  async function add(name: string) {
    close();
    await mutate(
      (s) => StateLogic.addCastaway(s, name),
      () => api.addCastaway(leagueId!, name)
    );
  }

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateCastaway(s, id, field, value),
      () => api.updateCastaway(leagueId!, id, field, value)
    );
  }

  async function remove(c: Castaway) {
    close();
    if (!(await confirm(`Delete "${c.name}"? This cannot be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    await mutate(
      (s) => StateLogic.removeCastaway(s, c.id),
      () => api.removeCastaway(leagueId!, c.id)
    );
  }

  // Shared-ownership leagues can have several owners per castaway, so all of them are named. "Free
  // agent" is an exclusive-mode idea (shared mode never takes anyone off the board).
  function standing(c: Castaway) {
    const owners = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)?.name).filter((n): n is string => !!n);
    const who = owners.length ? owners.join(", ") : state.settings.ownershipMode === "shared" ? "Unpicked" : "Free agent";
    return c.status === "eliminated" ? `Out #${c.placementOrder} · ${c.exitMethod} · ${who}` : who;
  }
  const tribeOf = (c: Castaway) => state.tribes.find((t) => t.id === c.tribeId);

  return (
    <section className="flex flex-col gap-2">
      <GroupHead aside={<span className="text-[13px] text-muted-foreground">{state.castaways.length}</span>}>
        {terms.Castaways}
      </GroupHead>
      {state.castaways.length === 0 ? (
        <p className="text-base text-muted-foreground">No {terms.castaways} yet.</p>
      ) : (
        <RowList>
          {state.castaways.map((c) => {
            const tribe = tribeOf(c);
            const held = heldTribe(c);
            return (
              <div key={c.id} className="flex min-h-[60px] items-center gap-3 py-2">
                <PhotoSquare castaway={c} size={44} faded={c.status === "eliminated"} expandable />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold">{c.name}</span>
                    {tribe && (
                      <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground">
                        <span className="size-2.5 rounded-[2px]" style={{ background: tribe.color }} aria-hidden />
                        {tribe.name}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {held ? `${held}, held until episode ${cast.kind === "creating" ? cast.tribesFromEpisode : ""} · ` : ""}
                    {standing(c)}
                  </span>
                </span>
                {editable ? (
                  <MoreButton label={`Options for ${c.name}`} onClick={() => setSheet({ kind: "menu", id: c.id })} />
                ) : (
                  <span className="w-2" />
                )}
              </div>
            );
          })}
        </RowList>
      )}
      {editable && (
        <PlainButton className="mt-2" onClick={() => setSheet({ kind: "add" })}>
          <Plus className="size-[18px]" aria-hidden />
          Add {terms.castaway}
        </PlainButton>
      )}

      {sheet?.kind === "menu" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title={target.name} description={tribeOf(target)?.name}>
          <SheetAction onClick={() => setSheet({ kind: "rename", id: target.id })}>Rename</SheetAction>
          <SheetAction detail={tribeOf(target)?.name ?? "None"} onClick={() => setSheet({ kind: "tribe", id: target.id })}>
            {terms.Tribe}
          </SheetAction>
          <SheetAction detail={target.photoUrl ? "Set" : "None"} onClick={() => setSheet({ kind: "photo", id: target.id })}>
            Photo
          </SheetAction>
          <SheetAction danger onClick={() => remove(target)}>
            Delete {terms.castaway}
          </SheetAction>
        </BottomSheet>
      )}
      {sheet?.kind === "rename" && target && (
        <TextSheet
          title={`Rename ${target.name}`}
          label="Name"
          initial={target.name}
          submit="Save"
          onClose={close}
          onSubmit={(v) => {
            close();
            if (v !== target.name) update(target.id, "name", v);
          }}
        />
      )}
      {sheet?.kind === "tribe" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title={terms.Tribe} description={target.name}>
          {[...state.tribes, null].map((t) => (
            <SheetAction
              key={t?.id ?? "none"}
              detail={(target.tribeId ?? null) === (t?.id ?? null) ? "✓" : undefined}
              onClick={() => {
                close();
                if ((target.tribeId ?? null) !== (t?.id ?? null)) update(target.id, "tribeId", t?.id ?? null);
              }}
            >
              <span className="flex items-center gap-2.5">
                {t && <span className="size-3 rounded-[3px]" style={{ background: t.color }} aria-hidden />}
                {t ? t.name : `No ${terms.tribe}`}
              </span>
            </SheetAction>
          ))}
        </BottomSheet>
      )}
      {sheet?.kind === "photo" && target && (
        <PhotoSheet
          castaway={target}
          onClose={close}
          onSubmit={(url) => {
            close();
            if (url !== (target.photoUrl ?? "")) update(target.id, "photoUrl", url);
          }}
        />
      )}
      {sheet?.kind === "add" && <TextSheet title={`Add a ${terms.castaway}`} label="Name" submit="Add" onClose={close} onSubmit={add} />}
    </section>
  );
}

// A photo is a URL; saving it blank clears it.
function PhotoSheet({ castaway, onClose, onSubmit }: { castaway: Castaway; onClose: () => void; onSubmit: (url: string) => void }) {
  return (
    <TextSheet
      title="Photo"
      description={castaway.name}
      label="Photo URL"
      help="A link to an image. Research and cast imports usually fill this in."
      initial={castaway.photoUrl ?? ""}
      allowEmpty
      submit="Save"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
