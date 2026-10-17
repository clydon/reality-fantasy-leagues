import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { actionItems } from "@/lib/game/action-items.js";

// The league's tabs (docs/PLAN-league-tabs.md): the same six in every game, in episode-night order --
// Overview · Episodes · Scoreboard · [slot 4] · Research · More. Slot 4 is "your play", named for the
// game and its phase. One place says what it is, so the phone's tab bar, the desktop sidebar, the
// back links and the league swipe agree.

export type SlotKey = "draft" | "team" | "lineup" | "pick";
export interface SlotFour {
  key: SlotKey;
  href: string;
  label: string;
}

/** Slot 4: Draft until the draft's done (roster games), then Team (Classic) or Lineup (Active Roster);
 *  Pick for Eliminator Pool, which has no draft. */
export function slotFour(state: LeagueState): SlotFour {
  const type = StateLogic.getLeagueType(state);
  if (type.hasWeeklyPicks || !type.hasRoster) return { key: "pick", href: "/pick", label: "Pick" };
  const turn = StateLogic.currentDraftTurn(state);
  if (!(turn && turn.isComplete)) return { key: "draft", href: "/draft", label: "Draft" };
  return type.hasActiveRoster ? { key: "lineup", href: "/lineup", label: "Lineup" } : { key: "team", href: "/team", label: "Team" };
}

/** The pages that are some game's slot 4 after its draft: one tab, different names by game. */
export const SLOT_PAGES = ["/team", "/lineup", "/pick"];

/** Where `pathname` lands in another game of the linked group (the league swipe and the league strip):
 *  the same tab. Slot 4 is the other game's own; Waivers falls back to the slot it sits on; a page about
 *  one league's things (a player's scores, a settings page, a claim) goes up to its tab; anything the
 *  other game doesn't have goes to Overview. */
export function samePageIn(pathname: string, from: LeagueState, to: LeagueState): string {
  const slot = slotFour(to);
  if (pathname === slotFour(from).href || SLOT_PAGES.includes(pathname)) return slot.href;
  if (pathname.startsWith("/draft")) return StateLogic.getLeagueType(to).hasRoster ? pathname : "/";
  if (/^\/(research\/)?waivers(\/|$)/.test(pathname)) return StateLogic.WaiverLogic.enabled(to) ? "/waivers" : slot.href;
  if (pathname.startsWith("/scoreboard/")) return "/scoreboard";
  if (pathname.startsWith("/setup/")) return "/setup";
  return pathname;
}

// The to-dos each tab owns, from the same list the alert strip shows (action-items.js), so a tab's
// "!" and the strip never disagree.
const SLOT_KINDS = new Set(["draftTurn", "blindDraft", "lineup", "pick", "pickup"]);

/** Your moves due in this game that live on slot 4: a draft turn, a lineup slot open, a pick not made,
 *  someone to replace. Read from the full state (due is due whether or not you've looked), with the
 *  viewer's reveal mark so nothing spoils. */
export function slotDue(fullState: LeagueState, me: string | null, seenThrough: number | null): boolean {
  if (!me) return false;
  return actionItems(fullState, me, seenThrough).some((it: { kind: string }) => SLOT_KINDS.has(it.kind));
}

/** The commissioner's results job, which lives on Episodes. */
export function episodesDue(fullState: LeagueState, me: string | null, commissioner: boolean): boolean {
  if (!me || !commissioner) return false;
  return actionItems(fullState, me, null, { commissioner: true }).some((it: { kind: string }) => it.kind === "results");
}
