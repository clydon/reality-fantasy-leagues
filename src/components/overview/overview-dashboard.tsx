"use client";

import { useLeagueStore } from "@/lib/store";
import { LatestEpisodeCard } from "./latest-episode-card";
import { SeasonStatusCard } from "./season-status-card";
import { StandingsCard } from "./standings-card";

// Direct port of renderOverview()'s dash-grid section (public/app.js) -- Notifications banner,
// Side Bets section, and the post-draft Board grid are deliberately NOT ported in this POC;
// they're each their own significant chunk of interactive state and belong to a later pass once
// this card-grid approach is validated. See docs/HANDOFF.md in the live repo for the ARCHITECTURE
// Phase 1 rationale (Overview chosen as the single validation tab).
export function OverviewDashboard() {
  const state = useLeagueStore((s) => s.state);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Overview</h2>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <LatestEpisodeCard state={state} />
        <SeasonStatusCard state={state} />
        <StandingsCard state={state} />
      </div>
    </div>
  );
}
