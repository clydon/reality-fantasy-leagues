import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { editMessage, mayChange } from "@/lib/server/chat";
import { groupLeagueIds } from "@/lib/server/league-groups";

type RouteParams = { leagueId: string; messageId: string };

// Port of SurvivorDraft's server/routes/chat.js PATCH/DELETE /:messageId -- the message's own
// author can edit/delete it; commissioner/super-admin can act on anyone's. A reveal line can't be
// edited, and only a commissioner can remove one. Works across a linked league's whole group chat.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, messageId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");

  const existing = await pool.query("SELECT user_id, type FROM chat_messages WHERE id=$1 AND league_id = ANY($2::uuid[])", [messageId, await groupLeagueIds(leagueId)]);
  if (!existing.rows.length) throw new HttpError(404, "Message not found");
  mayChange(existing.rows[0], user.id, membership.role === "commissioner", "edit");

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ message: await editMessage(messageId, text) });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, messageId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");

  const existing = await pool.query("SELECT user_id, type FROM chat_messages WHERE id=$1 AND league_id = ANY($2::uuid[])", [messageId, await groupLeagueIds(leagueId)]);
  if (!existing.rows.length) throw new HttpError(404, "Message not found");
  mayChange(existing.rows[0], user.id, membership.role === "commissioner", "delete");

  await pool.query("DELETE FROM chat_messages WHERE id=$1", [messageId]);
  return NextResponse.json({ ok: true });
});
