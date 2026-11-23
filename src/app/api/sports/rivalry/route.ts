import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { couchRivalries, pickRivalry } from "@/lib/server/sports/rivalry";

// A couch's rivalry games (docs/PLAN-sports-couch.md C1; src/lib/server/sports/rivalry.ts): GET `?couch=&league=` its rivalry games
// in the league with every pick (sides public, margins only once begun), POST `?couch=` { league, event, team, side, margin?, name?,
// rival? } your pick. Ours only, no ESPN; nothing kept at the edge (it's the couch's, and changes as people pick).
const couchOf = (req: Request) => {
  const couch = new URL(req.url).searchParams.get("couch") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(couch)) throw new HttpError(400, "Say which couch: ?couch=");
  return couch;
};

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const league = (new URL(req.url).searchParams.get("league") ?? "").toLowerCase();
  return NextResponse.json({ games: await couchRivalries(user, couchOf(req), league) }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Send { league, event, team, side }");
  // The game's first pick starts it on the team's season, as Start does (its provider: a check's stand-in by the header).
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return NextResponse.json({ game: await pickRivalry(user, couchOf(req), body as Record<string, unknown>, sports ? { providers: sportsProviders({ base: sports }) } : {}) });
});
