"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Btn } from "../ui/parts";

// The first-time tour's practice runs (docs/PLAN-first-time-tour.md version 2): the real sheets, every tap working, nothing saved.
// What says so, shared by Add a show (watching/sheets.tsx) and Start a game (couch/start-game.tsx): a strip at the sheet's top all
// the way through, and the finish that stands in for the save, saying it again.

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
