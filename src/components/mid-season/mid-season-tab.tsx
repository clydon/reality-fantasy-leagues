"use client";

import { useLeagueStore } from "@/lib/store";
import { ReplenishPanel } from "./replenish-panel";
import { TradePanel } from "./trade-panel";
import { FinalePanel } from "./finale-panel";

// Direct port of renderMidseason() (public/app.js): intro panel, then Replenish, Swap, and
// Finale Predictions, same order.
export function MidSeasonTab() {
  const state = useLeagueStore((s) => s.state);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Mid-Season Tools</h2>

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish &amp; Swap</h3>
        <p className="text-sm text-muted-foreground">
          Change who owns which castaway after eliminations — full mechanics are in the Rules tab. Usually run Replenish
          first, right after the merge, then Swap.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish</h3>
        <ReplenishPanel state={state} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Swap (Drop &amp; Add)</h3>
        <TradePanel state={state} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Finale Predictions</h3>
        <FinalePanel state={state} />
      </div>
    </>
  );
}
