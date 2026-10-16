import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";
import { requireWaivers } from "@/lib/server/waiver-actor";
import { userIdsForPlayers } from "@/lib/server/push-targets";
import { notifyWaiverNudge } from "@/lib/server/push-events";

// The commissioner's Nudge (docs/PLAN-midseason-waivers.md, the canvas's boards 10 and 11): one push to
// a player with no claim in while waivers are open, worded for what they may know (waiver-pushes.js).
// Once per player per week -- the week's public `nudged` list says who has been, so the button can say
// so too. Body { playerId }. Commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { playerId?: unknown };
  const playerId = typeof body.playerId === "string" ? body.playerId : "";

  // Checked before anything is recorded: a seat with no account has nobody to push.
  if (!(await userIdsForPlayers(leagueId, [playerId])).length) throw new HttpError(400, "They don’t have an account to nudge");

  const state = await withLeagueLock(leagueId, async (s) => {
    requireWaivers(s);
    const W = StateLogic.WaiverLogic;
    const period = W.current(s);
    const player = StateLogic.getPlayer(s, playerId);
    if (!period || period.phase !== "open") throw new HttpError(409, "Waivers aren’t open");
    if (!player || !W.rotation(s).includes(playerId) || player.automated) throw new HttpError(400, "No such player in waivers");
    const first = player.name.split(" ")[0];
    if (period.claimsIn.includes(playerId)) throw new HttpError(409, `${first}’s claim is already in`);
    if ((period.nudged ?? []).includes(playerId)) throw new HttpError(409, `You’ve nudged ${first} this week`);
    period.nudged = [...(period.nudged ?? []), playerId];
  });

  const me = membership.playerId ? StateLogic.getPlayer(state, membership.playerId) : null;
  const { rows } = await pool.query(`SELECT username FROM "user" WHERE id=$1`, [user.id]);
  const byName = me?.name ?? rows[0]?.username ?? "Your commissioner";
  await notifyWaiverNudge(leagueId, state, playerId, byName);
  return NextResponse.json(state);
});
