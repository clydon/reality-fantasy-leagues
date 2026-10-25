import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { inbox, requireDesk } from "@/lib/server/desk";

// The desk's Inbox (step 6b part 2): only what the community couldn't settle, and the week's numbers. Site admins only.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json(await inbox());
});
