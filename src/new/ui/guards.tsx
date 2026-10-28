"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { PreviewLine } from "../data";
import { Face } from "../show/parts";
import { Avatar } from "./bars";
import { Btn } from "./parts";
import { Sheet } from "./sheet";

// Guards by blast radius (the mock's guards.js, docs/PLAN-new-design.md step 5). Tier 0, just you and fixable until
// airtime: no guard. Tier 1, affects others and reversible: it happens at once, with Undo on the toast (ui/toast.tsx)
// and in Recent changes. Tier 2, moves standings: this sheet first, saying what changes for the couch, then confirm;
// Undo until the next episode airs. Tier 3, hard to undo (someone taken out of the games, leaving them): HoldSheet, a
// sentence saying what happens and a button you hold down, restorable from Recent changes for 30 days; an impossible
// state (the last Commissioner leaving) is refused before anyone holds.

export function GuardSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  lines,
  body,
  head,
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
  /** What changes, said another way (a waiver run: how many picks are in, never what they are), in place of `lines`. */
  body?: ReactNode;
  /** Said first, above what moves (Follow it again: what goes back to the season's). */
  head?: ReactNode;
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
        {head}
        {lines === null || loading ? (
          <div aria-busy className="h-28 animate-pulse rounded-[3px] bg-background" />
        ) : body ? (
          body
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

const HOLD_MS = 1400;

/**
 * Tier 3 (the mock's guards.js holdSheet): the consequence in a sentence, an easier way out when there is one (`alt`),
 * and "Hold to …": pressed and held for 1.4 s, by pointer or by Space/Enter; a tap or an early let-go does nothing but
 * say to hold it down. `problem`: why it can't happen at all (the last Commissioner), in place of the button.
 */
export function HoldSheet({
  open,
  onOpenChange,
  title,
  consequence,
  cta,
  problem,
  alt,
  restore = "Restorable for 30 days from Recent changes",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What happens, in a sentence; null while it's worked out. */
  consequence: string | null;
  cta: string;
  problem?: string | null;
  alt?: { label: string; line: string; onClick: () => void };
  /** The line under the button: how to have it back (null: none, the consequence says). */
  restore?: string | null;
  onConfirm: () => Promise<void>;
}) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressed = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = async () => {
    pressed.current = false;
    setHolding(false);
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
  };
  const start = () => {
    if (busy || pressed.current) return;
    pressed.current = true;
    setHint(false);
    setHolding(true);
    timer.current = setTimeout(go, HOLD_MS);
  };
  // Let go before the bar filled (or slid off it): nothing happens, and the line under the button says why.
  const stop = () => {
    if (!pressed.current) return;
    pressed.current = false;
    clearTimeout(timer.current);
    setHolding(false);
    setHint(true);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle="This one is hard to undo">
      <div data-guard="3">
        {consequence === null ? (
          <div aria-busy className="h-16 animate-pulse rounded-[3px] bg-background" />
        ) : (
          <p className="text-[16px] leading-snug">{consequence}</p>
        )}
        {alt && (
          <>
            <Btn wide className="mt-3.5" onClick={alt.onClick}>
              {alt.label}
            </Btn>
            <p className="mt-1.5 text-center text-[13px] text-muted-foreground">{alt.line}</p>
          </>
        )}
        {problem ? (
          <p role="alert" data-guard-problem className="mt-4 flex items-start gap-2 rounded-[3px] bg-background p-3 text-[15px] font-semibold">
            <TriangleAlert className="mt-0.5 size-[18px] flex-none text-chyron-line" aria-hidden />
            {problem}
          </p>
        ) : (
          <>
            <button
              type="button"
              data-hold
              disabled={consequence === null || busy}
              aria-label={`Hold to ${cta}`}
              // A finger that rolls a few pixels as it presses was handed to scrolling, which cancelled the hold mid-press
              // (check-hold-touch.js): touch-none keeps the touch here. A finger is also captured by what it lands on (the
              // label inside), so let go of that, and sliding off lets go of the hold as it does with a mouse.
              onPointerDown={(e) => {
                const on = e.target as Element;
                if (on.hasPointerCapture(e.pointerId)) on.releasePointerCapture(e.pointerId);
                start();
              }}
              onPointerUp={stop}
              onPointerLeave={stop}
              onPointerCancel={stop}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  start();
                }
              }}
              onKeyUp={stop}
              onContextMenu={(e) => e.preventDefault()}
              className="relative mt-4 flex h-14 w-full touch-none select-none items-center justify-center overflow-hidden rounded-[3px] bg-live/15 text-[16px] font-extrabold text-foreground outline-1 -outline-offset-1 outline-live/60 [-webkit-touch-callout:none] disabled:opacity-60"
            >
              <span
                aria-hidden
                className="absolute inset-0 origin-left bg-live ease-linear"
                style={{ transform: `scaleX(${holding ? 1 : 0})`, transitionProperty: "transform", transitionDuration: holding ? `${HOLD_MS}ms` : "180ms" }}
              />
              <span className="relative">{busy ? "One moment…" : holding ? "Keep holding…" : `Hold to ${cta}`}</span>
            </button>
            <p role="status" className="text-center text-[13px] font-semibold">
              {hint && !busy && (
                <span data-hold-hint className="mt-2 block">
                  Keep it held down until the bar fills, about 1½ seconds
                </span>
              )}
            </p>
            {restore && <p className="mt-2 text-center text-[13px] text-muted-foreground">{restore}</p>}
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Btn wide className="mt-3" onClick={() => onOpenChange(false)}>
          Not now
        </Btn>
      </div>
    </Sheet>
  );
}
