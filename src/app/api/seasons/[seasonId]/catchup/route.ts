import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { catchUpReveal } from "@/lib/server/season-episodes";

// Catching up (docs/PLAN-new-design.md step 9): body { leagueId, couch? } reveals the next episode of your own season in a
// game you joined late, one at a time, and answers its beats in that game. See season-episodes.ts catchUpReveal.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { leagueId, couch } = (await req.json().catch(() => ({}))) as { leagueId?: unknown; couch?: unknown };
  if (typeof leagueId !== "string" || !isUuid(leagueId)) throw new HttpError(400, "leagueId required");
  const couchId = typeof couch === "string" && couch ? couch : null;
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await catchUpReveal(user, seasonId, couchId, leagueId));
});
