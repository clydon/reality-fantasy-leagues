"use client";

import { finalLine, finalWhen } from "@/lib/game/final-results.js";
import { useNow } from "./ui/bars";

// When an episode's final results come, said wherever "Early results are in" is (the user, 2026-10-29): "Final results by
// 12:00 PM tomorrow", in the reader's own time; once that time has passed, "Final results soon" while a result still waits on
// its sources; "Final results are in" once they are. The time itself is the server's (final-results.js finalResultsAt: 12:00
// noon the day after it airs, the season's zone), on each reveal and episode as finalAt.

/** What to say about an episode's final results, kept current by the minute; null with no time to go on. */
export function useFinalLine(stage: "early" | "final" | null | undefined, finalAt: string | null | undefined): string | null {
  const now = useNow(false);
  return finalLine(stage, finalAt, now);
}

/** Just when, for the results' stages: "By 12:00 PM tomorrow", "Soon" once that's passed; null with no time to go on. */
export function useFinalWhen(finalAt: string | null | undefined): string | null {
  const now = useNow(false);
  if (!finalAt) return null;
  return Date.parse(finalAt) > now ? `By ${finalWhen(finalAt, now)}` : "Soon";
}

/** The same mid-line, after a " · ": "final results by 12:00 PM tomorrow". */
export const midLine = (words: string) => words[0].toLowerCase() + words.slice(1);
