import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { markRevealed } from "@/lib/server/reveal";

// "Results are in! -- Reveal": body { through: n, jump? } -- this member has now seen results through episode n
// (StateLogic.SpoilerLogic). Forward only. The rules (linked leagues, the chat line, a late joiner one episode at a
// time unless they jump) are reveal.ts's, shared with the new design's reveal.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { through, jump } = (await req.json().catch(() => ({}))) as { through?: unknown; jump?: unknown };
  if (!Number.isInteger(through) || (through as number) < 0) throw new HttpError(400, "through must be an episode number");
  await markRevealed(user, leagueId, membership.playerId, through as number, jump === true);
  return NextResponse.json({ ok: true });
});
