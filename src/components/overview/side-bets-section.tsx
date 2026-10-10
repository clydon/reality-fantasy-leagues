"use client";

import type { LeagueState } from "@/lib/game/types";
import { getActiveBets } from "@/lib/game/selectors";
import { useCanGuess, useMyPlayerId } from "@/lib/store";
import { BetCard } from "./bet-card";
import { DashCard } from "./dash-card";

// The league's open predictions (docs/PLAN-ux-declutter.md): only when there are some -- an empty
// section renders nothing. New ones are proposed on the upcoming episode's own page
// (episode-detail.tsx), where they belong; how they went is on each episode's page too. Hairline
// rows, no cards; how many still want your guess is a muted count beside the heading.
export function SideBetsSection({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const canGuessBets = useCanGuess();

  if (!state.settings.bonusEnabled) return null;
  const rows = getActiveBets(state);
  if (rows.length === 0) return null;
  const needsCount =
    canGuessBets && myPlayerId
      ? rows.filter(({ bet }) => !(bet.predictions || []).some((p) => p.playerId === myPlayerId)).length
      : 0;

  return (
    <div id="predictions" className="scroll-mt-20">
      <DashCard
        title="Predictions"
        aside={needsCount > 0 ? <span className="text-[13px] font-semibold text-muted-foreground">{needsCount} to guess</span> : undefined}
      >
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map(({ ep, bet }) => (
            <BetCard key={bet.id} ep={ep} bet={bet} state={state} />
          ))}
        </ul>
      </DashCard>
    </div>
  );
}
