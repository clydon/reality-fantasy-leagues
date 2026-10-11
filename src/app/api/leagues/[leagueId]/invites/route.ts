import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { notifyInvite } from "@/lib/server/push-events";
import { groupLeagueIds } from "@/lib/server/league-groups";

// Pending invites plus anything answered in the last 30 days -- older accepted/declined rows are
// just history nobody needs in League Settings.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  const { rows } = await pool.query(
    `SELECT li.id, li.identifier, li.status, li.invited_by, u.username AS invited_by_username, li.created_at, li.responded_at, li.player_id
     FROM league_invites li LEFT JOIN "user" u ON u.id = li.invited_by
     WHERE li.league_id=$1 AND (li.status='pending' OR li.responded_at > now() - interval '30 days')
     ORDER BY li.created_at DESC`,
    [leagueId]
  );
  return NextResponse.json({ invites: rows });
});

// Any member can invite, not just the commissioner. The invitee may not have an account yet, so
// the identifier is stored as typed and matched against username/email when they sign in.
//
// `playerId` hands over an existing seat instead -- a computer player, or any seat with no account
// behind it -- so whoever accepts takes over its team and history (joinLeague). Commissioner only.
//
// `allLinked` invites them to every linked league (league-groups.ts) the sender is in too -- the same
// rule as inviting from each one in turn. Leagues they're already in, or already invited to, are
// skipped rather than failing the lot; it only fails when there was nowhere left to invite them.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { identifier, playerId, allLinked } = (await req.json().catch(() => ({}))) as {
    identifier?: string;
    playerId?: string;
    allLinked?: boolean;
  };
  const trimmed = (identifier || "").trim();
  if (!trimmed) throw new HttpError(400, "Username or email required");
  if (playerId) {
    if (membership.role !== "commissioner") throw new HttpError(403, "Only the commissioner can hand over a seat");
    const seat = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(state->'players') p
                      WHERE p->>'id'=$2 AND coalesce((p->>'disabled')::boolean, false) = false) AS ok
       FROM leagues WHERE id=$1`,
      [leagueId, playerId]
    );
    if (!seat.rows[0]?.ok) throw new HttpError(404, "No such seat");
    const linked = await pool.query("SELECT 1 FROM league_memberships WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
    if (linked.rows.length) throw new HttpError(409, "That seat already belongs to someone");
  }

  // This league first, then the rest of its group that the sender is a member of. A seat hand-over
  // is about one league's seat, so it never fans out.
  let targets = [leagueId];
  if (allLinked && !playerId) {
    const { rows } = await pool.query(
      `SELECT l.id FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.user_id = $2
       WHERE l.id = ANY($1::uuid[]) AND l.id <> $3 ORDER BY l.name`,
      [await groupLeagueIds(leagueId), user.id, leagueId]
    );
    targets = [leagueId, ...rows.map((r) => r.id as string)];
  }

  const username = (user as { username?: string | null }).username ?? null;
  const sent: { league_id: string; invite: LeagueInviteRow }[] = [];
  const skipped: { league_id: string; reason: string }[] = [];
  for (const target of targets) {
    try {
      sent.push({ league_id: target, invite: await createInvite(target, user.id, trimmed, target === leagueId ? playerId : undefined) });
    } catch (e) {
      // One league on its own keeps its exact error; a group skips past it.
      if (targets.length === 1 || !(e instanceof HttpError) || e.status !== 409) throw e;
      skipped.push({ league_id: target, reason: e.message });
    }
  }
  if (!sent.length) throw new HttpError(409, "They're already in, or invited to, every linked league");

  notifyInvite(
    sent.map((s) => s.league_id),
    trimmed,
    username || user.name
  );
  const names = await leagueNames(targets);
  const here = sent.find((s) => s.league_id === leagueId);
  return NextResponse.json({
    invite: here ? { ...here.invite, invited_by_username: username } : null,
    sent: sent.map((s) => ({ league_id: s.league_id, league_name: names[s.league_id] })),
    skipped: skipped.map((s) => ({ ...s, league_name: names[s.league_id] })),
  });
});

type LeagueInviteRow = Record<string, unknown>;

async function createInvite(leagueId: string, invitedBy: string, identifier: string, playerId?: string): Promise<LeagueInviteRow> {
  const member = await pool.query(
    `SELECT 1 FROM league_memberships m JOIN "user" u ON u.id = m.user_id
     WHERE m.league_id=$1 AND (lower(u.username)=lower($2) OR lower(u.email)=lower($2))`,
    [leagueId, identifier]
  );
  if (member.rows.length) throw new HttpError(409, "They're already in this league");

  const pending = await pool.query(
    "SELECT 1 FROM league_invites WHERE league_id=$1 AND lower(identifier)=lower($2) AND status='pending'",
    [leagueId, identifier]
  );
  if (pending.rows.length) throw new HttpError(409, "They already have a pending invite");

  try {
    const { rows } = await pool.query(
      `INSERT INTO league_invites (league_id, invited_by, identifier, player_id) VALUES ($1,$2,$3,$4)
       RETURNING id, identifier, status, invited_by, created_at, responded_at, player_id`,
      [leagueId, invitedBy, identifier, playerId || null]
    );
    return rows[0];
  } catch (e) {
    // uq_league_invites_pending -- lost a race with an identical send.
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "They already have a pending invite");
    throw e;
  }
}

async function leagueNames(ids: string[]): Promise<Record<string, string>> {
  const { rows } = await pool.query("SELECT id, name FROM leagues WHERE id = ANY($1::uuid[])", [ids]);
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
