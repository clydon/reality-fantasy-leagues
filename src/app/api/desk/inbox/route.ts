import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { inbox } from "@/lib/server/desk-inbox";

// The desk's Inbox (step 6b part 2; docs/PLAN-desk-parity.md step 2): Needs you, most urgent first, Coming up (this week's
// episodes and how their results come in) and the week's numbers. Site admins only.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json(await inbox());
});
