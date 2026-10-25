import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { askToJoin, joinGame, joinOptions, withdrawAsk } from "@/lib/server/couch-joins";

type Params = { params: Promise<{ couchId: string; leagueId: string }> };

// Joining a game on the couch (step 9).
//   GET  ?start=N   where you can start (live, or catch up from the first episode when castaways can be on several teams)
//                   and, for a start, the castaways to pick your team from
//   POST { action: "join", start, team } | { action: "ask" } | { action: "withdraw" }
export const GET = apiRoute(async (req, { params }: Params) => {
  const { couchId, leagueId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await joinOptions(user, couchId, leagueId, new URL(req.url).searchParams.get("start")));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { couchId, leagueId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: string; start?: unknown; team?: unknown };
  if (body.action === "join") return NextResponse.json(await joinGame(user, couchId, leagueId, body));
  if (body.action === "ask") return NextResponse.json(await askToJoin(user, couchId, leagueId));
  if (body.action === "withdraw") return NextResponse.json(await withdrawAsk(user, couchId, leagueId));
  throw new HttpError(400, "action must be join, ask or withdraw");
});
