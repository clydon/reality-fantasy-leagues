"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { useOverviewLayout } from "@/lib/use-overview-layout";
import {
  OVERVIEW_LEAGUE_TYPE_IDS,
  OVERVIEW_SECTION_LABELS,
  isOverviewSectionForType,
  type OverviewLeagueTypeId,
} from "@/lib/overview-layout";
import { DEMO_LEAGUE_TYPE_LABELS } from "@/lib/game/demo-season-builder";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

// Super-admin editor for Overview's APP-WIDE layout -- see use-overview-layout.ts: every edit applies
// to every user's Overview OF THAT LEAGUE TYPE, real leagues and demo mode alike. Classic Draft,
// Active Roster and Eliminator Pool each keep their own layout (overview-layout.ts's
// OVERVIEW_LEAGUE_TYPE_IDS comment).
//
// Lives in Admin, not on a league's Overview: a setting that changes every league shouldn't sit at
// the top of one of them (docs/PLAN-ux-redesign.md, 1g). The parent gates it to super admins.
export function OverviewLayoutsSection() {
  const [typeId, setTypeId] = useState<OverviewLeagueTypeId>("active-roster");
  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Overview layouts</h3>
      <p className="mb-2.5 text-xs text-muted-foreground">
        The order of sections on Overview, per league type. Changes apply to every league of that type, and to demo mode.
      </p>
      <div role="tablist" aria-label="League type" className="mb-2.5 flex rounded-md bg-muted p-[3px]">
        {OVERVIEW_LEAGUE_TYPE_IDS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === typeId}
            className={cn(
              "min-h-10 flex-1 rounded-[4px] px-2 text-[13px] font-semibold",
              id === typeId ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => setTypeId(id)}
          >
            {DEMO_LEAGUE_TYPE_LABELS[id]}
          </button>
        ))}
      </div>
      <OverviewLayoutEditor key={typeId} leagueTypeId={typeId} />
    </div>
  );
}

function OverviewLayoutEditor({ leagueTypeId }: { leagueTypeId: OverviewLeagueTypeId }) {
  const { order, hidden, moveUp, moveDown, toggleHidden, reset } = useOverviewLayout(leagueTypeId);
  const eligible = order.filter((id) => isOverviewSectionForType(id, leagueTypeId));
  const iconBtn =
    "flex size-10 items-center justify-center rounded-md border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="flex flex-col gap-1.5">
      {eligible.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5 rounded-md border border-border bg-background py-1 pl-3 pr-1">
          <span className={cn("flex-1 text-sm", hidden[id] && "text-muted-foreground line-through")}>{OVERVIEW_SECTION_LABELS[id]}</span>
          <button className={iconBtn} disabled={i === 0} onClick={() => moveUp(id)} aria-label={`Move ${OVERVIEW_SECTION_LABELS[id]} up`}>
            <ArrowUp className="size-4" />
          </button>
          <button
            className={iconBtn}
            disabled={i === eligible.length - 1}
            onClick={() => moveDown(id)}
            aria-label={`Move ${OVERVIEW_SECTION_LABELS[id]} down`}
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            className={iconBtn}
            onClick={() => toggleHidden(id)}
            aria-label={`${hidden[id] ? "Show" : "Hide"} ${OVERVIEW_SECTION_LABELS[id]}`}
          >
            {hidden[id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" className="mt-1 self-start" onClick={reset}>
        Reset to default
      </Button>
    </div>
  );
}
