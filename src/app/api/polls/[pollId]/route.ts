import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { answerPoll } from "@/lib/server/polls";

// One of the couch's polls (docs/PLAN-new-design.md step 12 part 2; polls.ts), until it closes:
//   POST  { vote: option | null } (null takes your vote back), or { remove: true } (whoever started it takes it down);
//         answers the season's polls
type Params = { params: Promise<{ pollId: string }> };

export const POST = apiRoute(async (req, { params }: Params) => {
  const { pollId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { vote?: unknown; remove?: unknown };
  return NextResponse.json(await answerPoll(user, pollId, body));
});
