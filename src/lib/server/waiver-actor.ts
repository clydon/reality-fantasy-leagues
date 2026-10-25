import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { LeagueMembership } from "./auth-helpers";
import { HttpError } from "./http-error";
import { resultsSeenThrough } from "./results-seen";
import { roleAtLeast } from "./roles";

// Who a waiver request acts for (docs/PLAN-midseason-waivers.md). A member acts for their own player;
// the commissioner may name another ("Claim for Dee"). Acting for yourself needs the week's episode
// revealed first: whether you're owed a pickup would give away that one of yours left, so claims and
// free-agency moves wait until you've seen it. A commissioner acting for someone else isn't held to
// that player's mark (they can't see the claim's contents anyway). A Game admin runs waivers too, so
// they may claim for someone as well (step 7's admins pick for someone).
export async function waiverActor(
  userId: string,
  leagueId: string,
  membership: LeagueMembership,
  state: LeagueState,
  requested: unknown
): Promise<string> {
  const forOther = typeof requested === "string" && requested && requested !== membership.playerId;
  if (forOther) {
    if (!roleAtLeast(membership.role, "admin")) throw new HttpError(403, "Only whoever runs the game can claim for someone else");
    if (!StateLogic.getPlayer(state, requested)) throw new HttpError(404, "No such player");
    return requested;
  }
  if (!membership.playerId) throw new HttpError(400, "You don't have a team in this league");
  const period = StateLogic.WaiverLogic.current(state);
  const seen = await resultsSeenThrough(userId, leagueId, state);
  if (period && seen !== null && seen < period.episode) throw new HttpError(409, `Reveal episode ${period.episode} first`);
  return membership.playerId;
}

/** Waiver routes only exist for a league with Pickups or Add/drops on. */
export function requireWaivers(state: LeagueState): void {
  if (!StateLogic.WaiverLogic.enabled(state)) throw new HttpError(400, "This league doesn't use waivers");
}
