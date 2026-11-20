import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { previewsLeft } from "@/lib/server/preview-allowance";

// How many previews you have left today (docs/PLAN-preview-release.md, decision 4): for the Preview button and the wait.
export const GET = apiRoute(async (req) => NextResponse.json(await previewsLeft((await requireAuth(req)).id)));
