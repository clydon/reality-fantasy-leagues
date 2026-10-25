import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { seasonBot, setSeasonBot } from "@/lib/server/desk-bot";
import { clearGroup, deskSeason, seasonLines } from "@/lib/server/desk-cast";

// A season on the desk (step 6b part 2): GET its rulebook, cast and episodes' results, and (6c part 2) its bot's schedule;
// POST `{ clearGroup, preview? }` takes a group that's really a secret role off the cast and out of every league on the
// season; POST `{ bot: { on?, schedule? } }` changes the bot's schedule for the season (Autopilot's trial).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json({ ...(await deskSeason(id)), bot: await seasonBot(id), history: await seasonLines(id) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { clearGroup?: unknown; preview?: unknown; bot?: { on?: unknown; schedule?: unknown } };
  if (body.bot && typeof body.bot === "object") return NextResponse.json({ bot: await setSeasonBot(user, id, body.bot) });
  return NextResponse.json(await clearGroup(user, id, { group: body.clearGroup, preview: body.preview }));
});
