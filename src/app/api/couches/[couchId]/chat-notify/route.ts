import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, requireAuth, requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { readCouchChat, saveCouchChat } from "@/lib/server/notify-prefs";

// Chat notifications on one couch (settings Round 1, A9; notify-prefs.ts): your own choice there, or null for your account's.
// PUT { chat: "all" | "quiet" | "off" | null }. Only someone on the couch: anyone else gets a 404, as if it didn't exist.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await readCouchChat(user.id, couchId));
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const session = await requireAuthSession(req);
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their notifications are theirs to change.");
  const { chat } = (await req.json().catch(() => ({}))) as { chat?: unknown };
  return NextResponse.json(await saveCouchChat(session.user.id, couchId, chat === undefined ? null : chat));
});
