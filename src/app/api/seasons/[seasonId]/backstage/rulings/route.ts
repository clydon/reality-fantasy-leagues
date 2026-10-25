import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isUuid, requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope } from "@/lib/server/backstage";
import { dropRuling, keepOldResult } from "@/lib/server/rulings";

// House rulings (step 6b), for whoever runs the games a correction reached. POST `{ decisionId, preview? }` keeps the old
// result in every one of them (tier 2: `preview` answers what changes and writes nothing); DELETE `?decision=` drops it,
// and the correction applies there again.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { decisionId?: unknown; preview?: unknown };
  if (typeof body.decisionId !== "string" || !isUuid(body.decisionId)) throw new HttpError(400, "decisionId required");
  return NextResponse.json(await keepOldResult(scope, body.decisionId, { preview: body.preview === true }));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await backstageScope(user, seasonId, q.get("couch"));
  const decision = q.get("decision") ?? "";
  if (!isUuid(decision)) throw new HttpError(400, "decision required");
  return NextResponse.json(await dropRuling(scope, decision));
});
