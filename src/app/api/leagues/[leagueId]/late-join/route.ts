import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyLateJoinerStarted } from "@/lib/server/push-events";
import { lateJoinGroup } from "@/lib/server/late-join";

// The step's linked group (docs/PLAN-linked-late-join.md): one answer for every linked league they
// still have to start, prefilled from one they're already playing.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  return NextResponse.json({ leagues: await lateJoinGroup(user.id, leagueId) });
});

// A late joiner starts their season (StateLogic.GhostLogic.begin): body { startEpisode, castawayIds }.
// Their own seat only. Their spoiler mark goes to the episode before their start, so the league as
// they see it opens on that episode, as if it airs tonight.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const playerId = membership.playerId;
  if (!playerId) throw new HttpError(403, "You don't have a seat in this league");
  const { startEpisode, castawayIds } = (await req.json().catch(() => ({}))) as { startEpisode?: unknown; castawayIds?: unknown };
  if (!Number.isInteger(startEpisode)) throw new HttpError(400, "startEpisode required");
  const start = startEpisode as number;

  const state = await withLeagueLock(leagueId, async (s, client) => {
    const problem = StateLogic.GhostLogic.begin(s, playerId, start, Array.isArray(castawayIds) ? (castawayIds as string[]) : []);
    if (problem) throw new HttpError(400, problem);
    const lj = StateLogic.GhostLogic.lateJoinOf(s, playerId);
    if (lj) lj.seenThrough = start - 1;
    await client.query("UPDATE league_memberships SET results_seen_through=$3 WHERE league_id=$1 AND player_id=$2", [
      leagueId,
      playerId,
      start - 1,
    ]);
  });
  const name = StateLogic.getPlayer(state, playerId)?.name || (user as { username?: string | null }).username || user.name;
  notifyLateJoinerStarted(leagueId, name, start);
  return NextResponse.json(state);
});
