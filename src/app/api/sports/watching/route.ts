import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { couchWatching, setWatching } from "@/lib/server/sports/watching";

// Who on a couch is watching a game now (docs/PLAN-sports-couch.md C2; src/lib/server/sports/watching.ts). Ours only, no ESPN.
const couchOf = (req: Request) => {
  const couch = new URL(req.url).searchParams.get("couch") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(couch)) throw new HttpError(400, "Say which couch: ?couch=");
  return couch;
};

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const league = (new URL(req.url).searchParams.get("league") ?? "").toLowerCase();
  return NextResponse.json({ watching: await couchWatching(user, couchOf(req), league) }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Send { league, game, on }");
  return NextResponse.json({ watching: await setWatching(user, couchOf(req), body as Record<string, unknown>) });
});
