"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { ReplenishPanel } from "./replenish-panel";
import { TradePanel } from "./trade-panel";
import { FinalePanel } from "./finale-panel";
import { useShowTerms } from "@/lib/use-show-terms";
import { SectionHead } from "@/components/draft/draft-ui";

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
        <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Mid-Season</h2>
        <p className="text-base text-muted-foreground">This league type has no roster, so there&rsquo;s nothing to replenish or swap.</p>
      </>
    );
  }

  // Each tool is a flat section with a condensed caps heading, like Overview's (direction A). The
  // turn-based ones (Replenish, Swap) run the same select-then-confirm pickers as the draft.
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="type-caption text-[28px] max-nav:hidden">Mid-Season</h2>
        {/* Hidden when neither mechanic is available -- either the league type can't support them
            (shared ownership has no free agents) or the commissioner hasn't enabled them. */}
        {(replenishOn || tradeOn) && (
          <p className="text-sm text-muted-foreground">
            {leagueType.hasActiveRoster ? (
              <>
                Replenish keeps every roster able to field a full lineup after eliminations. Swap runs on a schedule so
                everyone gets the same chances to change a {terms.castaway}.
              </>
            ) : (
              <>
                Change who owns which {terms.castaway} after eliminations. Usually Replenish first,{" "}
                {StateLogic.formatOf(state).hasMerge ? "right after the merge" : "about halfway through the season"}, then Swap.
              </>
            )}
          </p>
        )}
      </div>

      {replenishOn && (
        <section className="flex flex-col gap-2">
          <SectionHead>Replenish</SectionHead>
          <ReplenishPanel state={state} />
        </section>
      )}

      {tradeOn && (
        <section className="flex flex-col gap-2">
          <SectionHead>Swap</SectionHead>
          <TradePanel state={state} />
        </section>
      )}

      {finaleOn && (
        <section className="flex flex-col gap-2">
          <SectionHead>Finale predictions</SectionHead>
          <FinalePanel state={state} />
        </section>
      )}
    </div>
  );
}
