import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { remindNow, remindPreview } from "@/lib/server/backstage-remind";

// Backstage's "Remind everyone" (backstage-remind.ts), for whoever runs a game on this couch's season (`?couch=`).
//   GET     how many people still have a move open in the games you run here, and how many heard from here lately
//   POST    push each of them once, listing their open moves (skipping anyone reminded from here in the last few hours)
//           -> { sent, people, recent, next, cooldownHours }
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await remindPreview(scope));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await remindNow(scope));
});
