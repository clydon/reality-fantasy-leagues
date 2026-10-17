"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { YourTeamCard } from "@/components/overview/your-team-card";
import { LineupPage } from "@/components/lineup/lineup-page";
import { PickPage } from "@/components/pick/pick-page";
import { TeamWaiverBanner, TeamWaiversSection } from "@/components/waivers/team-waivers";

// Slot 4 (docs/PLAN-league-tabs.md): one tab, named for the game -- Team (Classic), Lineup (Active
// Roster), Pick (Eliminator Pool). /team, /lineup and /pick each draw whichever this league has, so a
// linked group's swipe shows the neighbour's own slot 4 while it peeks (league-swipe.tsx then moves
// the address to that page's name).
export function SlotPage() {
  const state = useLeagueStore((s) => s.state);
  const type = StateLogic.getLeagueType(state);
  if (type.hasWeeklyPicks || !type.hasRoster) return <PickPage />;
  if (type.hasActiveRoster) return <LineupWithWaivers />;
  return <TeamPage />;
}

// Team (Classic): finally a page of its own (its team was only a section of Overview). Waivers' banner,
// your team, then Waivers. With waivers off it's just your team.
function TeamPage() {
  const state = useLeagueStore((s) => s.state);
  return (
    <div className="flex flex-col gap-[26px]">
      <h2 className="type-caption -mb-3 text-[28px] max-nav:hidden">Team</h2>
      <TeamWaiverBanner />
      <YourTeamCard state={state} />
      <TeamWaiversSection />
    </div>
  );
}

// Lineup (Active Roster): today's page, unchanged, between the same banner and Waivers section.
function LineupWithWaivers() {
  return (
    <div className="flex flex-col gap-[26px]">
      <TeamWaiverBanner />
      <LineupPage />
      <TeamWaiversSection />
    </div>
  );
}
