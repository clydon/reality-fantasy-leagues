import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { gifsFor } from "@/lib/server/gifs";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { readLaps, takeBackLap, takeLap } from "@/lib/server/sports/laps";

// The victory lap (docs/PLAN-sports-couch.md C3; src/lib/server/sports/laps.ts): GET `?couch=&league=&teams=` your open laps and the
// couch's; POST `?couch=` { league, event, team, gif?, line? } takes one, { …, skip: true } is Not this time; DELETE
// `?couch=&league=&event=` takes yours back. Ours, and the provider's cached schedules for the finals (no new kind of ESPN call);
// nothing kept at the edge.
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
const NO_STORE = { "Cache-Control": "private, no-store" };

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const league = (q.get("league") ?? "").toLowerCase();
  const teams = (q.get("teams") ?? "").split(",").filter(Boolean).slice(0, 16);
  return NextResponse.json({ ...(await readLaps(user, couchOf(req), league, teams, providersOf(req))), gifs: !!gifsFor(req) }, { headers: NO_STORE });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Send { league, event, team, gif?, line? }");
  return NextResponse.json(await takeLap(user, couchOf(req), body as Record<string, unknown>, gifsFor(req), providersOf(req)), { headers: NO_STORE });
});

export const DELETE = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  await takeBackLap(user, couchOf(req), (q.get("league") ?? "").toLowerCase(), q.get("event") ?? "");
  return NextResponse.json({ ok: true });
});
