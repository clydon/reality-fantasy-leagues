import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { markRoomRead } from "@/lib/server/league-chat";
import { roomOf } from "../scope";

// You've read a league's room up to `at` (forward only): the Chat tab's badge clears.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  const { at } = (await req.json().catch(() => ({}))) as { at?: string };
  await markRoomRead(user.id, scope, at);
  return NextResponse.json({ ok: true });
});
