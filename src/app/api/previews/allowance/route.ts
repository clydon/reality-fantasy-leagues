import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { previewsLeft } from "@/lib/server/preview-allowance";
import { appOnly } from "@/lib/server/previews";

// How many previews you have left today (docs/PLAN-preview-release.md, decision 4): for the Preview button and the wait. The app's
// only, never the preview service's.
export const GET = apiRoute(async (req) => {
  appOnly();
  return NextResponse.json(await previewsLeft((await requireAuth(req)).id));
});
