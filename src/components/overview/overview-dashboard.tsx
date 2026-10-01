"use client";

import type { ReactNode } from "react";
import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { YourTeamCard } from "./your-team-card";
import { LastWeekCard } from "./last-week-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";
import { StartersBoard } from "./starters-board";
import { SeasonResultsCard } from "./season-results-card";
import { NotificationsBanner } from "./notifications-banner";
import { PickEmPickGrid } from "./pickem-pick-grid";
import { ActiveRosterLineupGrid } from "./active-roster-lineup-grid";
import { OverviewCustomizePanel } from "./overview-customize-panel";
import { useOverviewLayout } from "@/lib/use-overview-layout";
import { isOverviewSectionEligible, toOverviewLeagueTypeId, type OverviewSectionId } from "@/lib/overview-layout";
import type { LeagueState } from "@/lib/game/types";

function renderSection(id: OverviewSectionId, state: LeagueState): ReactNode {
  switch (id) {
    case "notifications":
      return <NotificationsBanner />;
    case "sideBets":
      return <SideBetsSection state={state} />;
    case "pickGrid":
      return <PickEmPickGrid state={state} />;
    case "lineupGrid":
      return <ActiveRosterLineupGrid state={state} />;
    case "standings":
      return <StandingsCard state={state} />;
    case "yourTeam":
      return <YourTeamCard state={state} />;
    case "lastWeek":
      return <LastWeekCard state={state} />;
    case "latestEpisode":
      return <LatestEpisodeCard state={state} />;
    case "seasonStatus":
      return <SeasonStatusCard state={state} />;
    case "board":
      // Only ever in the ordered section list when isOverviewSectionEligible already confirmed
      // draftComplete, so no need to re-check it here. BoardGrid owns its own card shell/heading
      // now (previously the one Overview section without one).
      // Active Roster gets "who's starting whom" first, then a compact cast (starters-board.tsx).
      return StateLogic.getLeagueType(state).hasActiveRoster ? <StartersBoard state={state} /> : <BoardGrid state={state} />;
  }
}

// Standings and Latest Episode are both small, so when they're next to each other in the order they
// share a row, half each -- unless the latest episode has more than one person out, whose cards then
// need the full width.
function groupSections(sections: OverviewSectionId[], state: LeagueState): OverviewSectionId[][] {
  const latest = [...state.episodes].filter((ep) => ep.events.length > 0).sort((a, b) => b.number - a.number)[0];
  const latestFitsHalf = !latest || latest.events.length <= 1;
  const pair = new Set<OverviewSectionId>(["standings", "latestEpisode"]);
  const groups: OverviewSectionId[][] = [];
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    if (latestFitsHalf && b && a !== b && pair.has(a) && pair.has(b)) {
      groups.push([a, b]);
      i++;
    } else {
      groups.push([a]);
    }
  }
  return groups;
}

// Direct port of renderOverview() (public/app.js): Notifications banner, Side Bets section, the
// dash-grid of cards, and the post-draft Board grid -- now driven by an ordered, hide-able section
// list (src/lib/overview-layout.ts) rather than a fixed sequence. The order/hidden set itself is an
// APP-WIDE setting (useOverviewLayout, db/migrations/0027_app_settings.sql): a super admin's edits
// in overview-customize-panel.tsx apply to every user's Overview, in every league and in demo mode
// alike, not just their own browser -- see that hook's comment.
//
// Notifications is populated by use-league-poll.ts (mounted once in AuthGate), not by this
// component -- it just reads the resulting list.
export function OverviewDashboard() {
  const state = useLeagueStore((s) => s.state);
  const leagueTypeId = toOverviewLeagueTypeId(StateLogic.getLeagueType(state).id);
  const { order, hidden } = useOverviewLayout(leagueTypeId);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  const sections = order.filter((id) => isOverviewSectionEligible(id, state, draftComplete) && !hidden[id]);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Overview</h2>
      <OverviewCustomizePanel state={state} leagueTypeId={leagueTypeId} draftComplete={draftComplete} />
      {/* Season over: the results announcement leads the page (renders nothing until then). */}
      <SeasonResultsCard state={state} />
      {/* Catch-up mode (StateLogic.RevealLogic): say so here, or the standings look inexplicably
          early to anyone who knows how far the real season has run. Deliberately says nothing about
          how much is left -- see catch-up-panel.tsx. */}
      {StateLogic.RevealLogic.isCatchingUp(state) && !StateLogic.RevealLogic.isComplete(state) && (
        <p className="mb-4 rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-xs">
          Catching up — this league has played through{" "}
          <b>
            {StateLogic.RevealLogic.revealedThrough(state) === 0
              ? "none of the season yet"
              : `episode ${StateLogic.RevealLogic.revealedThrough(state)}`}
          </b>
          . Later episodes stay hidden until the commissioner reveals them.
        </p>
      )}
      <div className="flex flex-col gap-3.5">
        {groupSections(sections, state).map((group) =>
          group.length === 2 ? (
            <div key={group.join("+")} className="grid grid-cols-2 gap-3.5 [&>*]:min-w-0">
              {group.map((id) => (
                <div key={id} className="[&>*]:h-full">
                  {renderSection(id, state)}
                </div>
              ))}
            </div>
          ) : (
            <div key={group[0]}>{renderSection(group[0], state)}</div>
          )
        )}
      </div>
    </>
  );
}
