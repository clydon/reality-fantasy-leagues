"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { signed } from "@/lib/game/lineup-view";
import { CaptionPlate } from "@/components/ui/caption-plate";

// Active Roster only -- "what did I score last week," the thing a fantasy-football dashboard always
// leads with, as a caption plate (the canvas's AR-Home). "Last week" is the most recently PLAYED
// episode (StateLogic.episodeHasResults) this viewer has revealed -- state here is spoiler-trimmed.
// Only your own lineup's events count, same rule the real score does (a benched castaway's events
// never were yours). The breakdown is a tap away: Recap opens that episode's page.
export function LastWeekCard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const terms = useShowTerms();
  const leagueType = StateLogic.getLeagueType(state);

  if (!myPlayerId || !leagueType.hasActiveRoster) return null;

  const lastEp = [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number)[0];
  if (!lastEp) return null;

  const lineup = new Set(StateLogic.activeRosterLineupFor(state, lastEp.id, myPlayerId));
  const allEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, lastEp);
  const myEvents = allEvents.filter((ev) => lineup.has(ev.castawayId));
  const pts = (evs: typeof allEvents) =>
    StateLogic.roundPoints(evs.reduce((sum, ev) => sum + StateLogic.ActiveRosterLogic.pointsFor(state, ev.type), 0));
  const total = pts(myEvents);
  // What your bench did that week: castaways you own who weren't in that episode's lineup. Ownership
  // is today's (a swap since then can shift it), which is fine for a "you left this on the bench" nudge.
  const mine = new Set(state.castaways.filter((c) => (c.ownerIds || []).includes(myPlayerId)).map((c) => c.id));
  const benchPts = pts(allEvents.filter((ev) => mine.has(ev.castawayId) && !lineup.has(ev.castawayId)));

  return (
    <CaptionPlate
      tag={`Ep ${lastEp.number}`}
      tone="good"
      size="sm"
      title={`${signed(total)} last week`}
      subtitle={
        benchPts > 0
          ? `${benchPts} more ${benchPts === 1 ? "point" : "points"} sat on your bench`
          : myEvents.length === 0
            ? "Nothing from your lineup scored"
            : `From your ${terms.castaways} in the lineup`
      }
      href={`/episodes/${lastEp.number}`}
      action="Recap"
    />
  );
}
