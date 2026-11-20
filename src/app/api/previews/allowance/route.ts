import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { previewsLeft } from "@/lib/server/preview-allowance";
import { appOnly, previewsOpenTo, previewUsage } from "@/lib/server/previews";

// How many previews you have left this week, of your week's share (docs/PLAN-preview-release.md, decision 4): for Try it's line. The
// app's only, never the preview service's.
export const GET = apiRoute(async (req) => {
  appOnly();
  const user = await requireAuth(req);
  // `open`: whether Try it is offered to this person at all (the desk's switch): off, no button and no line.
  const open = await previewsOpenTo(user);
  // (Closed to you: no share is worked out, so a look while it's off never fixes your week.)
  return NextResponse.json(open ? { ...(await previewsLeft(user.id, previewUsage)), open } : { left: 0, perWeek: 0, open });
});
