import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, isSuperAdminUser } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { withViewAs } from "@/lib/server/view-as";

// View as (view-as.ts): body { as: "player" | "commissioner" } starts it, for a site admin as themselves; DELETE ends it.
// Both read the real session (requireSession answers as the lens), and answer { ok } with this device's cookie set or cleared.
async function admin(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new HttpError(401, "Not logged in");
  if (!isSuperAdminUser(session.user) || isImpersonating(session)) throw new HttpError(403, "Super-admin only");
  return session.user;
}

export const POST = apiRoute(async (req) => {
  const user = await admin(req);
  const { as } = (await req.json().catch(() => ({}))) as { as?: unknown };
  if (as !== "player" && as !== "commissioner") throw new HttpError(400, "as must be player or commissioner");
  return withViewAs(NextResponse.json({ ok: true }), as, user.id);
});

export const DELETE = apiRoute(async (req) => {
  const user = await admin(req);
  return withViewAs(NextResponse.json({ ok: true }), null, user.id);
});
