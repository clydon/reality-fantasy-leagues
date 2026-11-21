import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, requireAuth, requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { muteShow, readShowNotify, restoreMute, saveShowNotify } from "@/lib/server/notify-prefs";

// A show's Notifications, from its ⋯ menu (docs/PLAN-new-design.md step 15 part 2; settings Round 1; notify-prefs.ts): muting the
// show, and each of its moments on or off for this show alone (and whether it's on for you at all, in Your settings).
// PUT { moment, on } | { mute: "day" | "week" | "forever" | null } | { muteUntil } (Undo: the mute exactly as it was).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await readShowNotify(user.id, seasonId));
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const session = await requireAuthSession(req);
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their notifications are theirs to change.");
  const body = (await req.json().catch(() => ({}))) as { moment?: unknown; on?: unknown; mute?: unknown; muteUntil?: unknown };
  if ("mute" in body) return NextResponse.json(await muteShow(session.user.id, seasonId, body.mute));
  if ("muteUntil" in body) return NextResponse.json(await restoreMute(session.user.id, seasonId, body.muteUntil));
  return NextResponse.json(await saveShowNotify(session.user.id, seasonId, body));
});
