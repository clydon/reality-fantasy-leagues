import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, requireAuthSession, isImpersonating } from "@/lib/server/auth-helpers";
import { markNotesRead, readNotes } from "@/lib/server/notify-prefs";

// The bell (docs/PLAN-new-design.md step 15 part 2; notify-prefs.ts): what's happened on your couches since you last looked,
// read when it opens, each notice as the spoiler guard lets it out now. POST marks them read (opening the bell does).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await readNotes(user.id));
});

export const POST = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  // Someone viewing the app as you can look, and leaves your count as it was.
  if (!isImpersonating(session)) await markNotesRead(session.user.id);
  return NextResponse.json({ ok: true });
});
