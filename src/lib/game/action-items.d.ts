// Types for action-items.js (plain CommonJS so db/reminders.js can require it under bare node).
import type { Episode, LeagueState } from "./types";

export type ActionKind = "notifications" | "invite" | "lateJoin" | "draftTurn" | "blindDraft" | "midSeasonTurn" | "lineup" | "pick" | "prediction" | "results";

export interface ActionItem {
  kind: ActionKind;
  /** Short, imperative: what to do. The league's name is shown alongside it, not in it. */
  text: string;
  /** Where doing it happens, within the league. Hash targets an Overview section. */
  href: string;
  /** Weekly items (lineup, pick, prediction, results): the episode number it's for. */
  episode?: number;
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
