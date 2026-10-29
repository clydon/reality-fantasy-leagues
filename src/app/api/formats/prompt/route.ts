import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { buildProposalPrompt } from "@/lib/game/formats/proposal.js";

// Self-serve research prompt (docs/PLAN-rollout-order.md stage 4; classic admin had its twin until step 8): any signed-in
// user, not just a super-admin, since researching a NEW show (never an existing one) is safe to open
// up -- see the create-show route for why that boundary holds. Read-only, no model call.
export const GET = apiRoute(async (req) => {
  await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const showName = (q.get("name") || "").trim();
  if (!showName) throw new HttpError(400, "name required");
  const prompt = buildProposalPrompt({
    showName,
    wikiUrl: q.get("wiki") || undefined,
    terms: { castaway: q.get("castaway") || undefined, tribe: q.get("tribe") || undefined },
    seasons: q.get("seasons") || undefined,
  });
  return NextResponse.json({ prompt });
});
