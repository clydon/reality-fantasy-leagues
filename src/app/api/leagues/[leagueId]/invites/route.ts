import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { notifyInvite } from "@/lib/server/push-events";

// Pending invites plus anything answered in the last 30 days -- older accepted/declined rows are
// just history nobody needs in League Settings.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  const { rows } = await pool.query(
    `SELECT li.id, li.identifier, li.status, li.invited_by, u.username AS invited_by_username, li.created_at, li.responded_at
     FROM league_invites li LEFT JOIN "user" u ON u.id = li.invited_by
     WHERE li.league_id=$1 AND (li.status='pending' OR li.responded_at > now() - interval '30 days')
     ORDER BY li.created_at DESC`,
    [leagueId]
  );
  return NextResponse.json({ invites: rows });
});

// Any member can invite, not just the commissioner. The invitee may not have an account yet, so
// the identifier is stored as typed and matched against username/email when they sign in.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { identifier } = (await req.json().catch(() => ({}))) as { identifier?: string };
  const trimmed = (identifier || "").trim();
  if (!trimmed) throw new HttpError(400, "Username or email required");

  const member = await pool.query(
    `SELECT 1 FROM league_memberships m JOIN "user" u ON u.id = m.user_id
     WHERE m.league_id=$1 AND (lower(u.username)=lower($2) OR lower(u.email)=lower($2))`,
    [leagueId, trimmed]
  );
  if (member.rows.length) throw new HttpError(409, "They're already in this league");

  const pending = await pool.query(
    "SELECT 1 FROM league_invites WHERE league_id=$1 AND lower(identifier)=lower($2) AND status='pending'",
    [leagueId, trimmed]
  );
  if (pending.rows.length) throw new HttpError(409, "They already have a pending invite");

  try {
    const { rows } = await pool.query(
      `INSERT INTO league_invites (league_id, invited_by, identifier) VALUES ($1,$2,$3)
       RETURNING id, identifier, status, invited_by, created_at, responded_at`,
      [leagueId, user.id, trimmed]
    );
    const username = (user as { username?: string | null }).username ?? null;
    notifyInvite(leagueId, trimmed, username || user.name);
    return NextResponse.json({ invite: { ...rows[0], invited_by_username: username } });
  } catch (e) {
    // uq_league_invites_pending -- lost a race with an identical send.
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "They already have a pending invite");
    throw e;
  }
});
