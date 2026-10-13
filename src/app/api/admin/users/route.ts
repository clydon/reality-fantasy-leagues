import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { toAdminUser, lastLoginByUserId } from "@/lib/server/admin-users";
import { placeholderEmail } from "@/lib/no-email";

// Port of SurvivorDraft's server/routes/admin.js GET/POST /users -- now backed by Better Auth's
// admin plugin (auth.api.listUsers/createUser) instead of raw SQL against a custom users table.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const result = await auth.api.listUsers({ query: { sortBy: "username", limit: 1000 }, headers: req.headers });
  const lastLogins = await lastLoginByUserId();
  return NextResponse.json({ users: result.users.map((u) => toAdminUser(u, lastLogins.get(u.id) ?? null)) });
});

// Better Auth's admin plugin requires a real email to create a user; SurvivorDraft's original
// flow only ever collected a username. Uses the same placeholder-email convention as a
// username-only signup (no-email.ts) -- same reserved .invalid domain, recognized by
// isPlaceholderEmail() so it's exempted from requireEmailVerification (auth.ts) instead of
// permanently locking the account out with no real inbox to verify.
export const POST = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  if (!username || username.trim().length < 2) throw new HttpError(400, "Username must be at least 2 characters");
  const trimmed = username.trim();
  const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const result = await auth.api.createUser({
    body: {
      email: placeholderEmail(trimmed),
      name: trimmed,
      password: tempPassword,
      data: { username: trimmed, displayUsername: trimmed },
    },
    headers: req.headers,
  });

  return NextResponse.json({ user: toAdminUser(result.user), tempPassword });
});
