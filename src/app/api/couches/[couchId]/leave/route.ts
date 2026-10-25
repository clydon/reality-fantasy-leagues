import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { leaveCouch } from "@/lib/server/couch-joins";

// Leave a couch (step 9, tier 3): body { preview } says what it would do (your games there, the last-Commissioner
// guard); without it you're off the couch and out of its games (restorable from Recent changes for 30 days).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  const { preview } = (await req.json().catch(() => ({}))) as { preview?: boolean };
  return NextResponse.json(await leaveCouch(user, couchId, !!preview));
});
