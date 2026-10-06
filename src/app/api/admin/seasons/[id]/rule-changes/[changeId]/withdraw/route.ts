import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { getChange, withdrawChange } from "@db/season-rule-changes.js";
import { pushSeasonRuleChanges } from "@/lib/server/season-rule-changes";

// Takes an approved change back: research stops asking its questions, and it's no longer offered to
// leagues. A league that adopted it keeps its frozen copy until its commissioner removes it -- a
// withdrawal never rescores a league behind its commissioner's back.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string; changeId: string }> }) => {
  const { id, changeId } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id) || !isUuid(changeId)) throw new HttpError(404, "Rule change not found");
  const current = await getChange(pool, changeId);
  if (!current || current.seasonId !== id) throw new HttpError(404, "Rule change not found");
  const r = await withdrawChange(pool, changeId);
  if (!r.withdrawn) throw new HttpError(409, "Only an approved change can be withdrawn");
  const leaguesUpdated = r.pushSeason ? await pushSeasonRuleChanges(r.pushSeason) : 0;
  return NextResponse.json({ ok: true, leaguesUpdated });
});
