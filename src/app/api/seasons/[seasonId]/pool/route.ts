import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { callPool, joinPool, leavePool, poolFor } from "@/lib/server/solo";

// A season's public pool ("Survivor 51 · Everyone", docs/PLAN-new-design.md step 9 part 3; solo.ts). GET: whether you can
// join it, how many are in, and yours as you may see it (game-view.ts at your mark: the top ten and you). POST body
// { action: "join" | "leave" | "call", castawayId? }: join (the first join makes the pool), leave (your picks go), or your
// Who goes home? call for the open episode (castawayId null takes it back). The pick itself goes through the league's own
// pick route, as every Survival Pool's does. Read on opening its page, never polled.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  return NextResponse.json(await poolFor(user, seasonId));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; castawayId?: unknown };
  if (body.action === "join") return NextResponse.json(await joinPool(user, seasonId));
  if (body.action === "leave") return NextResponse.json(await leavePool(user, seasonId));
  if (body.action === "call") return NextResponse.json(await callPool(user, seasonId, body.castawayId ?? null));
  throw new HttpError(400, "action must be join, leave or call");
});
