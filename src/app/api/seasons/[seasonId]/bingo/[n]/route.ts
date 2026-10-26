import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { episodeBingo, tickBingo } from "@/lib/server/bingo";

// Bingo (docs/PLAN-new-design.md step 12 part 3; bingo.ts), on a couch (`?couch=`; without one, or on a couch of one, your card is
// just yours):
//   GET   your card for an episode (the next to air, or one that's aired): its squares, what you've ticked, how many on the couch
//         are playing; once you've seen it, what's settled of each square, your lines, the couch's cards and who got a line first
//   POST  { square: 0-8, ticked: boolean } from the episode's airtime on; answers the card
// 409 for an episode that isn't next and hasn't aired, or ticking before it airs.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await episodeBingo(user, seasonId, new URL(req.url).searchParams.get("couch"), n));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { square?: unknown; ticked?: unknown };
  return NextResponse.json(await tickBingo(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body));
});
