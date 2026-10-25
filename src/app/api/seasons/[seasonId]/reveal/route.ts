import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { revealSeason } from "@/lib/server/season-episodes";

// The one reveal (docs/PLAN-new-design.md step 2): body { episode, couch? } reveals that episode in every game you
// play on this show (that couch's, with `couch`), at once, and answers its beats. Forward only; an episode you've
// already revealed answers as it is now (its final scores, after an early reveal). See season-episodes.ts.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { episode, couch } = (await req.json().catch(() => ({}))) as { episode?: unknown; couch?: unknown };
  if (!Number.isInteger(episode)) throw new HttpError(400, "episode must be an episode number");
  const couchId = typeof couch === "string" && couch ? couch : null;
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await revealSeason(user, seasonId, couchId, episode as number));
});
