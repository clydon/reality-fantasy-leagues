import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskReports } from "@/lib/server/desk-reports";

// Find › Reports (docs/PLAN-desk-parity.md step 2): a page of the reports people sent, open or done (f=open|done), searched by
// what it says or who sent it (q), newest first, 25 at a time (offset, limit); counts=0 leaves the chips' counts out.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await deskReports({ q: p.get("q"), f: p.get("f"), offset: p.get("offset"), limit: p.get("limit"), counts: p.get("counts") !== "0" }));
});
