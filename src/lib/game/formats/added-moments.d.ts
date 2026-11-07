// Types for added-moments.js (a season's own added moments, G1 part 4).
export interface AddedMoment {
  id: string;
  label: string;
  question: string | null;
  /** The first episode research asks it about. */
  from: number;
}
export type Standing = { state: "yes"; who: string[] } | { state: "no" } | { state: "unsure" };
export interface MomentAnswer {
  happened: "yes" | "no" | "unknown";
  who: string[];
  sure: "high" | "low";
  source?: string | null;
}
export const MAX_ADDED: number;
export function addedOf(blocks: unknown): AddedMoment[];
export function standingOf(castaways: unknown, key: string, among?: string[] | null): Standing;
export function unsureIn(castaways: unknown, moments: AddedMoment[], n: number): AddedMoment[];
export function fillMoments<T extends Record<string, unknown>>(castaways: T[] | unknown, answers: Record<string, MomentAnswer> | unknown): { castaways: T[]; changed: string[] };
