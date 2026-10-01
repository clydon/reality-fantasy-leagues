// Types for action-items.js (plain CommonJS so db/reminders.js can require it under bare node).
import type { LeagueState } from "./types";

export type ActionKind = "invite" | "draftTurn" | "blindDraft" | "midSeasonTurn" | "lineup" | "pick" | "prediction";

export interface ActionItem {
  kind: ActionKind;
  /** Short, imperative: what to do. The league's name is shown alongside it, not in it. */
  text: string;
  /** Where doing it happens, within the league. Hash targets an Overview section. */
  href: string;
  /** Weekly items (lineup, pick, prediction): the episode number it's for. */
  episode?: number;
  /** "invite" only (from /api/me/actions, not actionItems): which invite, and who sent it. */
  inviteId?: string;
  invitedBy?: string | null;
}

export function actionItems(state: LeagueState, playerId: string): ActionItem[];
