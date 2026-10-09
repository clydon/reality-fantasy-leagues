"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { DashCard } from "./dash-card";
import { CaptionPlate } from "@/components/ui/caption-plate";

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
  const allEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, lastEp);
  const myEvents = allEvents.filter((ev) => lineup.has(ev.castawayId));
  const pts = (evs: typeof allEvents) =>
    StateLogic.roundPoints(evs.reduce((sum, ev) => sum + StateLogic.ActiveRosterLogic.pointsFor(state, ev.type), 0));
  const total = pts(myEvents);
  // What your bench did that week: castaways you own who weren't in that episode's lineup. Ownership
  // is today's (a swap since then can shift it), which is fine for a "you left this on the bench" nudge.
  const mine = new Set(state.castaways.filter((c) => (c.ownerIds || []).includes(myPlayerId)).map((c) => c.id));
  const benchPts = pts(allEvents.filter((ev) => mine.has(ev.castawayId) && !lineup.has(ev.castawayId)));
  const events = StateLogic.formatOf(state).events;

  // Direction A: last week's score is a caption plate -- the moment, at a glance -- with the
  // breakdown underneath for anyone who wants it.
  return (
    <section className="flex flex-col gap-2.5">
      <CaptionPlate
        tag={`Ep ${lastEp.number}`}
        tone="good"
        title={`${signed(total)} last week`}
        subtitle={
          benchPts > 0
            ? `${benchPts} more ${benchPts === 1 ? "point" : "points"} sat on your bench`
            : myEvents.length === 0
              ? "Nothing from your lineup scored"
              : `From your ${terms.castaways} in the lineup`
        }
        href="/scoreboard"
        action="Recap"
      />
      {myEvents.length > 0 && (
        <div className="flex flex-col">
          {myEvents.map((ev) => {
            const def = events.find((e) => e.id === ev.type);
            const c = StateLogic.getCastaway(state, ev.castawayId);
            return (
              <div key={ev.id} className="flex min-h-10 items-center justify-between gap-2 border-t border-border text-sm first:border-t-0">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{c?.name ?? "?"}</span> <span className="text-muted-foreground">· {def?.label ?? ev.type}</span>
                </span>
                <span className="type-num text-[18px]">{signed(StateLogic.ActiveRosterLogic.pointsFor(state, ev.type))}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// "+2" / "-3" / "0" for a points value that can be negative.
function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
