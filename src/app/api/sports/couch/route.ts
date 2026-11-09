import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { couchTeams } from "@/lib/server/sports/team-follows";

// A couch's teams (docs/PLAN-start-a-game-gpt.md U1's sports slice; team-follows.ts couchTeams): `?couch=`, those anyone on it
// follows and those in the games it plays, yours first. What the guide's Sports leads with and a team's rivals put first.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const couch = new URL(req.url).searchParams.get("couch") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(couch)) throw new HttpError(400, "Say which couch: ?couch=");
  return NextResponse.json({ teams: await couchTeams(user.id, couch) });
});
