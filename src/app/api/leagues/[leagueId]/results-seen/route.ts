import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { markResultsSeen } from "@/lib/server/results-seen";

// "Results are in! -- Reveal": body { through: n } -- this member has now seen results through
// episode n (StateLogic.SpoilerLogic). Forward only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { through } = (await req.json().catch(() => ({}))) as { through?: unknown };
  if (!Number.isInteger(through) || (through as number) < 0) throw new HttpError(400, "through must be an episode number");
  await markResultsSeen(user.id, leagueId, through as number);
  return NextResponse.json({ ok: true });
});
