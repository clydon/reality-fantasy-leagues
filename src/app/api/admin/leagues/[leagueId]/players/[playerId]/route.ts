import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js DELETE /leagues/:leagueId/players/:playerId --
// "deletes" a player without breaking history: renames to disabled_player_XXXX, flags it
// disabled, and unlinks any account from it. Past picks/points/bets are untouched.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; playerId: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId, playerId } = await params;

  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  const state = rows[0].state;
  const disabled = StateLogic.disablePlayer(state, playerId);
  if (!disabled) throw new HttpError(404, "Player not found");

  await pool.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), leagueId]);
  await pool.query("DELETE FROM league_memberships WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
  return NextResponse.json({ ok: true, player: disabled });
});
