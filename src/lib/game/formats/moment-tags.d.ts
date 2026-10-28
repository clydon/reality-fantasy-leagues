// Types for formats/moment-tags.js: what a moment says about someone's place in the game.
export type MomentTag = "danger" | "safe" | "threat" | "protectionGained" | "protectionUsed" | "safety";
export const MOMENT_TAGS: MomentTag[];
export function tagsProblem(tags: unknown): string | null;
