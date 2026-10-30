import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { labCheck, labOptions, labStart } from "@/lib/server/engine-lab";

// The engine lab (docs/PLAN-start-a-game-gpt.md step A5; engine-lab.ts), site admins only:
//   GET                                                   the seasons that are games, the couches a test game can go on, the
//                                                         capability tracker's rows
//   POST { action: "check", seasonId, spec, row? }        the validator's verdict on that season, the game in words, the row's status
//   POST { action: "start", seasonId, couchId, spec }     the spec as a test game on the admin's test couch or a zt- fixture's
export const GET = apiRoute(async (req) => {
  const user = await requireDesk(req);
  return NextResponse.json(await labOptions(user));
});

export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; seasonId?: unknown; couchId?: unknown; spec?: unknown; row?: unknown };
  if (body.action === "start") return NextResponse.json(await labStart(user, body));
  return NextResponse.json(await labCheck(body));
});
