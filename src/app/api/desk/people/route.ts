import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskPeople } from "@/lib/server/desk-people";

// Find › People (docs/PLAN-desk-parity.md step 1): a page of everyone, searched by name, username or email, filtered
// (all, waiting, admins, stopped) and sorted (new, active, name). ?q=&f=&sort=&offset=&limit=
export const GET = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await deskPeople(user, { q: p.get("q"), f: p.get("f"), sort: p.get("sort"), offset: p.get("offset"), limit: p.get("limit") }));
});
