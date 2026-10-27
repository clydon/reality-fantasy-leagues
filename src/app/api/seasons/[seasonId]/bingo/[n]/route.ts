import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { callBingo, episodeBingo, flagBingo, rerollBingo, sayBingo, tickBingo } from "@/lib/server/bingo";

// Bingo (docs/PLAN-new-design.md step 12 part 3; docs/PLAN-bingo-bank.md; bingo.ts), on a couch (`?couch=`; without one, or on a
// couch of one, your card is just yours):
//   GET   your card for an episode (the next to air, or one that's aired): its squares, what you've ticked, how many on the couch
//         are playing; once you've seen it, what's settled of each square, your lines, the couch's cards and who got a line first,
//         and the couch's called squares waiting on your say. `&of=<user>`: someone on the couch's card instead (once you've seen
//         it, or while you're watching it together; else who, and the episode to catch up on)
//   POST  { square: 0-8, ticked: boolean } from the episode's airtime on; answers the card
//         { reroll: true } until your first tick: a new card (at most two); answers it
//         { call: 0-7 } call BINGO on a line you've ticked all of; answers your card (the couch hears of it)
//         { said: { [square]: "yes" | "no" | null } } once you've seen it: whether squares in the couch's called lines happened
//         { flag: square, on?: boolean } "This square's unfair": a square on your card; on: false takes it back
// 409 for an episode that isn't next and hasn't aired, or ticking (or calling) before it airs.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const search = new URL(req.url).searchParams;
  return NextResponse.json(await episodeBingo(user, seasonId, search.get("couch"), n, new Date(), search.get("of")));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { square?: unknown; ticked?: unknown; reroll?: unknown; call?: unknown; said?: unknown; flag?: unknown; on?: unknown };
  const couch = new URL(req.url).searchParams.get("couch");
  if (body.reroll === true) return NextResponse.json(await rerollBingo(user, seasonId, couch, n));
  if (body.call !== undefined) return NextResponse.json(await callBingo(user, seasonId, couch, n, body));
  if (body.said !== undefined) return NextResponse.json(await sayBingo(user, seasonId, couch, n, body));
  if (body.flag !== undefined) return NextResponse.json(await flagBingo(user, seasonId, couch, n, body));
  return NextResponse.json(await tickBingo(user, seasonId, couch, n, body));
});
