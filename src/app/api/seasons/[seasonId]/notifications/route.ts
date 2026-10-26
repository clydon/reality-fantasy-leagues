import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, requireAuth, requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { readShowNotify, saveShowNotify } from "@/lib/server/notify-prefs";

// A show's Notifications, from its ⋯ menu (docs/PLAN-new-design.md step 15 part 2; notify-prefs.ts): each of the show's moments,
// on or off for this show alone (and whether it's on for you at all, in Settings). PUT { moment, on }.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await readShowNotify(user.id, seasonId));
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const session = await requireAuthSession(req);
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their notifications are theirs to change.");
  const body = (await req.json().catch(() => ({}))) as { moment?: unknown; on?: unknown };
  return NextResponse.json(await saveShowNotify(session.user.id, seasonId, body));
});
