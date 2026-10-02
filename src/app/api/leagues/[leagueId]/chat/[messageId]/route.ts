import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { withReactions } from "@/lib/server/chat";
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
  if (existing.rows[0].type !== "message") throw new HttpError(400, "Only messages can be edited");
  const isOwner = existing.rows[0].user_id === user.id;
  if (!isOwner && membership.role !== "commissioner") throw new HttpError(403, "You can only edit your own messages");

  const { text: rawText } = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (rawText || "").trim();
  if (!text) throw new HttpError(400, "Message text required");

  const updated = await pool.query(
    "UPDATE chat_messages SET text=$1, edited_at=now() WHERE id=$2 RETURNING id, user_id, author_name, type, text, created_at, edited_at",
    [text, messageId]
  );
  return NextResponse.json({ message: (await withReactions(updated.rows))[0] });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, messageId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");

  const existing = await pool.query("SELECT user_id, type FROM chat_messages WHERE id=$1 AND league_id = ANY($2::uuid[])", [messageId, await groupLeagueIds(leagueId)]);
  if (!existing.rows.length) throw new HttpError(404, "Message not found");
  if (existing.rows[0].type !== "message" && membership.role !== "commissioner") throw new HttpError(400, "Only messages can be deleted");
  const isOwner = existing.rows[0].user_id === user.id;
  if (!isOwner && membership.role !== "commissioner") throw new HttpError(403, "You can only delete your own messages");

  await pool.query("DELETE FROM chat_messages WHERE id=$1", [messageId]);
  return NextResponse.json({ ok: true });
});
