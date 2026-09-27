import type { AdminUser } from "@/lib/game/types";
import { pool } from "./db";

export function toAdminUser(
  u: { id: string; email: string; createdAt: Date | string; username?: string | null; role?: string | null },
  lastLoginAt: string | null = null
): AdminUser {
  return {
    id: u.id,
    username: u.username ?? null,
    email: u.email,
    isSuperAdmin: u.role === "admin",
    createdAt: typeof u.createdAt === "string" ? u.createdAt : u.createdAt.toISOString(),
    lastLoginAt,
  };
}

// Better Auth writes a new session row on every sign-in, so the newest session's createdAt is
// the last login -- no extra column to maintain. (Sessions deleted on sign-out/expiry cleanup
// take their timestamps with them, so this is "most recent surviving session", close enough
// for an admin table.)
export async function lastLoginByUserId(userIds?: string[]): Promise<Map<string, string>> {
  const { rows } = userIds
    ? await pool.query(`SELECT "userId", MAX("createdAt") AS last_login_at FROM session WHERE "userId" = ANY($1) AND "impersonatedBy" IS NULL GROUP BY "userId"`, [userIds])
    : await pool.query(`SELECT "userId", MAX("createdAt") AS last_login_at FROM session WHERE "impersonatedBy" IS NULL GROUP BY "userId"`);
  return new Map(rows.map((r) => [r.userId as string, new Date(r.last_login_at).toISOString()]));
}
