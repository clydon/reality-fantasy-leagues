"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";

// The first-time tour's practice runs (docs/PLAN-first-time-tour.md version 3): the real sheets, nothing saved, and one path
// through them. What says so, shared by Add a show (watching/sheets.tsx) and Start a game (couch/start-game.tsx): a strip at the
// sheet's top all the way through, the finish that stands in for the save, saying it again, the path (`keepToPath`), and what's
// next on it shown when they wait (`useNudge`).

/** Shakes what to tap next (a practice's path, the tour's lit thing): a Web Animation; under reduced motion a blink instead. */
export function shake(el: Element | null | undefined) {
  if (!el) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.animate(
    still
      ? [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }]
      : [{ transform: "none" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "none" }],
    { duration: still ? 600 : 450, easing: "ease-in-out" }
  );
}

/** A practice step's path: what in it takes taps (`on`), what to tap next (shaken when anything else is), and a word why. */
export type PracticePath = { on: string; next: () => Element | null | undefined; word?: string };

/** One path through a practice (the user, 2026-11-01: "don't let the user stray from the intended path"): for a sheet's content, its
 *  onClickCapture. A tap on something tappable off the path is stopped there, and the next thing on it shakes. The tour's own
 *  taps (the demo's, from script) go through. */
export function keepToPath(path: PracticePath | null) {
  if (!path) return undefined;
  return (e: MouseEvent) => {
    const t = e.target as Element;
    if (!e.nativeEvent.isTrusted || t.closest(path.on) || !t.closest("button, a, input, label, select, textarea, [role=button], [role=switch], [role=radio], [role=checkbox], [role=tab]")) return;
    e.preventDefault();
    e.stopPropagation();
    shake(path.next());
    if (path.word) toast.quiet(path.word);
  };
}

/** The first hint on a practice step, and the ones after it while nothing's tapped. */
const NUDGE_AFTER = 1200;
const NUDGE_EVERY = 5000;

/** The box around `el` that scrolls up and down (a sheet's body), if it has somewhere to go. */
function scroller(el: Element | null): HTMLElement | null {
  for (let p = el; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === "auto" || y === "scroll") && p.scrollHeight > p.clientHeight + 1) return p as HTMLElement;
  }
  return null;
}

/** A practice step that waits on the person shows what moves it on (the user, 2026-11-01: "shake Add to my shows to show it's what
 *  we need to do to progress", "scroll down then shake Start it"): a moment in, the sheet scrolls to its end (from `from`, what
 *  scrolls, when `next` is in the sheet's foot), then `next` shakes; again every few seconds while it's not tapped, and not while
 *  they're busy with the sheet. Both as the open sheet has them. */
export function useNudge(on: boolean, next: string, from?: string) {
  useEffect(() => {
    if (!on) return;
    const here = (sel: string) => document.querySelector<HTMLElement>(`[role=dialog][data-open] ${sel}`);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let touched = 0;
    let first = true;
    let timer = 0;
    const touch = () => (touched = performance.now());
    const nudge = () => {
      const el = here(next);
      // Not there yet (a listing's season still reading), or a tap in the last moment: a little later.
      if (!el || performance.now() - touched < 2500) {
        timer = window.setTimeout(nudge, el ? 1000 : 300);
        return;
      }
      const body = scroller(here(from ?? next));
      let to: number | null = null;
      if (body && first) to = body.scrollHeight - body.clientHeight;
      else if (body?.contains(el)) {
        // Scrolled away from it since: back to it.
        const r = el.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        if (r.bottom > b.bottom) to = body.scrollTop + r.bottom - b.bottom + 12;
        else if (r.top < b.top) to = body.scrollTop + r.top - b.top - 12;
      }
      first = false;
      const moves = !!body && to != null && Math.abs(to - body.scrollTop) > 2;
      if (moves) body.scrollTo({ top: to!, behavior: still ? "auto" : "smooth" });
      timer = window.setTimeout(
        () => {
          shake(here(next));
          timer = window.setTimeout(nudge, NUDGE_EVERY);
        },
        moves && !still ? 700 : 0
      );
    };
    timer = window.setTimeout(nudge, NUDGE_AFTER);
    document.addEventListener("pointerdown", touch, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", touch, true);
    };
  }, [on, next, from]);
}

/** A show as people say it in a finish: "The Amazing Race 39", not "The Amazing Race (American edition) 39". */
export const said = (name: string) => name.replace(/\s*\([^)]*\)/g, "").trim() || name;

/** At a practice sheet's top, every step of the way. */
export function PracticeStrip() {
  return (
    <p data-practice className="mb-3 flex items-center gap-2 rounded-[3px] bg-secondary py-2 pl-2 pr-3 text-[13px] font-semibold leading-snug">
      <span className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-background">Practice</span>
      Nothing you do here is saved.
    </p>
  );
}

/** Where the save would be: it worked, it wasn't kept, and Done (the tour goes on), or what `done` says instead. */
export function PracticeFinish({ line, children, done = "Done", onDone }: { line: string; children?: ReactNode; done?: string; onDone: () => void }) {
  return (
    <div data-practice-done className="flex flex-col gap-3 pb-1">
      <p className="flex items-start gap-2.5 text-[15px] leading-snug">
        <span className="grid size-7 flex-none place-items-center rounded-full bg-good text-good-foreground">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <span className="pt-0.5">{line}</span>
      </p>
      {children}
      <Btn tone="ink" wide data-practice-close onClick={onDone} className="mt-1">
        {done}
      </Btn>
    </div>
  );
}

/** A practice finish's second word, set apart: what to take from it. */
export function PracticeNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[3px] bg-secondary px-3 py-2.5 text-[15px] font-semibold leading-snug">{children}</p>;
}
