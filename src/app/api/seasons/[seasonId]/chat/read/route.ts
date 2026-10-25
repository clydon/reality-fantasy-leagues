import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, requireAuth, requireSession } from "@/lib/server/auth-helpers";
import { chatScope, markCouchChatRead } from "@/lib/server/couch-chat";

// You've read the couch's chat about this show up to `at` (couch-chat.ts markCouchChatRead): forward only, and
// classic's reads for the couch's games here move with it.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  if (scope.out || scope.role === "viewer") return NextResponse.json({ ok: true, skipped: "not in this chat" });
  // An admin viewing as this person mustn't mark their chat read for them.
  if (isImpersonating(await requireSession(req))) return NextResponse.json({ ok: true, skipped: "impersonating" });
  const { at } = (await req.json().catch(() => ({}))) as { at?: string };
  await markCouchChatRead(user.id, scope, at);
  return NextResponse.json({ ok: true });
});
