import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { readOwnClaim } from "@/lib/server/waivers";
import { resultsSeenThrough } from "@/lib/server/results-seen";

// Mid-season waivers (docs/PLAN-midseason-waivers.md, PLAN-waivers-v2.md): your own claim for the week
// that's open, as ranked pairs (and, for one release, the pre-v2 pickupIds/dropId/addIds view). Claims
// live outside league state (db/migrations/0060), so reading yours back takes its own request, the
// same as a blind-draft lock. Never anyone else's, the commissioner included -- who has claims in is
// public, in state (period.claimsIn). Held back until you've revealed the week's episode: a claim the
// commissioner made for you would say you're owed a pickup.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  const state = rows[0].state as LeagueState;
  const period = StateLogic.WaiverLogic.current(state);
  if (!period || !membership.playerId) return NextResponse.json({ periodId: period?.id ?? null, claim: null, hidden: false });
  const seen = await resultsSeenThrough(user.id, leagueId, state);
  if (seen !== null && seen < period.episode) return NextResponse.json({ periodId: period.id, claim: null, hidden: true });
  const claim = await readOwnClaim(pool, leagueId, period.id, membership.playerId, state);
  return NextResponse.json({ periodId: period.id, claim, hidden: false });
});
