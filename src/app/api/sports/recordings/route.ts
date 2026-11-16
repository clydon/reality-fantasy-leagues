import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { recordingsOf, setRecording } from "@/lib/server/sports/recordings";

// Watching a sports game as if live (the design round's step 7; sports/recordings.ts): GET the games you're watching from a
// recording; POST { game, league, on } starts (on: true) or stops (on: false, you've watched it) hiding one.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ recordings: await recordingsOf(user.id) });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; league?: unknown; on?: unknown };
  return NextResponse.json({ recordings: await setRecording(user.id, body) });
});
