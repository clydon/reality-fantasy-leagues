import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { joinCouch } from "@/lib/server/couch-joins";

// Join a couch with a code (step 9): body { code }, a couch's invite or one of its games' join codes. Answers
// { couchId, name, already }.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
  return NextResponse.json(await joinCouch(user, code));
});
