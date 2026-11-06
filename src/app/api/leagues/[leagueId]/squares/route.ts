import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { forPlayerChange } from "@/lib/server/change-log";

// A squares game (docs/PLAN-start-a-game-gpt.md track L, L3 part 2e: StateLogic.SquaresLogic): sets (or replaces) a seat's squares,
// `cells` the squares by number (0 to 99 on a 10 by 10, row by row), first come. Any member sets their own; whoever runs the game,
// anyone's. Before the game's first episode locks they change as often as you like (an empty list gives them back); after it, only
// a seat with none takes squares left over. A game whose squares are dealt has nothing to take. The engine says why it refuses.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { playerId?: string; cells?: unknown };
  const { playerId } = body;
  if (membership.role !== "commissioner" && playerId !== membership.playerId) throw new HttpError(403, "You can only set your own squares");
  if (!playerId || !Array.isArray(body.cells)) throw new HttpError(400, "playerId and cells required");
  const cells = body.cells as number[];
  const state = await withLeagueLock(leagueId, (s) => {
    const problem = StateLogic.SquaresLogic.take(s, playerId, cells);
    if (problem) throw new HttpError(400, problem);
  }, forPlayerChange(user.id, membership.playerId, playerId, "squares", (name) => `Set ${name}'s squares`, { kind: "pick" }));
  return stateResponse(req, state);
});
