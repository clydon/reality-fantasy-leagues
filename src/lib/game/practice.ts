// A practice couch's shape (docs/PLAN-new-design.md step 9 part 3; src/lib/server/solo.ts makes them): you and three
// computer players (bot-logic.js), a turn-based draft, teams fitted to who's still in. Pure, for the tests.

/** The computer players' names, in their seats' order. */
export const BOT_NAMES = ["Ada", "Max", "Ivy"];

export type PracticeGame = "active-roster" | "classic-draft";

/**
 * How big each team is with `stillIn` castaways left to share between you and the bots (castaways on one team each), or
 * null when there are too few for teams of two. Weekly Lineup keeps a bench: 3 starting and 2 on the bench when there's
 * room (the usual), fewer late in a season; Outlast drafts up to four.
 */
export function practiceTeams(game: PracticeGame, stillIn: number): { activeSlots?: number; benchSlots?: number; teamSize?: number } | null {
  const each = Math.floor(stillIn / (BOT_NAMES.length + 1));
  if (each < 2) return null;
  if (game === "classic-draft") return { teamSize: Math.min(4, each) };
  const bench = each >= 5 ? 2 : 1;
  return { activeSlots: Math.min(3, each - bench), benchSlots: bench };
}
