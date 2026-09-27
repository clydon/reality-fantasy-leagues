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

// When each account last used the app: the later of its last authenticated request
// (user_last_seen, stamped by requireSession -- see auth-helpers.ts) and its last real sign-in
// (newest session row, which also covers anyone not seen since that table existed). Impersonation
// never counts toward either.
export async function lastLoginByUserId(userIds?: string[]): Promise<Map<string, string>> {
  const filter = userIds ? `WHERE u.id = ANY($1)` : "";
  const { rows } = await pool.query(
    `SELECT u.id AS "userId",
            GREATEST(
              (SELECT last_seen_at FROM user_last_seen ls WHERE ls.user_id = u.id),
              (SELECT MAX(s."createdAt") FROM session s WHERE s."userId" = u.id AND s."impersonatedBy" IS NULL)
            ) AS last_login_at
       FROM "user" u ${filter}`,
    userIds ? [userIds] : []
  );
  return new Map(
    rows.filter((r) => r.last_login_at).map((r) => [r.userId as string, new Date(r.last_login_at).toISOString()])
  );
}
