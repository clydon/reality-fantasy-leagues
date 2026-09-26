"use client";

import type { ReactNode } from "react";
import { useLeagueStore, useIsSuperAdmin } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { YourTeamCard } from "./your-team-card";
import { LastWeekCard } from "./last-week-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";
import { NotificationsBanner } from "./notifications-banner";
import { PickEmPickGrid } from "./pickem-pick-grid";
import { ActiveRosterLineupGrid } from "./active-roster-lineup-grid";
import { OverviewCustomizePanel } from "./overview-customize-panel";
import { useOverviewLayoutStore } from "@/lib/overview-layout-store";
import { DEFAULT_OVERVIEW_ORDER, isOverviewSectionEligible, type OverviewSectionId } from "@/lib/overview-layout";
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
      // draftComplete, so no need to re-check it here.
      return (
        <div id="board">
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Board</h3>
          <BoardGrid state={state} />
        </div>
      );
  }
}

// Direct port of renderOverview() (public/app.js): Notifications banner, Side Bets section, the
// dash-grid of cards, and the post-draft Board grid -- now driven by an ordered, hide-able section
// list (src/lib/overview-layout.ts) rather than a fixed sequence, so a super admin can reorder/hide
// them to try out layouts (see overview-customize-panel.tsx) without a code change per attempt.
// Everyone else always gets DEFAULT_OVERVIEW_ORDER with nothing hidden -- a super admin's saved
// choices are a personal, client-side preference (localStorage), not something that changes what any
// other user, real or demo, ever sees.
//
// Notifications is populated by use-league-poll.ts (mounted once in AuthGate), not by this
// component -- it just reads the resulting list.
export function OverviewDashboard() {
  const state = useLeagueStore((s) => s.state);
  const isSuperAdmin = useIsSuperAdmin();
  const { order, hidden } = useOverviewLayoutStore();
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  const effectiveOrder = isSuperAdmin ? order : DEFAULT_OVERVIEW_ORDER;
  const effectiveHidden = isSuperAdmin ? hidden : {};
  const sections = effectiveOrder.filter(
    (id) => isOverviewSectionEligible(id, state, draftComplete) && !effectiveHidden[id]
  );

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Overview</h2>
      <OverviewCustomizePanel state={state} draftComplete={draftComplete} />
      {/* Catch-up mode (StateLogic.RevealLogic): say so here, or the standings look inexplicably
          early to anyone who knows how far the real season has run. Deliberately says nothing about
          how much is left -- see catch-up-panel.tsx. */}
      {StateLogic.RevealLogic.isCatchingUp(state) && (
        <p className="mb-4 rounded-md border border-primary/30 bg-[#fbeee8] px-3 py-1.5 text-xs">
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
        {sections.map((id) => (
          <div key={id}>{renderSection(id, state)}</div>
        ))}
      </div>
    </>
  );
}
