import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { endPractice, practiceFor, startPractice } from "@/lib/server/solo";

// Your practice couch on a season (docs/PLAN-new-design.md step 9 part 3; solo.ts): you against three computer players.
// GET: yours if you have one (as you may see it), else whether you can start one. POST body { game: "active-roster" |
// "classic-draft", level: "easy" | "normal" | "sharp" }: start it, the draft open at once (answers { leagueId }; the draft
// room is the show's). DELETE: end it (the game and its draft go).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  return NextResponse.json(await practiceFor(user, seasonId));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; level?: unknown };
  return NextResponse.json(await startPractice(user, seasonId, body));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  return NextResponse.json(await endPractice(user, seasonId));
});
