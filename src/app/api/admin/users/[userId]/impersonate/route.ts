import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js POST /users/:userId/impersonate, now via Better
// Auth's admin plugin (auth.api.impersonateUser) -- that plugin already enforces "can't
// impersonate yourself" and "can't nest impersonation" (once impersonating, the session reflects
// the impersonated account, which fails the super-admin check on this same route), same
// protections the original hand-rolled version had.
//
// asResponse: true is required here specifically -- impersonation works by swapping the session
// cookie, and only the raw Response Better Auth builds carries the right Set-Cookie header.
// Returning it directly (rather than re-parsing it into a NextResponse) is the simplest way to
// not lose that.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;
  try {
    return await auth.api.impersonateUser({ body: { userId }, headers: req.headers, asResponse: true });
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Could not impersonate that user");
  }
});
