import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

// Catalog of Overview's reorderable/hideable sections -- see overview-layout-store.ts for where a
// super admin's chosen order/hidden set is persisted, and overview-dashboard.tsx for where it's
// applied. `eligible` is separate from `hidden`: eligibility is what the CURRENT league actually has
// (no point offering "Weekly Pick" to a Classic Draft league), while hidden is the admin's own choice
// among whatever's eligible.
export type OverviewSectionId =
  | "leagueScoring"
  | "notifications"
  | "sideBets"
  | "pickGrid"
  | "lineupGrid"
  | "standings"
  | "yourTeam"
  | "lastWeek"
  | "latestEpisode"
  | "yourLine"
  | "seasonStatus"
  | "board";

export const OVERVIEW_SECTION_LABELS: Record<OverviewSectionId, string> = {
  leagueScoring: "League Scoring (Active Roster)",
  notifications: "Notifications",
  sideBets: "Predictions",
  pickGrid: "Weekly Pick (Eliminator Pool)",
  lineupGrid: "Set Lineup (Active Roster)",
  standings: "Standings",
  yourTeam: "Your Team (Your Stats in Active Roster)",
  lastWeek: "Last Week (Active Roster)",
  latestEpisode: "Latest Episode",
  yourLine: "Your Episode Line (Active Roster)",
  seasonStatus: "Season Status",
  board: "Board",
};

// The 3 real (and demo) league types -- same ids as state-logic.js's LEAGUE_TYPES and
// demo-season-builder.ts's DemoLeagueTypeId. A super admin's Overview layout is stored ONE PER
// TYPE (see use-overview-layout.ts): Eliminator Pool has no roster at all, Active Roster wants
// Last Week/Set Lineup, Classic Draft wants neither -- a single shared layout couldn't fit all
// three without either hiding sections that don't apply everywhere, or an admin's Active-Roster
// tuning quietly reordering Classic Draft leagues too.
export const OVERVIEW_LEAGUE_TYPE_IDS = ["classic-draft", "active-roster", "pickem"] as const;
export type OverviewLeagueTypeId = (typeof OVERVIEW_LEAGUE_TYPE_IDS)[number];

// StateLogic.getLeagueType(state).id is a plain string (the registry is open-ended in principle),
// but every id that registry has ever actually held is one of the 3 above -- this narrows for
// useOverviewLayout's sake, falling back to classic-draft only if that were ever to change.
export function toOverviewLeagueTypeId(id: string): OverviewLeagueTypeId {
  return (OVERVIEW_LEAGUE_TYPE_IDS as readonly string[]).includes(id) ? (id as OverviewLeagueTypeId) : "classic-draft";
}

export const DEFAULT_OVERVIEW_ORDER: OverviewSectionId[] = [
  "leagueScoring",
  "notifications",
  "sideBets",
  "pickGrid",
  "lineupGrid",
  "standings",
  "yourTeam",
  "lastWeek",
  "latestEpisode",
  "yourLine",
  "seasonStatus",
  "board",
];

/**
 * A saved order, plus any section added to the app since it was saved -- otherwise a new section
 * would never show for a league type whose layout an admin had already customized. Each one goes
 * right after the section it follows by default (or first, if none of those are there).
 */
export function withNewSections(saved: OverviewSectionId[]): OverviewSectionId[] {
  const order = [...saved];
  DEFAULT_OVERVIEW_ORDER.forEach((id, i) => {
    if (order.includes(id)) return;
    const before = DEFAULT_OVERVIEW_ORDER.slice(0, i).reverse().find((prev) => order.includes(prev));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  return order;
}

// Whether a section applies at all to this league right now -- independent of the admin's own
// hidden/order choices. A section the league doesn't have (Weekly Pick for a Classic Draft league)
// is never offered in the customize panel and never rendered, no matter what's saved.
export function isOverviewSectionEligible(id: OverviewSectionId, state: LeagueState, draftComplete: boolean): boolean {
  const leagueType = StateLogic.getLeagueType(state);
  switch (id) {
    case "pickGrid":
      return leagueType.hasWeeklyPicks;
    case "lineupGrid":
      return leagueType.hasActiveRoster;
    case "leagueScoring":
      return leagueType.hasActiveRoster && !leagueType.hasWeeklyPicks;
    // The commissioner writes these from the Active Roster Scoreboard.
    case "yourLine":
      return leagueType.hasActiveRoster && !leagueType.hasWeeklyPicks;
    // Folded into Your Team's "Last week" view; kept as an id so saved layouts that list it still load.
    case "lastWeek":
      return false;
    case "board":
      return draftComplete;
    default:
      return true;
  }
}

// The same rules as isOverviewSectionEligible, answered for a league TYPE rather than one league --
// for Admin's layout editor, which has no league in hand. Assumes a finished draft, so the Board
// (which only appears once the draft is done) is offered for ordering too.
export function isOverviewSectionForType(id: OverviewSectionId, typeId: OverviewLeagueTypeId): boolean {
  const activeRoster = typeId === "active-roster";
  const picks = typeId === "pickem";
  switch (id) {
    case "pickGrid":
      return picks;
    case "lineupGrid":
      return activeRoster;
    case "leagueScoring":
    case "yourLine":
      return activeRoster;
    case "lastWeek":
      return false;
    default:
      return true;
  }
}
