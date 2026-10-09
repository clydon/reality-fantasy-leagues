"use client";

import type { ReactNode } from "react";
import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { YourLineCard } from "./your-line-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { YourTeamCard } from "./your-team-card";
import { LastWeekCard } from "./last-week-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";
import { StartersBoard } from "./starters-board";
import { TeamsBoard } from "./teams-board";
import { SeasonResultsCard } from "./season-results-card";
import { NotificationsBanner } from "./notifications-banner";
import { PickEmPickGrid } from "./pickem-pick-grid";
import { ActiveRosterLineupGrid } from "./active-roster-lineup-grid";
import { LeagueScoringCard } from "./league-scoring-card";
import { OverviewCustomizePanel } from "./overview-customize-panel";
import { useOverviewLayout } from "@/lib/use-overview-layout";
import { isOverviewSectionEligible, toOverviewLeagueTypeId, type OverviewSectionId } from "@/lib/overview-layout";
import type { LeagueState } from "@/lib/game/types";

function renderSection(id: OverviewSectionId, state: LeagueState): ReactNode {
  switch (id) {
    case "leagueScoring":
      return <LeagueScoringCard state={state} />;
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
    case "yourLine":
      return <YourLineCard state={state} />;
    case "seasonStatus":
      return <SeasonStatusCard state={state} />;
    case "board":
      // Only ever in the ordered section list when isOverviewSectionEligible already confirmed
      // draftComplete, so no need to re-check it here. BoardGrid owns its own card shell/heading
      // now (previously the one Overview section without one).
      // Active Roster gets "who's starting whom" first, then a compact cast (starters-board.tsx);
      // Classic the same shape with each team (teams-board.tsx). Eliminator Pool's equivalent
      // status/nudge section lives on the pick grid itself (pickem-pick-grid.tsx), not here.
      {
        const lt = StateLogic.getLeagueType(state);
        if (lt.hasActiveRoster) return <StartersBoard state={state} />;
        return lt.hasRoster ? <TeamsBoard state={state} /> : <BoardGrid state={state} />;
      }
  }
}

// Standings and Latest Episode are both small, so when they're next to each other in the order they
// share a row, half each -- unless the latest episode has more than one person out, whose cards then
// need the full width. Active Roster's Latest Episode lists every team's week, so it always does.
function groupSections(sections: OverviewSectionId[], state: LeagueState): OverviewSectionId[][] {
  const lt = StateLogic.getLeagueType(state);
  const latest = [...state.episodes].filter((ep) => ep.events.length > 0).sort((a, b) => b.number - a.number)[0];
  const latestFitsHalf = !(lt.hasActiveRoster && !lt.hasWeeklyPicks) && (!latest || latest.events.length <= 1);
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
  const { order, hidden, isLoading: layoutLoading } = useOverviewLayout(leagueTypeId);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  // Hold the cards back until the saved layout is in, rather than flashing the default order and
  // reordering (normally already cached by AuthGate's boot prefetch; this covers the demo path).
  const sections = layoutLoading ? [] : order.filter((id) => isOverviewSectionEligible(id, state, draftComplete) && !hidden[id]);

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
            // A section with nothing to show renders null: its wrapper collapses (empty:hidden) instead
            // of leaving a blank flex item that doubles the gap. Cards carry no outer margin of their
            // own -- this column's gap is the only spacing between them, and the wrapper's gap spaces
            // a section that renders two blocks (e.g. the pick grid's "reveal first" + locked picks).
            <div key={group[0]} className="flex flex-col gap-3.5 empty:hidden">
              {renderSection(group[0], state)}
            </div>
          )
        )}
      </div>
    </>
  );
}
