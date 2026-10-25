import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { startDraft } from "@/lib/server/draft";

// Port of SurvivorDraft's server/routes/draft.js POST /force-start -- commissioner-only (draft.ts).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const actor = await requireLeagueRole(req, leagueId, "member");
  return NextResponse.json(await startDraft(actor, leagueId));
});
