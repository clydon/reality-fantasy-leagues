import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { roomCounts } from "@/lib/server/league-chat";
import { roomOf } from "../scope";

// How many messages each game's thread has had lately (league-chat.ts roomCounts): a game row's link into its thread on Scores.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ counts: await roomCounts(await roomOf(req, user)) });
});
