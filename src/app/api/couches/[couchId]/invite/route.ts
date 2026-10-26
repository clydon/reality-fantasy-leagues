import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { inviteCode, newInviteCode } from "@/lib/server/couch-joins";

// Your invite code for this couch (step 9): anyone on it can invite. Made the first time it's asked for.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await inviteCode(user, couchId));
});

// A new code (step 15 part 1): yours is retired and stops working, and a new one is made.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await newInviteCode(user, couchId));
});
