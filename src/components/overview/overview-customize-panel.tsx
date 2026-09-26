"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import { useIsSuperAdmin } from "@/lib/store";
import { useOverviewLayout } from "@/lib/use-overview-layout";
import { OVERVIEW_SECTION_LABELS, isOverviewSectionEligible } from "@/lib/overview-layout";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

// Super-admin-only editor for Overview's APP-WIDE layout -- see use-overview-layout.ts's comment:
// every edit here applies to every user's Overview, real leagues and demo mode alike, not just this
// browser. Collapsed by default behind a small toggle so it doesn't take up space for the one person
// who ever sees it; everyone else never renders this at all (useIsSuperAdmin gates the whole
// component, not just the panel body).
export function OverviewCustomizePanel({ state, draftComplete }: { state: LeagueState; draftComplete: boolean }) {
  const isSuperAdmin = useIsSuperAdmin();
  const [open, setOpen] = useState(false);
  const { order, hidden, moveUp, moveDown, toggleHidden, reset } = useOverviewLayout();

  if (!isSuperAdmin) return null;

  const eligible = order.filter((id) => isOverviewSectionEligible(id, state, draftComplete));

  return (
    <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2.5 text-sm">
      <button className="flex w-full items-center justify-between font-semibold text-primary" onClick={() => setOpen((o) => !o)}>
        🛠 Customize Overview (admin only)
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            Reorder or hide sections to try out a layout. This changes Overview for <b>everyone</b>, in every league
            and in demo mode.
          </p>
          {eligible.map((id, i) => (
            <div key={id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
              <span className={cn("flex-1 text-sm", hidden[id] && "text-muted-foreground line-through")}>
                {OVERVIEW_SECTION_LABELS[id]}
              </span>
              <button
                className="rounded border border-border px-1.5 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                disabled={i === 0}
                onClick={() => moveUp(id)}
                title="Move up"
              >
                ↑
              </button>
              <button
                className="rounded border border-border px-1.5 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                disabled={i === eligible.length - 1}
                onClick={() => moveDown(id)}
                title="Move down"
              >
                ↓
              </button>
              <button
                className="rounded border border-border px-1.5 py-0.5 text-xs"
                onClick={() => toggleHidden(id)}
                title={hidden[id] ? "Show" : "Hide"}
              >
                {hidden[id] ? "Show" : "Hide"}
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className="mt-1 self-start" onClick={reset}>
            Reset to default
          </Button>
        </div>
      )}
    </div>
  );
}
