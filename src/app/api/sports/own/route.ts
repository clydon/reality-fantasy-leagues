import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { ownCalls, pickOwn } from "@/lib/server/sports/own";

// A fan's own calls and season calls (docs/PLAN-sports-couch.md C4; src/lib/server/sports/own.ts): GET `?league=&teams=` your calls on
// those teams this season, your season calls and the teams' regular seasons; POST { league, team, event, side } your call, or
// { league, team, wins } the season call. Ours, and the provider's cached schedules (no new kind of ESPN call); nothing kept at the edge.
const providersOf = (req: Request) => {
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return sports ? { providers: sportsProviders({ base: sports }) } : {};
};

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const league = (q.get("league") ?? "").toLowerCase();
  const teams = (q.get("teams") ?? "").split(",").filter(Boolean).slice(0, 8);
  return NextResponse.json(await ownCalls(user, league, teams, providersOf(req)), { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Send { league, team, event, side } or { league, team, wins }");
  return NextResponse.json(await pickOwn(user, body as Record<string, unknown>, providersOf(req)));
});
