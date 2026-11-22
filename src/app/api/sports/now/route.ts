import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { sportsFor } from "@/lib/server/sports";
import { cacheControl, liveAnswer } from "@/lib/server/sports/live-proxy";
import { situationOf } from "@/lib/sports/situation";

// Where a live game stands, small (docs/PLAN-sports-couch.md A1, the hub's scores strip; docs/HOSTING.md, "The hub's scores strip"):
// `?league=football/nfl&event=401873053` answers the score, the period and clock, and football's possession and down and distance
// (situation.ts), ~200 bytes, where the game's summary is ~300 KB. It reads the summary through the live route's own poller
// (live-proxy.ts liveAnswer: one ESPN ask a game every 10 s an instance, whoever reads), and the edge keeps each answer 15 s, so
// everyone on the hub during a game shares one. Open signed out (the same for everyone); the phone asks only for a game it may show
// you live (never while you hide scores or watch it as if live: src/new/hub/scores-strip.tsx).
export const GET = apiRoute(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const league = (q.get("league") ?? "").toLowerCase();
  const event = q.get("event") ?? "";
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) || !/^[A-Za-z0-9._-]{1,40}$/.test(event)) throw new HttpError(400, "Say which game: ?league=&event=");
  const standIn = sportsFor(req);
  if (standIn === null) throw new HttpError(503, "Sports are off for this request");
  const a = await liveAnswer("site", `/apis/site/v2/sports/${league}/summary?event=${encodeURIComponent(event)}`, true, standIn ? { base: standIn } : {});
  let situation = null;
  try {
    situation = situationOf(JSON.parse(a.body));
  } catch {
    /* an answer that isn't a game's: none */
  }
  if (!situation) throw new HttpError(404, "No such game");
  return NextResponse.json({ ...situation, asOf: new Date(a.at).toISOString() }, { headers: { "Cache-Control": cacheControl(a) } });
});
