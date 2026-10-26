import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { myTrivia } from "@/lib/server/trivia";

// This week's trivia rounds on your shows (docs/PLAN-new-design.md step 12 part 3; trivia.ts myTrivia), for Commercial break's
// This week only and the solo hub's On your own: a few shows with something to ask, your score and the couch's best (`?couch=`).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ rounds: await myTrivia(user, new URL(req.url).searchParams.get("couch")) });
});
