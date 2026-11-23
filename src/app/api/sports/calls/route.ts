import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { couchCalls, pickCall } from "@/lib/server/sports/calls";

// A couch's fans' calls (docs/PLAN-sports-couch.md C2; src/lib/server/sports/calls.ts): GET `?couch=&league=&teams=` this season's call
// and rivalry games with their picks and finals, POST `?couch=` { league, event, team, side } your call, back or fade. Ours, and the
// provider's cached schedules for the finals (no new kind of ESPN call); nothing kept at the edge (it changes as people pick).
const couchOf = (req: Request) => {
  const couch = new URL(req.url).searchParams.get("couch") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(couch)) throw new HttpError(400, "Say which couch: ?couch=");
  return couch;
};
const providersOf = (req: Request) => {
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return sports ? { providers: sportsProviders({ base: sports }) } : {};
};

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const league = (q.get("league") ?? "").toLowerCase();
  const teams = (q.get("teams") ?? "").split(",").filter(Boolean).slice(0, 16);
  return NextResponse.json({ games: await couchCalls(user, couchOf(req), league, teams, providersOf(req)) }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Send { league, event, team, side }");
  return NextResponse.json({ game: await pickCall(user, couchOf(req), body as Record<string, unknown>, providersOf(req)) });
});
