import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { startCouch } from "@/lib/server/couch-joins";

// Start a couch (docs/PLAN-new-design.md step 9): body { name }. You own it; answers { id, name, code } (your code to send).
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  return NextResponse.json(await startCouch(user, name));
});
