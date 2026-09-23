import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/chat.js POST /:messageId/react -- toggles: reacting again
// with the same emoji removes it.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; messageId: string }> }) => {
  const { leagueId, messageId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { emoji: rawEmoji } = (await req.json().catch(() => ({}))) as { emoji?: string };
  const emoji = (rawEmoji || "").trim();
  if (!emoji) throw new HttpError(400, "emoji required");

  const existing = await pool.query("SELECT id FROM chat_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3", [
    messageId,
    user.id,
    emoji,
  ]);
  if (existing.rows.length) {
    await pool.query("DELETE FROM chat_reactions WHERE id=$1", [existing.rows[0].id]);
  } else {
    await pool.query("INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3)", [messageId, user.id, emoji]);
  }
  return NextResponse.json({ ok: true });
});
