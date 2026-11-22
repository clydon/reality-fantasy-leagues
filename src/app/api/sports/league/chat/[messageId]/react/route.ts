import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { toggleReaction } from "@/lib/server/chat";
import { messageInRoom } from "@/lib/server/league-chat";
import { roomOf } from "../../scope";

// A reaction on a message in a league's room: toggled (chat.ts toggleReaction). Not for someone only viewing the couch.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ messageId: string }> }) => {
  const { messageId } = await params;
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  if (scope.role === "viewer") throw new HttpError(403, "Only people on the couch can react here");
  await messageInRoom(scope, messageId);
  const { emoji } = (await req.json().catch(() => ({}))) as { emoji?: string };
  await toggleReaction(messageId, user.id, emoji);
  return NextResponse.json({ ok: true });
});
