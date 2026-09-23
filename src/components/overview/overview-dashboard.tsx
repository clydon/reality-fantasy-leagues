"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";
import { NotificationsBanner } from "./notifications-banner";

// Direct port of renderOverview() (public/app.js): Notifications banner, Side Bets section, the
// dash-grid of three cards, and the post-draft Board grid, in the same order as the original.
// Notifications is populated by use-league-poll.ts (mounted once in AuthGate), not by this
// component -- it just reads the resulting list.
export function OverviewDashboard() {
  const state = useLeagueStore((s) => s.state);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Overview</h2>
      <NotificationsBanner />
      <SideBetsSection state={state} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <LatestEpisodeCard state={state} />
        <SeasonStatusCard state={state} />
        <StandingsCard state={state} />
      </div>
      {draftComplete && (
        <div className="mt-6">
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Board</h3>
          <BoardGrid state={state} />
        </div>
      )}
    </>
  );
}
