import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { soloFor } from "@/lib/server/solo";

// The solo hub's Play on your own (docs/PLAN-new-design.md step 9 part 3): for each of your shows with games you can play
// on your own, the season's public pool (yours if you're in it) and your practice couch there. Read when the hub opens,
// never polled. See solo.ts.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await soloFor(user));
});
