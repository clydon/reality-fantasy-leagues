import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/leagues.js POST /join -- joins by share code, becomes a
// member with a new player slot.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) throw new HttpError(400, "Join code required");

  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE join_code=$1", [trimmed]);
  if (!rows.length) throw new HttpError(404, "No league found with that code");
  const league = rows[0];

  const existing = await pool.query("SELECT id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [league.id, user.id]);
  if (existing.rows.length) throw new HttpError(409, "You're already in that league");

  const state = league.state;
  const player = StateLogic.addPlayer(state, (user as { username?: string | null }).username || user.name);
  await pool.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), league.id]);
  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,'member')", [
    league.id,
    user.id,
    player.id,
  ]);

  return NextResponse.json({ league: { id: league.id, name: league.name } });
});
