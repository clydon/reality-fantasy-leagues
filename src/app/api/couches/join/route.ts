import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isApprovedUser, isSuperAdminUser, requireSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { joinCouch } from "@/lib/server/couch-joins";
import { invitesLetIn } from "@/lib/signups";
import { signupMode } from "@/lib/server/way-in";

// Join a couch with a code (step 9): body { code }, a couch's invite or one of its games' join codes. Answers
// { couchId, name, already }. An account still waiting to get in (early access) gets in with the code when the desk's
// Who gets in lets invites in (part 2); otherwise it keeps waiting.
export const POST = apiRoute(async (req) => {
  const { user } = await requireSession(req);
  const waiting = !isSuperAdminUser(user) && !isApprovedUser(user);
  if (waiting && !invitesLetIn(await signupMode())) throw new HttpError(403, "Pending approval");
  const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
  return NextResponse.json(await joinCouch(user, code, { letIn: waiting }));
});
