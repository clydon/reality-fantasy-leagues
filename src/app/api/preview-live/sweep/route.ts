import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { sweepAll } from "@/lib/server/preview-live";

// Live previews' sweep (docs/PLAN-preview-release.md, step 7), called hourly by the repository's job
// (.github/workflows/reminders-waivers.yml). Open, with no secret: it only removes what's due (previews past their time, copies older
// than the longest one lives that no preview holds), and does it at most once a minute whoever asks.
export const maxDuration = 120;

export const POST = apiRoute(async () => NextResponse.json(await sweepAll()));
