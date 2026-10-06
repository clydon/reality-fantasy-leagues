import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { approveChange, getChange } from "@db/season-rule-changes.js";
import { pushSeasonRuleChanges } from "@/lib/server/season-rule-changes";

// Approves a draft check: re-derived and validated against the season's rules, then in force for
// research from its effective episode, and offered to every league on the season. No league scores it
// until its commissioner adopts it (a league that picks this season later starts with it adopted).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string; changeId: string }> }) => {
  const { id, changeId } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id) || !isUuid(changeId)) throw new HttpError(404, "Rule change not found");
  const current = await getChange(pool, changeId);
  if (!current || current.seasonId !== id) throw new HttpError(404, "Rule change not found");
  const r = await approveChange(pool, changeId, user.id);
  if (!r) throw new HttpError(404, "Rule change not found");
  if (r.refusedStatus) throw new HttpError(409, `A ${r.refusedStatus.replace("_", " ")} record can't be approved`);
  if (r.refused) return NextResponse.json({ change: r, error: "Fix the problems listed before approving." }, { status: 409 });
  const leaguesUpdated = r.pushSeason ? await pushSeasonRuleChanges(r.pushSeason) : 0;
  return NextResponse.json({ change: r, leaguesUpdated });
});
