// Types for final-results.js (plain CommonJS so the hourly jobs can require it under bare node).
export const FINAL_TIME: string;
/** When an episode that starts at `airAt` has its final results: FINAL_TIME the day after it airs, in the season's `tz`. */
export function finalResultsAt(airAt: string | Date | null | undefined, tz: string | null | undefined): Date | null;
/** "12:00 PM tomorrow", "12:00 PM today", "9:00 AM Friday", "12:00 PM Oct 31", in `tz` (the device's when left out). */
export function finalWhen(finalAt: string | Date, now?: number | Date, tz?: string | null): string;
/** "Final results are in", "Final results by 12:00 PM tomorrow", "Final results soon", or null with no time to go on. */
export function finalLine(stage: "early" | "final" | null | undefined, finalAt: string | Date | null | undefined, now?: number | Date, tz?: string | null): string | null;
