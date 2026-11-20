import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { previewsLeft } from "@/lib/server/preview-allowance";
import { appOnly, previewsOpenTo } from "@/lib/server/previews";

// How many previews you have left today (docs/PLAN-preview-release.md, decision 4): for the Preview button and the wait. The app's
// only, never the preview service's.
export const GET = apiRoute(async (req) => {
  appOnly();
  const user = await requireAuth(req);
  // `open`: whether Try it is offered to this person at all (the desk's switch): off, no button and no line.
  return NextResponse.json({ ...(await previewsLeft(user.id)), open: await previewsOpenTo(user) });
});
