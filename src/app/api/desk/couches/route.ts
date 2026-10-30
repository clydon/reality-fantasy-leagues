import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskCouches } from "@/lib/server/desk-couches";

// Find › Couches (docs/PLAN-desk-parity.md part 6d): a page of every couch, searched by its name or who runs it (q), filtered
// (f=all|nobody|new|deleted: deleted ones within their 30 days) and sorted (sort=new|big|name), 25 at a time (offset, limit);
// counts=0 leaves the chips' counts out.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await deskCouches({ q: p.get("q"), f: p.get("f"), sort: p.get("sort"), offset: p.get("offset"), limit: p.get("limit"), counts: p.get("counts") !== "0" }));
});
