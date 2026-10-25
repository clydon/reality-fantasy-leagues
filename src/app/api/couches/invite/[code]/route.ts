import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { couchInvite } from "@/lib/server/couch-joins";

// What an invite code opens on (step 9): the couch (its name, who's on it, whose code it is) and the games it's playing
// with who may join each. Open signed out, since the code is the key: a signed-out invite shows the couch first.
// Nothing about any episode's results.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params;
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  return NextResponse.json(await couchInvite(code, session?.user ?? null));
});
