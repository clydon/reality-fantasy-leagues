import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { checkRulebook } from "@/lib/server/rulebook-checks";

// "Looks right to us" from How it works (step 10 part 3): someone on another couch checks the season's rulebook someone made
// with Make it a game (`?couch=` is theirs; never the maker's couch).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const user = await requireAuth(req);
  const { seasonId } = await params;
  return NextResponse.json(await checkRulebook(user, seasonId, new URL(req.url).searchParams.get("couch")));
});
