import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { forPlayerChange } from "@/lib/server/change-log";

// Step 2.4 (docs/PLAN-sports-ready.md): injured reserve, in a game with it (its spec's get.ir: StateLogic.IrLogic).
//   POST { action: "place", castawayId }           -> someone their roster lists as the IR takes goes on it (an open spot to add into)
//   POST { action: "back", castawayId, dropId? }    -> they come back to the roster; `dropId` makes room when it's full
//   POST { action: "drop", castawayId }             -> a drop on its own (to make room, or someone healthy on IR not wanted back)
// `playerId`: whose seat (a member's own; whoever runs the game, anyone's). Answers the league's state, as the other move routes do;
// 400 with the reason (not hurt, the IR full, the roster full, a starter whose game has started). The rosters' injuries are stamped
// on the state the lock hands this (withLeagueLock's read, cast-props.ts), so "hurt" is as of now.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; castawayId?: unknown; dropId?: unknown; playerId?: unknown };
  const action = body.action;
  if (action !== "place" && action !== "back" && action !== "drop") throw new HttpError(400, "action is place, back or drop");
  if (typeof body.castawayId !== "string" || !body.castawayId) throw new HttpError(400, "castawayId required");
  const castawayId = body.castawayId;
  const dropId = typeof body.dropId === "string" && body.dropId ? body.dropId : null;
  const playerId = typeof body.playerId === "string" && body.playerId ? body.playerId : membership.playerId;
  if (!playerId) throw new HttpError(403, "You don't have a seat in this game");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) throw new HttpError(403, "You can only move your own players");
  const IR = StateLogic.IrLogic;
  const verb = action === "place" ? "put someone on IR" : action === "back" ? "brought someone back from IR" : "dropped someone";
  const state = await withLeagueLock(
    leagueId,
    async (s) => {
      const now = Date.now();
      const refused = action === "place" ? IR.place(s, playerId, castawayId, now) : action === "back" ? IR.back(s, playerId, castawayId, dropId, now) : IR.drop(s, playerId, castawayId, now);
      if (refused) throw new HttpError(400, refused);
    },
    forPlayerChange(user.id, membership.playerId, playerId, "ir", (name) => `For ${name}: ${verb}`)
  );
  return stateResponse(req, state);
});
