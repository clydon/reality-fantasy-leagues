import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";

// Port of SurvivorDraft's server/routes/admin.js POST /users/:userId/reset-password, now via
// Better Auth's admin plugin (auth.api.setUserPassword).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;
  const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  await auth.api.setUserPassword({ body: { userId, newPassword: tempPassword }, headers: req.headers });
  return NextResponse.json({ tempPassword });
});
