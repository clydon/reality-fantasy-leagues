"use client";

import { usePathname } from "next/navigation";
import { useNav } from "../nav";
import { paths } from "../routes";
import { useTourVisit } from "./store";

// Back to the tour (docs/PLAN-first-time-tour.md version 3): on the page a tour step went to for real (your moves: the top line's
// own link, tour.tsx), a pill under the header with the step's count, back to Home (the browser's back when Home's behind, as
// Back always is: nav.tsx), where the tour carries on. Mounted once, in the signed-in layout.

export function TourBack() {
  const visit = useTourVisit();
  const pathname = usePathname();
  const nav = useNav();
  if (!visit || pathname === paths.home) return null;
  return (
    <div className="nd-fixed-x pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+66px)] z-[70] flex justify-center px-4">
      <button
        type="button"
        data-tour-back
        onClick={() => nav.back(paths.home)}
        className="nd-press pointer-events-auto flex h-11 items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate"
      >
        <span className="tag-cut type-num grid place-items-center bg-quiet-tag pl-[10px] pr-4 text-[15px] text-quiet-tag-foreground [--tag-slant:10px]">{visit.count}</span>
        <span className="flex items-center gap-1 pl-1 pr-3.5 text-[15px] font-bold">
          Back to the tour
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </button>
    </div>
  );
}
