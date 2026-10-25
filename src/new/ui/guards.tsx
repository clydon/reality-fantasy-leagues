"use client";

import { useState } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import type { PreviewLine } from "../data";
import { Face } from "../show/parts";
import { Avatar } from "./bars";
import { Btn } from "./parts";
import { Sheet } from "./sheet";

// Guards by blast radius (the mock's guards.js, docs/PLAN-new-design.md step 5). Tier 0, just you and fixable until
// airtime: no guard. Tier 1, affects others and reversible: it happens at once, with Undo on the toast (ui/toast.tsx)
// and in Recent changes. Tier 2, moves standings: this sheet first, saying what changes for the couch, then confirm;
// Undo until the next episode airs. Tier 3 (hard to undo: a hold to confirm, archive first) comes with step 6a.

export function GuardSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  lines,
  loading,
  cta,
  undoNote,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** What changes, from the server's dry run; null while it's worked out. */
  lines: PreviewLine[] | null;
  loading?: boolean;
  cta: string;
  undoNote: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle}>
      <div data-guard="2" className="flex flex-col gap-1.5">
        {lines === null || loading ? (
          <div aria-busy className="h-28 animate-pulse rounded-[3px] bg-background" />
        ) : lines.length ? (
          lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-[3px] bg-background p-2.5">
              {l.face.kind === "castaway" ? (
                <Face src={l.face.photo} name={l.face.name} className="size-7 flex-none rounded-[3px]" />
              ) : (
                <Avatar id={l.face.userId ?? l.face.name} name={l.face.name} size={28} />
              )}
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{l.label}</span>
              {l.change && (
                <span className={`text-right text-[13px] font-bold ${l.dir === "up" ? "text-good" : "text-muted-foreground"}`}>{l.change}</span>
              )}
            </div>
          ))
        ) : (
          <p className="flex items-center gap-2 rounded-[3px] bg-background p-3 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 flex-none" aria-hidden />
            Nobody&apos;s place or score moves.
          </p>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <RotateCcw className="size-[15px] flex-none" aria-hidden />
        {undoNote}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Btn
        data-guard-confirm
        tone="must"
        wide
        className="mt-3"
        disabled={busy || lines === null || loading}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onConfirm();
            onOpenChange(false);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Applying…" : cta}
      </Btn>
      <Btn wide className="mt-2" onClick={() => onOpenChange(false)}>
        Not yet
      </Btn>
    </Sheet>
  );
}
