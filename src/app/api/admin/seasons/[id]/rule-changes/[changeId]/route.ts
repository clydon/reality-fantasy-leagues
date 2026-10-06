import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { deleteChange, getChange, saveChange } from "@db/season-rule-changes.js";
import { pushSeasonRuleChanges } from "@/lib/server/season-rule-changes";
import type { SeasonCheck } from "@/lib/game/formats/season-check";

type RouteParams = { id: string; changeId: string };

// The change, checked to belong to the season in the URL (an id from another season is "not found").
async function changeIn(id: string, changeId: string) {
  if (!isUuid(id) || !isUuid(changeId)) throw new HttpError(404, "Rule change not found");
  const change = await getChange(pool, changeId);
  if (!change || change.seasonId !== id) throw new HttpError(404, "Rule change not found");
  return change;
}

export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id, changeId } = await params;
  await requireSuperAdmin(req);
  return NextResponse.json({ change: await changeIn(id, changeId) });
});

// Saves the review screen's edits: the answer's rows and the effective episode. An approved change
// must stay approvable; it's re-offered to the season's leagues (what each ADOPTED stays as it was --
// its commissioner sees the newer version and decides).
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id, changeId } = await params;
  const user = await requireSuperAdmin(req);
  await changeIn(id, changeId);
  const body = (await req.json().catch(() => ({}))) as { proposal?: unknown; effectiveEpisode?: unknown };
  if (!body.proposal || typeof body.proposal !== "object" || Array.isArray(body.proposal)) throw new HttpError(400, "proposal required");
  const ep = body.effectiveEpisode;
  if (ep != null && !(typeof ep === "number" && Number.isInteger(ep) && ep >= 1)) throw new HttpError(400, "effectiveEpisode must be an episode number");
  const saved = await saveChange(pool, changeId, body.proposal as SeasonCheck, { effectiveEpisode: typeof ep === "number" ? ep : undefined }, user.id);
  if (!saved) throw new HttpError(404, "Rule change not found");
  if (saved.refusedStatus) throw new HttpError(409, `A ${saved.refusedStatus.replace("_", " ")} record can't be edited`);
  if (saved.refused) {
    return NextResponse.json({ change: saved, error: "An approved change has to stay valid: fix the problems listed and save again." }, { status: 409 });
  }
  const push = saved.pushSeason ? await pushSeasonRuleChanges(saved.pushSeason) : { updated: 0, failed: [] };
  return NextResponse.json({ change: saved, leaguesUpdated: push.updated, leaguesFailed: push.failed });
});

// A draft or a no-change record. An approved change is withdrawn instead (see ./withdraw).
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id, changeId } = await params;
  await requireSuperAdmin(req);
  await changeIn(id, changeId);
  const r = await deleteChange(pool, changeId);
  if (r.notFound) throw new HttpError(404, "Rule change not found");
  if (r.refusedStatus) throw new HttpError(409, r.refusedStatus === "approved" ? "Withdraw an approved change instead of deleting it" : "A withdrawn change is kept on record");
  return NextResponse.json({ ok: true });
});
