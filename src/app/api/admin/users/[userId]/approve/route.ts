import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { toAdminUser, lastLoginByUserId } from "@/lib/server/admin-users";

// Early access gate (db/migrations/0058_user_approval.sql). A direct SQL update rather than
// auth.api.adminUpdateUser: `approved` is registered with `input: false` (auth.ts) specifically
// so a signup request can't set it itself, and this sidesteps relying on whether that plugin path
// treats an admin-initiated update the same as public input.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;

  const { rows } = await pool.query(
    `UPDATE "user" SET approved = true WHERE id = $1 RETURNING id, email, username, role, approved, "createdAt"`,
    [userId]
  );
  if (!rows.length) throw new HttpError(404, "User not found");

  const lastLogins = await lastLoginByUserId([userId]);
  return NextResponse.json({ user: toAdminUser(rows[0], lastLogins.get(userId) ?? null) });
});
