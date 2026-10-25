import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { couchFill, deskCouch, handCouchGame } from "@/lib/server/desk-couches";

// A couch on the desk (step 6b part 2): GET; POST `{ hand: { leagueId, userId } }` (a game nobody runs, to someone who plays it)
// or `{ anyone: boolean }` (Override who fills in its results).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskCouch((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { hand?: { leagueId?: unknown; userId?: unknown }; anyone?: unknown };
  if (body.hand) return NextResponse.json(await handCouchGame(user, id, body.hand));
  if ("anyone" in body) return NextResponse.json(await couchFill(user, id, body.anyone));
  throw new HttpError(400, "hand or anyone");
});
