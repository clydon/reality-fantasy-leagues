"use client";

import type { ReactNode } from "react";
import { PREVIEWS, type PreviewId } from "../preview";
import { toast } from "./toast";

// <Preview id> (docs/PLAN-new-design.md, "The Preview system"): a part of a screen that isn't on real data yet.
// A quiet dashed outline and a small "Preview" tag, so nobody mistakes it for their own couch, and every tap
// inside says "Coming soon" instead of doing anything. The registry (src/new/preview.ts) says which step makes it
// real. With no children it draws its own placeholder from the registry: what will be here.

/** `tag={false}` for a control too small to carry the tag (an icon button): the outline alone marks it. */
export function Preview({ id, children, tag = true, className = "" }: { id: PreviewId; children?: ReactNode; tag?: boolean; className?: string }) {
  const entry = PREVIEWS[id];
  return (
    <div
      data-preview={id}
      data-preview-step={entry.step}
      className={`relative rounded-[4px] outline-2 -outline-offset-2 outline-dashed outline-input ${className}`}
      // Capture, so a link or button inside never fires: the tap only explains.
      onClickCapture={(e) => {
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
