import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { chatScope, postCouchChat, readCouchChat } from "@/lib/server/couch-chat";

// One chat per couch and show (docs/PLAN-new-design.md step 4; couch-chat.ts): `?couch=` says whose. GET reads it
// folded past where you are; `&unfold=<episode>` shows what's folded through that episode, `&v=` answers
// { unchanged } when nothing has changed (the open chat polls every 5 s). POST { text } posts to it.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await chatScope(user, seasonId, q.get("couch"));
  const unfold = Number(q.get("unfold"));
  return NextResponse.json(await readCouchChat(user, scope, { v: q.get("v"), unfold: Number.isInteger(unfold) && unfold > 0 ? unfold : null }));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await chatScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ message: await postCouchChat(user, scope, text) });
});
