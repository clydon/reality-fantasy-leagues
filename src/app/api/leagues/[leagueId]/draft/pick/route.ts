import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { pickInDraft } from "@/lib/server/draft";

// Port of SurvivorDraft's server/routes/draft.js POST /pick -- a member may only draft on their
// own turn; whoever runs the game (a commissioner or Game admin) can pick for anyone, and that pick is
// a line in Recent changes. The rules are draft.ts's, shared with the new design's draft room. Pushes
// the player now on the clock.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const actor = await requireLeagueRole(req, leagueId, "member");
  const { castawayId } = (await req.json().catch(() => ({}))) as { castawayId?: string };
  if (!castawayId) throw new HttpError(400, "castawayId required");
  const { state } = await pickInDraft(actor, leagueId, castawayId);
  return stateResponse(req, state);
});
