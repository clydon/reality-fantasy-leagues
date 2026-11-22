import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { roomUnread } from "@/lib/server/league-chat";
import { roomOf } from "../scope";

// The league's Chat tab badge: others' messages you haven't read (league-chat.ts roomUnread).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await roomUnread(user.id, await roomOf(req, user)));
});
