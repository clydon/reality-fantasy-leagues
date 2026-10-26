import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

export interface CommissionerItem {
  id: string;
  title: string;
  detail: string;
  /** The link's label ("Schedule", "Start"). */
  action: string;
  href: string;
}

// What's waiting on the commissioner in this league (docs/PLAN-ux-declutter.md, decision 4). They're
// Overview's control room (overview/up-next.tsx, with every other league you run's, via
// /api/me/actions); each also puts a chyron dot on the League Settings row that fixes it (setup-tab.tsx). Only things nobody else can
// do: a player's own turns and picks are the alert strip's (action-items.js). Read from the viewer's
// trimmed state, so nothing here hints at results the commissioner hasn't revealed yet. Pending
// invites aren't a to-do: they're the Players & invites row's value.
export function commissionerItems(state: LeagueState): CommissionerItem[] {
  const type = StateLogic.getLeagueType(state);
  const items: CommissionerItem[] = [];
  // An archived game (step 10 part 2b) has nothing left to set up.
  if (state.settings.archivedAt) return items;

  // Weekly Calls and Weekly Bingo (step 12) play without a cast: nothing to add.
  if (state.castaways.length === 0 && !StateLogic.isDraftStarted(state) && !type.hasCalls && !type.hasBingo) {
    items.push({
      id: "cast",
      title: "Add the cast",
      detail: "Import it from an AI chat's answer, or wait for the season's cast to be approved",
      action: "Add",
      href: "/setup/cast",
    });
  }

  if (type.hasRoster && !StateLogic.isDraftStarted(state)) {
    const n = state.players.length;
    if (n < 2) {
      items.push({
        id: "players",
        title: "Invite players",
        detail: n === 1 ? "You're the only one in the league so far" : "Nobody's in the league yet",
        action: "Invite",
        href: "/setup/players",
      });
    }
    if (!state.settings.draftScheduledAt) {
      items.push({
        id: "draft",
        title: "Draft not scheduled",
        detail: "Pick a time, or start it yourself from Draft",
        action: "Schedule",
        href: "/setup/teams",
      });
    }
  }

  // Catch-up: revealing the next episode is the commissioner's weekly job. Deliberately says nothing
  // about whether its results are in yet (catch-up-panel.tsx explains why).
  const R = StateLogic.RevealLogic;
  if (R.isCatchingUp(state) && !R.isComplete(state)) {
    items.push({
      id: "reveal",
      title: `Episode ${R.nextEpisode(state)} is next`,
      detail: "Reveal it once everyone has watched",
      action: "Reveal",
      href: "/episodes",
    });
  }

  return items;
}
