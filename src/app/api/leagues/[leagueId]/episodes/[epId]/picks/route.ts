import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";
import { lateMark } from "@/lib/server/own-pace-seats";
import { forPlayerChange } from "@/lib/server/change-log";

// Pick'em only: sets (or replaces) the caller's own weekly pick for this episode. Same
// self-or-commissioner permission shape as the classic-draft bet-prediction routes this is
// modeled on (POST .../bets/:betId/predictions) -- any member can submit their own pick,
// commissioner/super-admin can submit on anyone's behalf. Business-rule validation (castaway
// still active, no repeat of the immediately-previous episode's pick) lives in
// StateLogic.setPickEmPick and silently no-ops rather than erroring, matching this repo's
// existing convention (e.g. drafting an already-owned castaway is also a silent no-op) -- the
// frontend is expected to not offer the invalid options in the first place.
//
// A pool's second pick (step A10 part 2, a pool with get.second): `second: true` sets it, beside a first already made.
// C5: a game picking several each episode (get.each): `castawayIds` sets the whole pick at once (in order); a lone `castawayId`
// adds one while the pick has room.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { playerId?: string; castawayId?: string; castawayIds?: unknown; second?: boolean };
  const { playerId, second } = body;
  const ids = Array.isArray(body.castawayIds) && body.castawayIds.length && body.castawayIds.every((x) => typeof x === "string") ? (body.castawayIds as string[]) : null;
  const castawayId = ids ? ids[0] : body.castawayId;
  const opts = second === true ? { second: true } : ids ? { picks: ids } : undefined;
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only set your own pick");
  }
  if (!playerId || !castawayId) throw new HttpError(400, "playerId and castawayId (or castawayIds) required");

  const state = await withLeagueLock(leagueId, async (s) => {
    // A late joiner catching up (StateLogic.GhostLogic): their week, as they see the league.
    const caught = await catchingUpMark(leagueId, s, playerId);
    // Someone playing at their own pace (docs/PLAN-own-pace-games.md): the aired episode, until they've watched it.
    const late = caught === null ? await lateMark(leagueId, s, playerId, epId) : null;
    const mark = caught ?? late;
    if (mark === null) return StateLogic.setPickEmPick(s, epId, playerId, castawayId, opts);
    const problem = StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => StateLogic.setPickEmPick(v, epId, playerId, castawayId, opts), { late: late !== null });
    if (problem) throw new HttpError(400, problem);
  }, forPlayerChange(user.id, membership.playerId, playerId ?? "", "pick", (name) => (second === true ? `Made ${name}'s second pick` : `Made ${name}'s pick`), { kind: "pick", episodeId: epId }));
  return stateResponse(req, state);
});
