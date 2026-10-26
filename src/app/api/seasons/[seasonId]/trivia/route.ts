import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { playTrivia, seasonTrivia } from "@/lib/server/trivia";

// Trivia (docs/PLAN-new-design.md step 12 part 3; trivia.ts), on a couch (`?couch=`; the couch's scores this week):
//   GET   this week's round on the season's show: its questions (only about seasons you've seen), your score once you've played
//   POST  { answers: { [question]: option } }: graded on the server, the week's first play kept; answers the round
type Params = { params: Promise<{ seasonId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await seasonTrivia(user, seasonId, new URL(req.url).searchParams.get("couch")));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { answers?: unknown };
  return NextResponse.json(await playTrivia(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
