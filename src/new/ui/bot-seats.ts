// Computer players' seats (docs/PLAN-start-a-game-redo.md E1; the user, 2026-11-18: "make sure bots have their profile picture a robot
// icon"). A computer player has a seat and no account, so wherever a face is drawn for it the id is the seat's (`userId ??
// playerId`). The games read marks which seats are computer players (game-view.ts's rows: `bot`); they're kept here as they arrive
// (data.ts registers them as the read lands, before anything draws), and Avatar draws the robot for any of them. A seat id is
// unique across every game, so a set of them is safe to share.

const seats = new Set<string>();

/** The seats a game read says are computer players. */
export function markBotSeats(ids: Iterable<string>): void {
  for (const id of ids) seats.add(id);
}

/** Whether a face's id is a computer player's seat. */
export const isBotSeat = (id: string | null | undefined): boolean => !!id && seats.has(id);
