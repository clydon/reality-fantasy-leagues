"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { DashCard, DashBig } from "./dash-card";

// Active Roster only -- "what did I score last week," the thing a fantasy-football dashboard always
// leads with. "Last week" is the most recently PLAYED episode (StateLogic.episodeHasResults), not
// just the highest episode number -- an episode that exists but hasn't aired/been logged yet isn't
// "last week," it's "not yet." Only your own active lineup's events count, same rule the real score
// does (a benched castaway's events never were yours to begin with).
export function LastWeekCard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const terms = useShowTerms();
  const leagueType = StateLogic.getLeagueType(state);

  if (!myPlayerId || !leagueType.hasActiveRoster) return null;

  const played = [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number);
  const lastEp = played[0];

  if (!lastEp) {
    return (
      <DashCard title="Last Week">
        <p className="text-sm text-muted-foreground">No episodes played yet.</p>
      </DashCard>
    );
  }

  const lineup = new Set(StateLogic.activeRosterLineupFor(state, lastEp.id, myPlayerId));
  const myEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, lastEp).filter((ev) => lineup.has(ev.castawayId));
  const total = StateLogic.roundPoints(myEvents.reduce((sum, ev) => sum + StateLogic.ActiveRosterLogic.pointsFor(state, ev.type), 0));
  const events = StateLogic.formatOf(state).events;

  return (
    <DashCard title="Last Week">
      <DashBig>
        {total}
        <span className="ml-1 text-base text-muted-foreground"> pts · Episode {lastEp.number}</span>
      </DashBig>
      {myEvents.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">Nothing from your lineup scored.</p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1">
          {myEvents.map((ev) => {
            const def = events.find((e) => e.id === ev.type);
            const c = StateLogic.getCastaway(state, ev.castawayId);
            return (
              <div key={ev.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex-1">
                  {c?.name ?? "?"} — <span className="text-muted-foreground">{def?.label ?? ev.type}</span>
                </span>
                <span className="font-mono text-xs">{signed(StateLogic.ActiveRosterLogic.pointsFor(state, ev.type))}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
        Only {terms.castaways} in your active lineup that episode count.
      </p>
    </DashCard>
  );
}

// "+2" / "-3" / "0" for a points value that can be negative.
function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
