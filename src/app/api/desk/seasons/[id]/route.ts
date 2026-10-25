import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { clearGroup, deskSeason, seasonLines } from "@/lib/server/desk-cast";

// A season on the desk (step 6b part 2): GET its rulebook, cast and episodes' results; POST `{ clearGroup, preview? }` takes a
// group that's really a secret role off the cast and out of every league on the season.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json({ ...(await deskSeason(id)), history: await seasonLines(id) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const body = (await req.json().catch(() => ({}))) as { clearGroup?: unknown; preview?: unknown };
  return NextResponse.json(await clearGroup(user, (await params).id, { group: body.clearGroup, preview: body.preview }));
});
