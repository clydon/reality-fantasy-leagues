"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { ScoringTable, scoringTableGroups } from "@/components/scoring-table";
import { useShowTerms } from "@/lib/use-show-terms";
import { Card } from "@/components/ui/card";

// Overview section (Active Roster only). The league's scoring rules in one place, collapsed by default: the lineup shape, what each event
// is worth (the same table as the lineup card's "How starters score"), and the extras that add to a
// total -- predictions and finale picks -- when this league has them on.
export function LeagueScoringCard({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const groups = scoringTableGroups(state);
  const s = state.settings;
  const active = StateLogic.ActiveRosterLogic.activeSlots(state);
  const bench = StateLogic.ActiveRosterLogic.benchSlots(state);
  const finale = StateLogic.finalePredictionsAvailable(state);
  const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

  return (
    <Card className="rounded-lg border border-border px-4 shadow-sm dark:rounded-none dark:border-0 dark:bg-transparent dark:px-0 dark:py-0 dark:shadow-none dark:ring-0">
      <details>
        <summary className="cursor-pointer section-title">
          League Scoring
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          {active > 0 ? (
            <>
              Each week you start <b className="text-foreground">{active}</b>
              {bench > 0 ? (
                <>
                  {" "}
                  and bench <b className="text-foreground">{bench}</b>
                </>
              ) : null}
              .{" "}
            </>
          ) : null}
          Only starters score: a {terms.castaway}&rsquo;s points count for you
          in the episodes you started them.
        </p>
        {groups.length > 0 && <ScoringTable groups={groups} />}
        {(s.bonusEnabled || finale) && (
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {s.bonusEnabled && (
              <div>
                <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Predictions
                </div>
                <p className="text-xs text-muted-foreground">
                  Each prediction is worth what the commissioner sets for it,
                  paid for a right guess — only when at least two people
                  guessed.
                </p>
              </div>
            )}
            {finale && (
              <div>
                <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Finale
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-xs">
                  <span className="text-muted-foreground">
                    Each correct top-3 name
                  </span>
                  <span className="font-mono font-semibold text-good">
                    +{s.finaleTop3Points}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-xs">
                  <span className="text-muted-foreground">Correct winner</span>
                  <span className="font-mono font-semibold text-good">
                    +{s.finaleWinnerPoints}
                  </span>
                </div>
                <p className="sr-only">
                  Up to {pts(s.finaleTop3Points * 3 + s.finaleWinnerPoints)}.
                </p>
              </div>
            )}
          </div>
        )}
      </details>
    </Card>
  );
}
