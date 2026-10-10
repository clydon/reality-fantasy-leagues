"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { DashCard, DashLink } from "./dash-card";

// Second card on Overview, right after Standings -- "what do I personally have in this league,
// right now." Shape depends on the league type, same way the rest of Overview already branches:
//   pickem          -- no roster at all, so this is just your current weekly pick, one line.
//   classic-draft   -- your drafted roster as plain photo cards (boot-order badge still shows --
//                      that's this type's actual score).
// Active Roster doesn't show it (overview-layout.ts): its lineup is "Starting this week", last week is
// a caption plate, and the season detail is on your Scoreboard page.
export function YourTeamCard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const terms = useShowTerms();
  const leagueType = StateLogic.getLeagueType(state);

  if (!myPlayerId) return null;

  if (leagueType.hasWeeklyPicks) {
    const ep = StateLogic.pickEmUpcomingEpisode(state);
    const myPick = ep ? StateLogic.pickEmPickFor(state, ep.id, myPlayerId) : null;
    const pickedName = myPick ? StateLogic.getCastaway(state, myPick.castawayId)?.name : null;
    return (
      <DashCard title="Your Pick" wide>
        <p className="text-sm">
          {ep ? (
            <>
              Your Episode {ep.number} Pick to Survive: <b>{pickedName ?? "Not picked yet"}</b>
            </>
          ) : (
            "There's no episode to pick for yet."
          )}
        </p>
        <DashLink href="#pickem-grid">Change your pick ↓</DashLink>
      </DashCard>
    );
  }

  if (!leagueType.hasRoster || leagueType.hasActiveRoster) return null;

  const roster = state.castaways.filter((c) => c.ownerIds.includes(myPlayerId));

  return (
    <DashCard title="Your Team" wide>
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&rsquo;t drafted any {terms.castaways} yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          {roster.map((c) => (
            <CastawayStatCard key={c.id} state={state} castaway={c} showOwner={false} showPoints={false} dimAllEliminated expanded />
          ))}
        </div>
      )}
    </DashCard>
  );
}
