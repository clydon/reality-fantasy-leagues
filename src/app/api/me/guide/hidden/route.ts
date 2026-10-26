import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { setHidden } from "@/lib/server/guide";

// Hide from guide (docs/PLAN-new-design.md step 11 part 1; db/migrations/0125, guide.ts): body { seasonId | showId, hidden } for a
// show here, or { tvmazeId, name, hidden } for a TV listing. Your own shows stay on your guide (409). Answers { hidden }:
// what's hidden now (the home read carries the same list).
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof setHidden>[1];
  return NextResponse.json({ hidden: await setHidden(user.id, body) });
});
