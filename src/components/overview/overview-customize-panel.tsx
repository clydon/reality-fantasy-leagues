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
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-snug text-muted-foreground">
        The order of sections on Overview, per league type. Changes apply to every league of that type, and to demo mode.
      </p>
      <div role="tablist" aria-label="League type" className="flex rounded-[3px] bg-card p-[3px]">
        {OVERVIEW_LEAGUE_TYPE_IDS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === typeId}
            className={cn(
              "min-h-10 flex-1 rounded-[2px] px-2 text-[13px] font-semibold",
              id === typeId ? "bg-foreground font-bold text-background" : "text-foreground hover:bg-muted",
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
    "flex size-11 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
        {eligible.map((id, i) => (
          <div key={id} className="flex min-h-[52px] items-center gap-1">
            <span className={cn("flex-1 text-[15px] font-semibold", hidden[id] && "font-normal text-muted-foreground line-through")}>{OVERVIEW_SECTION_LABELS[id]}</span>
            <button className={iconBtn} disabled={i === 0} onClick={() => moveUp(id)} aria-label={`Move ${OVERVIEW_SECTION_LABELS[id]} up`}>
              <ArrowUp className="size-5" />
            </button>
            <button
              className={iconBtn}
              disabled={i === eligible.length - 1}
              onClick={() => moveDown(id)}
              aria-label={`Move ${OVERVIEW_SECTION_LABELS[id]} down`}
            >
              <ArrowDown className="size-5" />
            </button>
            <button
              className={iconBtn}
              onClick={() => toggleHidden(id)}
              aria-label={`${hidden[id] ? "Show" : "Hide"} ${OVERVIEW_SECTION_LABELS[id]}`}
            >
              {hidden[id] ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="min-h-11 self-start rounded-[3px] border border-input bg-card px-3.5 text-[15px] font-bold text-foreground hover:bg-secondary"
        onClick={reset}
      >
        Reset to default
      </button>
    </div>
  );
}
