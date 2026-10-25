import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { editMessage, mayChange } from "@/lib/server/chat";
import { chatScope, messageInScope } from "@/lib/server/couch-chat";

type RouteParams = { seasonId: string; messageId: string };

// Editing and removing a message in the couch's chat about a show (chat.ts mayChange): your own, or anyone's if you
// run a game here or own the couch. A reveal line can't be edited; only they can remove one.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { seasonId, messageId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  mayChange(await messageInScope(scope, messageId), user.id, scope.moderator, "edit");
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const m = await editMessage(messageId, text);
  return NextResponse.json({ message: { id: m.id, text: m.text, edited: true } });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { seasonId, messageId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  mayChange(await messageInScope(scope, messageId), user.id, scope.moderator, "delete");
  await pool.query("DELETE FROM chat_messages WHERE id=$1", [messageId]);
  return NextResponse.json({ ok: true });
});
