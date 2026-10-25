import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { flagResult } from "@/lib/server/community-results";

// "Something wrong?" (step 6b): `{ episode, decisionId, reason, note?, link? }`, or `{ episode, reason: "missing", note }`
// for something that isn't there. A flag goes to the shared check: nothing changes in anyone's games until an answer
// settles it. Answers how many others flagged the same result.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await flagResult(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
