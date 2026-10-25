import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { toggleReaction } from "@/lib/server/chat";
import { groupLeagueIds } from "@/lib/server/league-groups";

// Port of SurvivorDraft's server/routes/chat.js POST /:messageId/react -- toggles: reacting again
// with the same emoji removes it. Only on a message in this league's chat (its linked group's).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; messageId: string }> }) => {
  const { leagueId, messageId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { rows } = await pool.query("SELECT 1 FROM chat_messages WHERE id=$1 AND league_id = ANY($2::uuid[])", [messageId, await groupLeagueIds(leagueId)]);
  if (!rows.length) throw new HttpError(404, "Message not found");
  const { emoji } = (await req.json().catch(() => ({}))) as { emoji?: string };
  await toggleReaction(messageId, user.id, emoji);
  return NextResponse.json({ ok: true });
});
