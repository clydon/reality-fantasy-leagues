import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

// Catalog of Overview's reorderable/hideable sections -- see overview-layout-store.ts for where a
// super admin's chosen order/hidden set is persisted, and overview-dashboard.tsx for where it's
// applied. `eligible` is separate from `hidden`: eligibility is what the CURRENT league actually has
// (no point offering "Weekly Pick" to a Classic Draft league), while hidden is the admin's own choice
// among whatever's eligible.
export type OverviewSectionId =
  | "notifications"
  | "sideBets"
  | "pickGrid"
  | "lineupGrid"
  | "standings"
  | "yourTeam"
  | "lastWeek"
  | "latestEpisode"
  | "seasonStatus"
  | "board";

export const OVERVIEW_SECTION_LABELS: Record<OverviewSectionId, string> = {
  notifications: "Notifications",
  sideBets: "Side Bets",
  pickGrid: "Weekly Pick (Eliminator Pool)",
  lineupGrid: "Set Lineup (Active Roster)",
  standings: "Standings",
  yourTeam: "Your Team",
  lastWeek: "Last Week (Active Roster)",
  latestEpisode: "Latest Episode",
  seasonStatus: "Season Status",
  board: "Board",
};

export const DEFAULT_OVERVIEW_ORDER: OverviewSectionId[] = [
  "notifications",
  "sideBets",
  "pickGrid",
  "lineupGrid",
  "standings",
  "yourTeam",
  "lastWeek",
  "latestEpisode",
  "seasonStatus",
  "board",
];

// Whether a section applies at all to this league right now -- independent of the admin's own
// hidden/order choices. A section the league doesn't have (Weekly Pick for a Classic Draft league)
// is never offered in the customize panel and never rendered, no matter what's saved.
export function isOverviewSectionEligible(id: OverviewSectionId, state: LeagueState, draftComplete: boolean): boolean {
  const leagueType = StateLogic.getLeagueType(state);
  switch (id) {
    case "pickGrid":
      return leagueType.hasWeeklyPicks;
    case "lineupGrid":
    case "lastWeek":
      return leagueType.hasActiveRoster;
    case "board":
      return draftComplete;
    default:
      return true;
  }
}
