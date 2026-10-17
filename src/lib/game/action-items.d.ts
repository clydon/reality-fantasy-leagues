// Types for action-items.js (plain CommonJS so db/reminders.js can require it under bare node).
import type { Episode, LeagueState } from "./types";

export type ActionKind = "notifications" | "invite" | "lateJoin" | "draftTurn" | "blindDraft" | "lineup" | "pick" | "prediction" | "results" | "pickup";

export interface ActionItem {
  kind: ActionKind;
  /** Short, imperative: what to do. The league's name is shown alongside it, not in it. */
  text: string;
  /** Where doing it happens, within the league. Hash targets an Overview section. */
  href: string;
  /** Weekly items (lineup, pick, prediction, results): the episode number it's for. */
  episode?: number;
  /** "pickup": the deadline (ISO), shown in the viewer's own time ("by Tue 8 PM"); null when there's none. */
  by?: string | null;
  /** When it's due (ISO): a lineup or pick locks at air time, a claim at its deadline, a guess before the
   *  episode airs. Null for "now" (a draft turn, results) or when nothing says. From actionItems only. */
  deadline?: string | null;
  /** Whose job: "you" (your own move, Up next) or "commish" (the league's results, the control room). From actionItems only. */
  who?: "you" | "commish";
  /** "pickup": a few words after the league's name ("claim up to 3"). */
  detail?: string;
  /** "invite" only (from /api/me/actions, not actionItems): which invite, and who sent it. */
  inviteId?: string;
  invitedBy?: string | null;
}

/** `seenThrough`: the player's results-seen mark, which a late joiner catching up needs for their own week's alerts. */
/** `opts.commissioner`: add the commissioner's own to-do, an aired episode's results to fill in. */
export function actionItems(
  state: LeagueState,
  playerId: string,
  seenThrough?: number | null,
  opts?: { commissioner?: boolean; now?: number }
): ActionItem[];

/** The aired, in-play episode with no results that a commissioner should fill in next, if any. */
export function resultsDueEpisode(state: LeagueState, now?: number): Episode | null;

/** Where a commissioner fills in an episode's results: research when the league has a season, else by hand. */
export function resultsHref(state: LeagueState, ep: Episode): string;

/** When an item is due, for sorting: -Infinity for "now" (a draft turn, results, choosing where to start), Infinity for no deadline. */
export function dueAt(item: ActionItem): number;

/** Soonest first (Up next's order); ties keep their order. */
export function byDue(a: ActionItem, b: ActionItem): number;

/** Where this league's Waivers pages live: /waivers (Active Roster's old /research/waivers redirects there). */
export function waiversHref(state: LeagueState): "/waivers";
