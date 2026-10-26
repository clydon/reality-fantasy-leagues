"use client";

import type { ReactNode } from "react";
import { PREVIEWS, type PreviewEntry, type PreviewId } from "../preview";
import { toast } from "./toast";

// <Preview id> (docs/PLAN-new-design.md, "The Preview system"): a part of a screen that isn't on real data yet.
// A quiet dashed outline and a small "Preview" tag, so nobody mistakes it for their own couch, and every tap
// inside says "Coming soon" instead of doing anything. The registry (src/new/preview.ts) says which step makes it
// real. With no children it draws its own placeholder from the registry: what will be here.
//
// Two exceptions, so a previewed screen can still be looked around: a control marked `data-try` works (it only
// changes what the fixture shows: a view, a segment, a sheet of the same fixture, a tab), and a Preview inside
// another answers for its own part (its own toast, its own `data-try`s). A sheet or page opened from a Preview
// renders elsewhere (a portal), so it wraps its own fixture in a Preview of its own.

/** `tag={false}` for a control too small to carry the tag (an icon button): the outline alone marks it. */
export function Preview({ id, children, tag = true, className = "" }: { id: PreviewId; children?: ReactNode; tag?: boolean; className?: string }) {
  // Typed as an entry: with the registry empty (since step 15 part 4) no id exists, and nothing renders this until step C deletes it.
  const entry: PreviewEntry = PREVIEWS[id];
  return (
    <div
      data-preview={id}
      data-preview-step={entry.step}
      className={`relative rounded-[4px] outline-2 -outline-offset-2 outline-dashed outline-input ${className}`}
      // Capture, so a link or button inside never fires: the tap only explains.
      onClickCapture={(e) => {
        // React carries events up through portals: a sheet opened from in here isn't in here, and marks its own.
        if (!e.currentTarget.contains(e.target as Node)) return;
        const near = (e.target as Element).closest("[data-try], [data-preview]");
        if (near && near !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        toast(`Coming soon: ${entry.title}`);
      }}
    >
      {tag && (
        // On the dashed line, like a legend, so it never covers what it marks.
        <span className="type-caption pointer-events-none absolute -top-2 right-3 z-[2] rounded-[2px] bg-secondary px-1.5 py-[3px] text-[10px] tracking-[0.05em] text-muted-foreground">
          Preview
        </span>
      )}
      {children ?? (
        <div className="px-4 pb-5 pr-20 pt-4">
          <b className="type-caption block text-[19px]">{entry.title}</b>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{entry.line}</p>
        </div>
      )}
    </div>
  );
}
