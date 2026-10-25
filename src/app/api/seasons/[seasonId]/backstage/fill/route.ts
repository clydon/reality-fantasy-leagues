import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope } from "@/lib/server/backstage";
import { setWhoFills } from "@/lib/server/community-results";

// Who can fill in results on the couch (step 6b): `{ anyone: true }` (anyone on it, the default) or `{ anyone: false }`
// (only people who run games). Whoever runs a game here; a line in Recent changes for the couch's games you run.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { anyone?: unknown };
  if (typeof body.anyone !== "boolean") throw new HttpError(400, "anyone must be true or false");
  return NextResponse.json(await setWhoFills(scope.user.id, scope.couchId, scope.games.map((g) => g.leagueId), body.anyone));
});
