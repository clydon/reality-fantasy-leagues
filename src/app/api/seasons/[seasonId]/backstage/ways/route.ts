import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { unlockTap, waysRead } from "@/lib/server/results-ways";

// How results get in for a couch's season (step 6c, results-ways.ts): GET, One tap's unlock, Autopilot, whether the bot
// is answering and any One tap running; POST `{ unlock: "tap" }` unlocks One tap for the whole couch (free during beta).
// Anyone who plays or runs a game here reads it; unlocking is for whoever may fill in results.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await waysRead(user, seasonId, new URL(req.url).searchParams.get("couch"), botFor(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { unlock?: unknown };
  if (body.unlock !== "tap") throw new HttpError(400, "unlock must be tap (Autopilot is coming soon)");
  return NextResponse.json(await unlockTap(user, seasonId, new URL(req.url).searchParams.get("couch"), botFor(req)));
});
