import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { chatScope, postCouchChat, readCouchChat, readEarlierChat } from "@/lib/server/couch-chat";

// One chat per couch and show (docs/PLAN-new-design.md step 4; couch-chat.ts): `?couch=` says whose. GET reads it
// folded past where you are; `&unfold=<episode>` shows what's folded through that episode, `&v=` answers
// { unchanged } when nothing has changed (the open chat polls every 5 s). Earlier messages (step 15 part 4): `&before=<message>`
// the 100 before it, folded the same, read on a tap and never polled; `&since=<message>` everything from it on instead of the
// newest 300 (the open chat, once you've read back). Either with `&at=<its time>`, which places a message deleted meanwhile.
// POST { text } posts to it.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await chatScope(user, seasonId, q.get("couch"));
  const n = Number(q.get("unfold"));
  const unfold = Number.isInteger(n) && n > 0 ? n : null;
  const at = q.get("at");
  if (q.has("before")) return NextResponse.json(await readEarlierChat(user, scope, { before: q.get("before"), at, unfold }));
  return NextResponse.json(await readCouchChat(user, scope, { v: q.get("v"), unfold, since: q.get("since"), at }));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ message: await postCouchChat(user, scope, text) });
});
