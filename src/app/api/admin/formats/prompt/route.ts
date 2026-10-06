import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { buildProposalPrompt } from "@/lib/game/formats/proposal.js";

// Read-only: the text an admin copies into their own web-searching chat (free, no API key) to research
// a new show's format, then pastes the answer back to POST /api/admin/formats. No model call.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
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
