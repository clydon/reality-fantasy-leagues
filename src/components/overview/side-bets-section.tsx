"use client";

import type { LeagueState } from "@/lib/game/types";
import { getActiveBets } from "@/lib/game/selectors";
import { useCanGuess, useMyPlayerId } from "@/lib/store";
import { BetCard } from "./bet-card";
import { Badge } from "@/components/ui/badge";

// The league's open predictions (docs/PLAN-ux-declutter.md): only when there are some -- an empty
// section renders nothing. New ones are proposed on the upcoming episode's own page
// (episode-detail.tsx), where they belong; how they went is on each episode's page too.
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="section-title">
          Predictions{" "}
          {needsCount > 0 && (
            <Badge className="ml-1 normal-case">
              {needsCount} need{needsCount === 1 ? "s" : ""} you
            </Badge>
          )}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ ep, bet }) => (
          <BetCard key={bet.id} ep={ep} bet={bet} state={state} />
        ))}
      </div>
    </div>
  );
}
