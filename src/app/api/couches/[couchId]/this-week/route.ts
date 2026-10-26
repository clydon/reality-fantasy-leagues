import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchThisWeek } from "@/lib/server/polls";

// Commercial break's This week only (docs/PLAN-new-design.md step 12 part 2; polls.ts couchThisWeek): each of your shows with an
// episode coming up and your calls on it, and the couch's polls you may see. Read when the page opens.
type Params = { params: Promise<{ couchId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await couchThisWeek(user, couchId));
});
