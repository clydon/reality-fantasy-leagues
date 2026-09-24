"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { ReplenishPanel } from "./replenish-panel";
import { TradePanel } from "./trade-panel";
import { FinalePanel } from "./finale-panel";
import { useShowTerms } from "@/lib/use-show-terms";

// Direct port of renderMidseason() (public/app.js): intro panel, then Replenish, Swap, and
// Finale Predictions, same order. Each panel is gated on BOTH the active league type's
// supportsReplenish/supportsTrade/supportsFinalePredictions capability (state-logic.js's
// LEAGUE_TYPES) AND the commissioner's own enable toggle in League Settings -- see
// replenishAvailable/tradeAvailable/finalePredictionsAvailable.
export function MidSeasonTab() {
  const terms = useShowTerms();
  const state = useLeagueStore((s) => s.state);
  const leagueType = StateLogic.getLeagueType(state);
  // Capability AND commissioner choice -- both default off, see replenishAvailable's comment.
  const replenishOn = StateLogic.replenishAvailable(state);
  const tradeOn = StateLogic.tradeAvailable(state);
  const finaleOn = StateLogic.finalePredictionsAvailable(state);

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

      {/* Hidden when neither mechanic is available -- either the league type can't support them
          (shared ownership has no free agents) or the commissioner hasn't enabled them. */}
      {(replenishOn || tradeOn) && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish &amp; Swap</h3>
          <p className="text-sm text-muted-foreground">
            Change who owns which {terms.castaway} after eliminations — full mechanics are in the Rules tab. Usually run Replenish
            first, right after the merge, then Swap.
          </p>
        </div>
      )}

      {replenishOn && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Replenish</h3>
          <ReplenishPanel state={state} />
        </div>
      )}

      {tradeOn && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Swap (Drop &amp; Add)</h3>
          <TradePanel state={state} />
        </div>
      )}

      {finaleOn && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Finale Predictions</h3>
          <FinalePanel state={state} />
        </div>
      )}
    </>
  );
}
