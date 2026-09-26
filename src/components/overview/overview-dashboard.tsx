"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";
import { YourTeamCard } from "./your-team-card";
import { SideBetsSection } from "./side-bets-section";
import { BoardGrid } from "./board-grid";
import { NotificationsBanner } from "./notifications-banner";
import { PickEmPickGrid } from "./pickem-pick-grid";
import { ActiveRosterLineupGrid } from "./active-roster-lineup-grid";

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
      {StateLogic.getLeagueType(state).hasWeeklyPicks && <PickEmPickGrid state={state} />}
      {StateLogic.getLeagueType(state).hasActiveRoster && <ActiveRosterLineupGrid state={state} />}
      <NotificationsBanner />
      <SideBetsSection state={state} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StandingsCard state={state} />
        <YourTeamCard state={state} />
        <LatestEpisodeCard state={state} />
        <SeasonStatusCard state={state} />
      </div>
      {draftComplete && (
        <div id="board" className="mt-6">
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Board</h3>
          <BoardGrid state={state} />
        </div>
      )}
    </>
  );
}
