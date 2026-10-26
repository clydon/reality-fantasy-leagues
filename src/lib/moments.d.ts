// Types for moments.js (plain CommonJS so push-core.js and the hourly jobs can require it too).

export type MomentId = "lineup" | "early" | "final" | "invites" | "couch" | "backstage" | "chat";
export type ChatMode = "all" | "quiet" | "off";

export interface Moment {
  id: MomentId;
  title: string;
  line: string;
  /** push-core.js NOTIFICATION_TYPES ids. */
  types: string[];
  /** A show's ⋯ menu can turn it off for that show alone. */
  perShow: boolean;
}

export const MOMENTS: Moment[];
export const CHAT_CHOICES: { id: ChatMode; title: string; line: string; recommended?: boolean }[];
export const NEW_ONLY: Set<string>;
export function momentOf(type: string): MomentId | null;
export function momentOn(moment: MomentId, disabled: Record<string, boolean> | null | undefined): boolean;
export function chatMode(disabled: Record<string, boolean> | null | undefined, chat: string | null | undefined): ChatMode;
export function pushAllowed(type: string, disabled: Record<string, boolean> | null | undefined, showOff: unknown, anyOf?: string[] | null): boolean;
