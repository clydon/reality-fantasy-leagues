"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { ReplenishPanel } from "./replenish-panel";
import { TradePanel } from "./trade-panel";
import { FinalePanel } from "./finale-panel";

// Direct port of renderMidseason() (public/app.js): intro panel, then Replenish, Swap, and
// Finale Predictions, same order. Each panel is additionally gated on the active league type's
// supportsReplenish/supportsTrade/supportsFinalePredictions flags (see state-logic.js's
// LEAGUE_TYPES) -- a no-op today since 'classic-draft' supports all three, but this is what makes
// a future league type without e.g. a persistent roster (so no Replenish/Swap) able to just not
// show those panels, rather than needing a special case here later.
export function MidSeasonTab() {
  const state = useLeagueStore((s) => s.state);
  const leagueType = StateLogic.getLeagueType(state);

  // The sidebar/mobile nav both hide this tab's link for a league type with no roster (pickem,
  // whose supportsReplenish/supportsTrade/supportsFinalePredictions are all false anyway, which
  // would otherwise render this whole page down to just the static intro panel below), but this
  // route is still directly reachable by URL -- guard here too.
  if (!leagueType.hasRoster) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Mid-Season Tools</h2>
        <p className="text-sm text-muted-foreground">This league type has no roster, so there&rsquo;s nothing to replenish or swap.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Mid-Season Tools</h2>

      {/* Both mechanics this intro describes are free-agent based, so it's hidden when neither
          applies -- shared-ownership leagues have no free agents (see CLASSIC_DRAFT_SHARED),
          leaving only the Finale panel below. */}
      {(leagueType.supportsReplenish || leagueType.supportsTrade) && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish &amp; Swap</h3>
          <p className="text-sm text-muted-foreground">
            Change who owns which castaway after eliminations — full mechanics are in the Rules tab. Usually run Replenish
            first, right after the merge, then Swap.
          </p>
        </div>
      )}

      {leagueType.supportsReplenish && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish</h3>
          <ReplenishPanel state={state} />
        </div>
      )}

      {leagueType.supportsTrade && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Swap (Drop &amp; Add)</h3>
          <TradePanel state={state} />
        </div>
      )}

      {leagueType.supportsFinalePredictions && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Finale Predictions</h3>
          <FinalePanel state={state} />
        </div>
      )}
    </>
  );
}
