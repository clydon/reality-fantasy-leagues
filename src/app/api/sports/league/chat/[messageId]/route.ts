import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { editMessage, mayChange } from "@/lib/server/chat";
import { messageInRoom } from "@/lib/server/league-chat";
import { roomOf } from "../scope";

type RouteParams = { messageId: string };

// Editing and removing a message in a league's room (chat.ts mayChange): your own, or anyone's for the couch's owner.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { messageId } = await params;
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  mayChange(await messageInRoom(scope, messageId), user.id, scope.moderator, "edit");
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const m = await editMessage(messageId, text);
  return NextResponse.json({ message: { id: m.id, text: m.text, edited: true } });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { messageId } = await params;
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  mayChange(await messageInRoom(scope, messageId), user.id, scope.moderator, "delete");
  await pool.query("DELETE FROM chat_messages WHERE id=$1", [messageId]);
  return NextResponse.json({ ok: true });
});
