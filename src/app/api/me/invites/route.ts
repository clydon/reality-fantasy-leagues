import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Pending invites addressed to this account by either its username or its email -- for the
// Dashboard's "You're invited" panel.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { rows } = await pool.query(
    `SELECT li.id, li.league_id, l.name AS league_name, inv.username AS invited_by_username, li.created_at
     FROM league_invites li
     JOIN leagues l ON l.id = li.league_id
     JOIN "user" u ON u.id = $1
     LEFT JOIN "user" inv ON inv.id = li.invited_by
     WHERE li.status='pending' AND (lower(li.identifier)=lower(u.username) OR lower(li.identifier)=lower(u.email))
     ORDER BY li.created_at DESC`,
    [user.id]
  );
  return NextResponse.json({ invites: rows });
});
