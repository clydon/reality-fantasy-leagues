import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";

// Was: whoever ran the game typed in the finale's final three by hand, and finale predictions were graded against it. Since step A4
// of docs/PLAN-start-a-game-gpt.md the results settle them (StateLogic.AnswerLogic: the season's winner, and the order
// everyone finished in), never anyone's word, so there's nothing to enter.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  throw new HttpError(409, "The results settle the finale now: there's nothing to enter");
});
