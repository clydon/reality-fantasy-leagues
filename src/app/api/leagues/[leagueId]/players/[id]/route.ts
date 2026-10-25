import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import Bots from "@/lib/game/bot-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { dropBlindPicksForPlayer } from "@/lib/server/blind-draft";
import { plainChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/roster.js PATCH/DELETE /players/:id -- commissioner-only.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");
  if (field === "automated") {
    if (typeof value !== "boolean") throw new HttpError(400, "automated must be true or false");
    // A person's seat is theirs to play: only a seat with no account behind it can be a computer player.
    const linked = await pool.query("SELECT 1 FROM league_memberships WHERE league_id=$1 AND player_id=$2", [leagueId, id]);
    if (value && linked.rows.length) throw new HttpError(409, "That seat belongs to someone's account");
  }
  if (field === "botLevel" && !(typeof value === "string" && Object.hasOwn(Bots.LEVELS, value))) {
    throw new HttpError(400, "Unknown level");
  }

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updatePlayer(s, id, field, value);
  }, plainChange(user.id, "players", "Changed a player's details"));
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.removePlayer(s, id);
    // The seat is gone, so any blind-draft submission it made is meaningless -- and left behind it
    // would keep an unrevealed draft waiting on a player who no longer exists. Same transaction as
    // the state write so the two can't diverge. (Disabling a seat rather than deleting it keeps its
    // submission; see dropBlindPicksForPlayer's comment.)
    await dropBlindPicksForPlayer(client, leagueId, id);
    StateLogic.BlindDraftLogic.setLockedPlayerIds(
      s,
      StateLogic.BlindDraftLogic.lockedPlayerIds(s).filter((pid) => pid !== id)
    );
  }, plainChange(user.id, "players", "Removed a player", 3));
  return NextResponse.json(state);
});
