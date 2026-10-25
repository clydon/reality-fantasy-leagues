import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { chatScope, couchChatUnread } from "@/lib/server/couch-chat";

// The Chat tab's badge (polled every 30 s while a show space is open, not on Chat itself): a count, worked out in the
// database. `&reveal=<episode>` also says who the chat's reveal lines say has revealed it, for Tonight's Results are in.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await chatScope(user, seasonId, q.get("couch"));
  const reveal = Number(q.get("reveal"));
  return NextResponse.json(await couchChatUnread(user, scope, Number.isInteger(reveal) && reveal > 0 ? reveal : null));
});
