import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { withUiCookie } from "@/lib/server/ui-choice";
import { saveFirstRun } from "@/lib/server/way-in";
import { listingsFor } from "@/lib/server/listings";

// First run's shows, saved once there's an account (docs/PLAN-new-design.md step 9 part 2): body
// { follows: [{ seasonId, seenThrough } | { listing, seenThrough } | { name, seenThrough }], ui?: "new" } (a show from the TV
// listings, or added by name, is made if it has to be: step 10). Open to an account still waiting to get in: its own shows are
// all it saves. Answers { saved }, and with ui "new" this device's cookie too (ui-choice.ts).
export const POST = apiRoute(async (req) => {
  const { user } = await requireSession(req);
  const body = (await req.json().catch(() => ({}))) as { follows?: unknown; ui?: unknown };
  const res = NextResponse.json(await saveFirstRun(user, body, listingsFor(req)));
  return body.ui === "new" ? withUiCookie(res, "new") : res;
});
