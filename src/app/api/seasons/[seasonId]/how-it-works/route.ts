import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { seasonHowItWorks } from "@/lib/server/how-it-works";

// How it works for a show (docs/PLAN-new-design.md step 1), for anyone who can see the season: with `?couch=` told
// from that couch's games here, else from yours, else the season's rulebook. Spoiler-safe (how-it-works.ts).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await seasonHowItWorks(user, seasonId, couchId));
});
