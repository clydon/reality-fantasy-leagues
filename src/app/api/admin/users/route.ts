import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { toAdminUser, lastLoginByUserId } from "@/lib/server/admin-users";

// Port of SurvivorDraft's server/routes/admin.js GET/POST /users -- now backed by Better Auth's
// admin plugin (auth.api.listUsers/createUser) instead of raw SQL against a custom users table.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const result = await auth.api.listUsers({ query: { sortBy: "username", limit: 1000 }, headers: req.headers });
  const lastLogins = await lastLoginByUserId();
  return NextResponse.json({ users: result.users.map((u) => toAdminUser(u, lastLogins.get(u.id) ?? null)) });
});

// Better Auth's admin plugin requires a real email to create a user; SurvivorDraft's original
// flow only ever collected a username. Synthesizes a non-deliverable placeholder email (.invalid
// is reserved by RFC 2606 for exactly this) so the create-by-username-only UX still works --
// known limitation, not a real account-recovery email until the admin sets a real one later.
export const POST = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  if (!username || username.trim().length < 2) throw new HttpError(400, "Username must be at least 2 characters");
  const trimmed = username.trim();
  const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const result = await auth.api.createUser({
    body: {
      email: `${trimmed}@placeholder.invalid`,
      name: trimmed,
      password: tempPassword,
      data: { username: trimmed, displayUsername: trimmed },
    },
    headers: req.headers,
  });

  return NextResponse.json({ user: toAdminUser(result.user), tempPassword });
});
