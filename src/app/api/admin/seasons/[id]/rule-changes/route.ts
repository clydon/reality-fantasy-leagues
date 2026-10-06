import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { listChanges, recordCheck, researchFlags } from "@db/season-rule-changes.js";

// Season rule changes (docs/PLAN-season-rule-changes.md): the checks recorded for one season, and a new
// one from a pasted chat answer. Super-admin only, like the rest of a season's pipeline.

type RouteParams = { id: string };

export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  return NextResponse.json({ changes: await listChanges(pool, id), flags: await researchFlags(pool, id) });
});

// A pasted answer is recorded as a draft to review -- or, when it found nothing new, as a no_change
// record straight away. Nothing reaches research or a league until a draft is approved.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as { answer?: unknown };
  if (typeof body.answer !== "string" || !body.answer.trim()) throw new HttpError(400, "Paste the chat's answer first");
  let change;
  try {
    change = await recordCheck(pool, id, body.answer, user.id);
  } catch (e) {
    // parseCheck's errors are written for the person who pasted ("There's no JSON object...").
    if (e instanceof Error && !("code" in e)) throw new HttpError(400, e.message);
    throw e;
  }
  if (!change) throw new HttpError(404, "Season not found");
  return NextResponse.json({ change });
});
