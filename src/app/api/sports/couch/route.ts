import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { couchFollows } from "@/lib/server/sports/team-follows";

// A couch's teams and leagues (docs/PLAN-start-a-game-gpt.md U1's sports slice, docs/PLAN-sports-couch.md A3; team-follows.ts
// couchFollows): `?couch=`, the teams anyone on it follows and those in the games it plays, yours first, and the leagues anyone on
// it follows, with who. What the guide's Sports leads with, a team's rivals put first, and a league's sheet shows as its fans.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const couch = new URL(req.url).searchParams.get("couch") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(couch)) throw new HttpError(400, "Say which couch: ?couch=");
  return NextResponse.json(await couchFollows(user.id, couch));
});
