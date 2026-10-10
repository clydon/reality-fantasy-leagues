"use client";

import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { finishedPlace, ordinal } from "@/components/scoreboard/scoreboard-tab";
import { teamOrder } from "@/lib/game/classic-view";
import { isKnockedOut } from "@/lib/game/selectors";
import { cn } from "cn";
import { DashCard } from "./dash-card";

// Second card on Overview, right after Standings -- "what do I personally have in this league,
// right now." Shape depends on the league type, same way the rest of Overview already branches:
//   classic-draft   -- your team as name plates (the canvas's Classic Home): who's still in, and
//                      for each one out, when they went, where they finished and what they banked.
// Active Roster doesn't show it (overview-layout.ts): its lineup is "Starting this week", last week is
// a caption plate, and the season detail is on your Scoreboard page. Nor does Eliminator Pool, which
// has no team: its picks are the pick section (pickem-pick-grid.tsx).
export function YourTeamCard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const terms = useShowTerms();
  const leagueType = StateLogic.getLeagueType(state);

  if (!myPlayerId) return null;

  if (!leagueType.hasRoster || leagueType.hasActiveRoster || leagueType.hasWeeklyPicks) return null;

  const roster = teamOrder(state.castaways.filter((c) => c.ownerIds.includes(myPlayerId)));

  return (
    <DashCard title="Your Team" wide>
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&rsquo;t drafted any {terms.castaways} yet.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {roster.map((c) => (
            <TeamPlate key={c.id} state={state} c={c} />
          ))}
        </div>
      )}
    </DashCard>
  );
}

// One castaway as a name plate: photo, then a white plate with the name and where they stand. Someone
// who's out drops to a dark plate with a greyed photo, so the ones still playing for you stand out.
function TeamPlate({ state, c }: { state: LeagueState; c: Castaway }) {
  const winner = StateLogic.formatOf(state).winnerExitMethod;
  const tribe = state.tribes.find((t) => t.id === c.tribeId);
  const knocked = isKnockedOut(state, c);
  const ep = c.exitEpisodeId ? state.episodes.find((e) => e.id === c.exitEpisodeId)?.number : undefined;
  const place = finishedPlace(state, c);
  const chip = (cls: string, text: string, style?: React.CSSProperties) => (
    <span className={cn("shrink-0 rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide", cls)} style={style}>
      {text}
    </span>
  );
  let detail: React.ReactNode;
  if (c.status !== "eliminated") {
    detail = (
      <>
        {tribe && chip("text-white", tribe.name, { background: tribe.color })}
        Still in
      </>
    );
  } else if (!knocked) {
    // The winner and the other finalists: an ending, not a boot.
    detail = (
      <>
        {chip(c.exitMethod === winner ? "bg-chyron text-chyron-foreground" : "bg-good text-good-foreground", c.exitMethod ?? "Finalist")}
        {[place && `finished ${ordinal(place)}`, c.placementOrder && `+${c.placementOrder}`].filter(Boolean).join(" · ")}
      </>
    );
  } else {
    detail = (
      <>
        {chip("bg-live text-live-foreground", "Out")}
        <span className="truncate">
          {[ep && `Episode ${ep}`, place && `finished ${ordinal(place)}`, c.placementOrder && `+${c.placementOrder}`].filter(Boolean).join(" · ")}
        </span>
      </>
    );
  }
  return (
    <div className="flex h-[60px] items-stretch overflow-hidden rounded-[3px]">
      <CastawayAvatar
        castaway={c}
        expandable
        className={cn(
          "flex w-[54px] shrink-0 items-center justify-center bg-secondary text-xs font-bold text-muted-foreground [&_img]:object-top",
          knocked && "grayscale brightness-[.7]",
        )}
      />
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center gap-[3px] px-3",
          knocked ? "bg-muted text-muted-foreground" : "bg-plate text-plate-foreground",
        )}
      >
        <span className={cn("type-caption truncate text-[21px]", knocked && "text-foreground/80")}>{c.name}</span>
        <span className={cn("flex min-w-0 items-center gap-1.5 text-[12px]", knocked ? "text-muted-foreground" : "text-plate-muted")}>{detail}</span>
      </span>
    </div>
  );
}
