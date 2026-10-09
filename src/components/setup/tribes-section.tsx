"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { LeagueState, Tribe } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { ColorInput } from "@/components/ui/color-input";
import { PlainButton } from "@/components/draft/draft-ui";
import { GroupHead, MoreButton, PrimaryButton, RowList, TextSheet, fieldCls } from "./settings-ui";

// The tribes half of League Settings > Tribes & castaways: one line per tribe (its colour and name),
// with rename, colour and Remove in its ⋯ sheet. Removing a tribe un-assigns (not removes) any
// castaways in it -- RosterLogic.removeTribe sets their tribeId back to null.
export function TribesSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const mutate = useMutate();
  const [sheet, setSheet] = useState<{ kind: "menu" | "rename" | "colour"; id: string } | { kind: "add" } | null>(null);
  const close = () => setSheet(null);
  const target = sheet && "id" in sheet ? state.tribes.find((t) => t.id === sheet.id) : undefined;

  async function add(name: string, color: string) {
    close();
    await mutate(
      (s) => StateLogic.addTribe(s, name, color),
      () => api.addTribe(leagueId!, name, color)
    );
  }

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateTribe(s, id, field, value),
      () => api.updateTribe(leagueId!, id, field, value)
    );
  }

  async function remove(t: Tribe) {
    close();
    if (
      !(await confirm(`Remove ${terms.tribe} "${t.name}"? Its ${terms.castaways} become ${terms.tribe}-less, not removed.`, {
        danger: true,
        confirmLabel: "Remove",
      }))
    )
      return;
    await mutate(
      (s) => StateLogic.removeTribe(s, t.id),
      () => api.removeTribe(leagueId!, t.id)
    );
  }

  const members = (id: string) => state.castaways.filter((c) => c.tribeId === id).length;

  return (
    <section className="flex flex-col gap-2">
      <GroupHead>{terms.Tribes}</GroupHead>
      {state.tribes.length === 0 ? (
        <p className="text-base text-muted-foreground">No {terms.tribes} yet.</p>
      ) : (
        <RowList>
          {state.tribes.map((t) => (
            <div key={t.id} className="flex min-h-[56px] items-center gap-3">
              <span className="size-3.5 shrink-0 rounded-[3px]" style={{ background: t.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{t.name}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground">{members(t.id)}</span>
              {canManage ? (
                <MoreButton label={`Options for ${t.name}`} onClick={() => setSheet({ kind: "menu", id: t.id })} />
              ) : (
                <span className="w-2" />
              )}
            </div>
          ))}
        </RowList>
      )}
      {canManage && (
        <PlainButton className="mt-2" onClick={() => setSheet({ kind: "add" })}>
          <Plus className="size-[18px]" aria-hidden />
          Add {terms.tribe}
        </PlainButton>
      )}

      {sheet?.kind === "menu" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title={target.name} description={`${members(target.id)} ${terms.castaways}`}>
          <SheetAction onClick={() => setSheet({ kind: "rename", id: target.id })}>Rename</SheetAction>
          <SheetAction onClick={() => setSheet({ kind: "colour", id: target.id })}>Colour</SheetAction>
          <SheetAction danger onClick={() => remove(target)}>
            Remove {terms.tribe}
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
          onSubmit={(name) => {
            close();
            if (name !== target.name) update(target.id, "name", name);
          }}
        />
      )}
      {sheet?.kind === "colour" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title="Colour" description={target.name}>
          <div className="flex items-center gap-3 border-t border-border py-4">
            <ColorInput value={target.color} onChange={(hex) => update(target.id, "color", hex)} swatchClassName="h-11 w-11" />
            <span className="text-[13px] text-muted-foreground">Tap the swatch, or type a hex code.</span>
          </div>
        </BottomSheet>
      )}
      {sheet?.kind === "add" && (
        <TribeSheet title={`Add a ${terms.tribe}`} initialName="" initialColor="#45a89a" submit="Add" onClose={close} onSubmit={add} />
      )}
    </section>
  );
}

function TribeSheet({
  title,
  initialName,
  initialColor,
  submit,
  onSubmit,
  onClose,
}: {
  title: string;
  initialName: string;
  initialColor: string;
  submit: string;
  onSubmit: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const trimmed = name.trim();
  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title={title}>
      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onSubmit(trimmed, color);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Name</span>
          <input className={fieldCls} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Colour</span>
          <ColorInput value={color} onChange={setColor} swatchClassName="h-11 w-11" />
        </div>
        <PrimaryButton type="submit" disabled={!trimmed}>
          {submit}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
