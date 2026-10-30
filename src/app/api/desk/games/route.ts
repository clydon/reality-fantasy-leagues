import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskGames } from "@/lib/server/desk-games";

// Find › Games (docs/PLAN-desk-parity.md part 6a): a page of every game, searched by name, season, show, couch or join code
// (q; a code-shaped search finds its game whatever the filter, deleted ones within 30 days too), filtered (f=all|nobody|
// ended|archived|deleted) and sorted (sort=new|big|name), 25 at a time (offset, limit); counts=0 leaves the chips' counts out.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await deskGames({ q: p.get("q"), f: p.get("f"), sort: p.get("sort"), offset: p.get("offset"), limit: p.get("limit"), counts: p.get("counts") !== "0" }));
});
