import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { castVote, openVotes } from "@/lib/server/moment-votes";

// Settings Round 3b (A17): the players' vote on a moment a game's rules gained mid-season (moment-votes.ts), on a couch (`?couch=`).
// GET -> { votes }: the votes open for you in your games here (any whose close has passed are settled first).
// POST { leagueId, id, vote: "start" | "next" } -> { votes }: your vote, changeable until it's decided.
const couchOf = (req: Request) => {
  const c = new URL(req.url).searchParams.get("couch");
  if (!c) throw new HttpError(400, "couch is required");
  return c;
};

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await openVotes(user, seasonId, couchOf(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { leagueId?: unknown; id?: unknown; vote?: unknown };
  return NextResponse.json(await castVote(user, seasonId, couchOf(req), body));
});
