import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { toggleReaction } from "@/lib/server/chat";
import { chatScope, messageInScope } from "@/lib/server/couch-chat";

// A reaction on a message in the couch's chat about a show: toggles, as classic's does.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; messageId: string }> }) => {
  const { seasonId, messageId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  if (scope.role === "viewer" || scope.out) throw new HttpError(403, "Only people in this chat can react");
  await messageInScope(scope, messageId);
  const { emoji } = (await req.json().catch(() => ({}))) as { emoji?: string };
  await toggleReaction(messageId, user.id, emoji);
  return NextResponse.json({ ok: true });
});
