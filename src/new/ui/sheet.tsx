"use client";

import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSheetSwipe } from "@/components/ui/use-sheet-swipe";
import { useSheetHistory } from "./sheet-history";
import { ARRIVE, SPRING } from "./swipe-pager";

// The new design's sheet (the mock's .sheet): rises from the bottom of the phone column over a scrim, a grab
// handle, a condensed caps title with one line under it, and a close button. Base UI's Dialog traps focus and
// closes on Escape or a scrim tap; a swipe down closes it too (classic's use-sheet-swipe.ts), and so does the phone's
// back (./sheet-history.ts). Reduced motion: no slide, the scrim still fades. `back`: a sheet reached from another one (the show's
// ⋯ menu › Everything else) puts a back arrow before its title, for the sheet it came from. `stepper`: a sheet that steps through
// a list (a player's sheet through the table): ‹ › beside Close, and a sideways swipe on its header (the user, 2026-10-31). The
// header and what's under it follow the finger, the neighbour's name coming in at the edge; past a fifth, or on a flick, they
// slide out the way they're going and the next one slides in from the other side; the ends stretch and spring back.

type Stepper = { prev: string | null; next: string | null; onStep: (dir: 1 | -1) => void };

export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  back,
  stepper,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { label: string; onClick: () => void };
  stepper?: Stepper;
  children: ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const swipe = useSheetSwipe({ sheetRef: popupRef, scrimRef, onClose: () => onOpenChange(false) });
  useSheetHistory(open, () => onOpenChange(false));
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const step = useStepSwipe(stepper, head, body, ghosts);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          ref={scrimRef}
          className="nd-fixed-x fixed inset-y-0 z-[80] bg-[var(--scrim)] transition-opacity duration-[250ms] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <Dialog.Popup
          ref={popupRef}
          {...swipe}
          className="nd-fixed-x fixed bottom-0 z-[81] flex max-h-[88dvh] flex-col rounded-t-[14px] bg-card text-foreground shadow-sheet outline-none transition-transform duration-[380ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none data-[ending-style]:translate-y-[105%] data-[starting-style]:translate-y-[105%]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div data-sheet-handle className="flex-none cursor-grab pb-1.5 pt-2.5" style={{ touchAction: "none" }} aria-hidden>
            <i className="mx-auto block h-1 w-10 rounded-full bg-input" />
          </div>
          <div
            {...(stepper ? step.handlers : {})}
            className={`relative flex flex-none items-center justify-between gap-3 px-4 pb-2.5 pt-1 ${stepper ? "touch-pan-y overflow-x-clip" : ""}`}
          >
            {stepper && (
              // Who's next, coming in at the edge on the subtitle's line as the header moves.
              <div ref={ghosts} aria-hidden className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-between">
                <span className="type-caption max-w-[45%] truncate text-[13px] tracking-[0.04em] text-muted-foreground opacity-0">‹ {stepper.prev}</span>
                <span className="type-caption max-w-[45%] truncate text-[13px] tracking-[0.04em] text-muted-foreground opacity-0">{stepper.next} ›</span>
              </div>
            )}
            {back ? (
              <div className="flex min-w-0 items-center gap-1">
                <button type="button" aria-label={back.label} data-sheet-back onClick={back.onClick} className="-ml-2.5 grid size-10 flex-none place-items-center rounded-[3px] hover:bg-secondary">
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <Dialog.Title className="type-caption text-[26px]">{title}</Dialog.Title>
                  {subtitle && <Dialog.Description className="mt-[5px] text-[13px] font-medium text-muted-foreground">{subtitle}</Dialog.Description>}
                </div>
              </div>
            ) : (
              <div ref={head} className="min-w-0 [overflow-wrap:anywhere]">
                <Dialog.Title className="type-caption text-[26px]">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-[5px] text-[13px] font-medium text-muted-foreground">{subtitle}</Dialog.Description>}
              </div>
            )}
            <div className="flex flex-none items-center">
              {stepper && (
                <>
                  <button type="button" data-sheet-prev aria-label={stepper.prev ? `Previous: ${stepper.prev}` : "No one ahead"} disabled={!stepper.prev} onClick={() => step.go(-1)} className="grid h-10 w-9 place-items-center rounded-[3px] text-muted-foreground hover:bg-secondary disabled:opacity-30">
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button type="button" data-sheet-next aria-label={stepper.next ? `Next: ${stepper.next}` : "No one behind"} disabled={!stepper.next} onClick={() => step.go(1)} className="grid h-10 w-9 place-items-center rounded-[3px] text-muted-foreground hover:bg-secondary disabled:opacity-30">
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                </>
              )}
              <Dialog.Close aria-label="Close" className="grid size-10 flex-none place-items-center rounded-[3px] hover:bg-secondary">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <div className={`min-h-0 overflow-y-auto overscroll-contain px-4 pb-[22px] ${stepper ? "overflow-x-hidden" : ""}`}>{stepper ? <div ref={body}>{children}</div> : children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The stepper's swipe on the header, and its slide out and in (the buttons use it too). */
function useStepSwipe(stepper: Stepper | undefined, head: RefObject<HTMLDivElement | null>, body: RefObject<HTMLDivElement | null>, ghosts: RefObject<HTMLDivElement | null>) {
  const latest = useRef(stepper);
  useLayoutEffect(() => {
    latest.current = stepper;
  });
  const drag = useRef<{ id: number; x: number; y: number; dx: number; lock: boolean; vx: number; lx: number; lt: number } | null>(null);
  const busy = useRef(false);
  // A drag that started on ‹ › or Close isn't a tap on it.
  const moved = useRef(false);
  const width = () => body.current?.clientWidth || 360;
  /** Header and body at `x`, at `fade` (1: fully there), over `ms`. */
  const place = (x: number, fade: number, ms = 0, easing = "linear") => {
    for (const el of [head.current, body.current]) {
      if (!el) continue;
      el.style.transition = ms ? `transform ${ms}ms ${easing}, opacity ${ms}ms ${easing}` : "none";
      el.style.transform = x ? `translateX(${x}px)` : "";
      el.style.opacity = fade < 1 ? String(fade) : "";
    }
  };
  /** The neighbour's name `dir` (1: the next, at the right; -1: the previous, at the left), `p` of the way in. */
  const ghost = (dir: number, p: number, ms = 0) => {
    const [prev, next] = Array.from(ghosts.current?.children ?? []) as HTMLElement[];
    for (const [el, d] of [
      [prev, -1],
      [next, 1],
    ] as const) {
      if (!el) continue;
      const on = d === dir ? p : 0;
      el.style.transition = ms ? `opacity ${ms}ms ease, transform ${ms}ms ease` : "none";
      el.style.opacity = String(on);
      el.style.transform = `translateX(${(1 - on) * 14 * d}px)`;
    }
  };
  // The step under way: its timers, and the step itself while the old one is still sliding out.
  const timers = useRef<number[]>([]);
  const pending = useRef<(() => void) | null>(null);
  /** A tap or a drag mid-step (› › › in quick succession): that step lands at once, and the new one starts from there. */
  const finish = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const step = pending.current;
    pending.current = null;
    if (step) flushSync(step);
    place(0, 1);
    ghost(0, 0);
    busy.current = false;
  };
  const go = (dir: 1 | -1) => {
    if (busy.current) finish();
    const s = latest.current;
    if (!s || !(dir > 0 ? s.next : s.prev)) return;
    busy.current = true;
    const W = width();
    const still = reduced();
    const out = still ? 90 : 150;
    place(still ? 0 : -dir * W * 0.4, 0, out, "cubic-bezier(0.4, 0, 1, 1)");
    ghost(0, 0, out);
    try {
      navigator.vibrate?.(8);
    } catch {}
    pending.current = () => s.onStep(dir);
    timers.current.push(
      window.setTimeout(() => {
        // The next one in place before a frame shows it: then in from the side it was coming from.
        const step = pending.current;
        pending.current = null;
        if (step) flushSync(step);
        place(still ? 0 : dir * W * 0.3, 0);
        void body.current?.offsetWidth;
        const inMs = still ? 160 : 340;
        place(0, 1, inMs, ARRIVE);
        timers.current.push(
          window.setTimeout(() => {
            busy.current = false;
            for (const el of [head.current, body.current]) if (el) el.style.transition = "";
          }, inMs + 10)
        );
      }, out)
    );
  };
  const onPointerDown = (e: PointerEvent) => {
    moved.current = false;
    if (!latest.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (busy.current) finish();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, lock: false, vx: 0, lx: e.clientX, lt: e.timeStamp };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const s = latest.current;
    if (!d || !s || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.lock = true;
        moved.current = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      } else if (Math.abs(dy) > 10) {
        drag.current = null;
        return;
      } else return;
    }
    d.vx = d.vx * 0.3 + ((e.clientX - d.lx) / Math.max(1, e.timeStamp - d.lt)) * 0.7;
    d.lx = e.clientX;
    d.lt = e.timeStamp;
    const W = width();
    const has = dx < 0 ? !!s.next : !!s.prev;
    let x = Math.max(-W, Math.min(W, dx));
    // Nobody that way: it stretches a little and springs back.
    if (!has) x = Math.sign(x) * W * 0.12 * (1 - Math.exp(-Math.abs(x) / (W * 0.5)));
    d.dx = x;
    place(x, 1 - Math.min(0.55, Math.abs(x) / W));
    ghost(has ? (x < 0 ? 1 : -1) : 0, Math.min(1, Math.abs(x) / (W * 0.3)));
  };
  const back = () => {
    place(0, 1, 360, SPRING);
    ghost(0, 0, 200);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const s = latest.current;
    if (!d?.lock || !s) return;
    const W = width();
    const vx = e.timeStamp - d.lt < 90 ? d.vx : 0;
    // A quick flick counts as much as a long drag.
    const dir = (d.dx < -W * 0.2 || (vx < -0.4 && d.dx < -16)) && s.next ? 1 : (d.dx > W * 0.2 || (vx > 0.4 && d.dx > 16)) && s.prev ? -1 : 0;
    if (dir) go(dir);
    else back();
  };
  const onPointerCancel = () => {
    const locked = drag.current?.lock;
    drag.current = null;
    if (locked) back();
  };
  const onClickCapture = (e: MouseEvent) => {
    if (!moved.current) return;
    moved.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  return { go, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture } };
}
