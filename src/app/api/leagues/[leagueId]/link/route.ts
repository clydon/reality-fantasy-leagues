import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isSuperAdminUser } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { groupLeagueIds, linkProblem } from "@/lib/server/league-groups";
import type { LeagueState } from "@/lib/game/types";

// Linked leagues (db/migrations/0040, league-groups.ts): League Settings' "Linked leagues".
//   GET    -- this league's group, and the caller's other leagues it could join, each with why not
//             (if it can't) and who would newly share the chat (the warning before linking).
//   POST   -- { otherLeagueId }: link the two. The caller must be a commissioner of both (or a site
//             admin); the other league must be unlinked, or already in this league's group.
//   DELETE -- take this league out of its group (its chat goes back to just its own messages).

type Row = { id: string; name: string; state: LeagueState; group_id: string | null };

async function leagueRows(ids: string[]): Promise<Row[]> {
  const { rows } = await pool.query("SELECT id, name, state, group_id FROM leagues WHERE id = ANY($1::uuid[])", [ids]);
  return rows;
}

async function membersOf(ids: string[]): Promise<Map<string, string>> {
  const { rows } = await pool.query(
    `SELECT DISTINCT m.user_id, COALESCE(u.username, u.name) AS name FROM league_memberships m JOIN "user" u ON u.id = m.user_id
      WHERE m.league_id = ANY($1::uuid[])`,
    [ids]
  );
  return new Map(rows.map((r) => [r.user_id as string, r.name as string]));
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const groupIds = await groupLeagueIds(leagueId);
  const group = await leagueRows(groupIds);
  const self = group.find((l) => l.id === leagueId)!;

  // Candidates: the caller's other leagues where they're commissioner, not already in this group.
  const { rows: mine } = await pool.query(
    "SELECT league_id FROM league_memberships WHERE user_id = $1 AND role = 'commissioner' AND NOT (league_id = ANY($2::uuid[]))",
    [user.id, groupIds]
  );
  const candidates = await leagueRows(mine.map((r) => r.league_id));
  const inGroup = await membersOf(groupIds);
  const out = [];
  for (const c of candidates) {
    const theirs = await membersOf([c.id]);
    out.push({
      id: c.id,
      name: c.name,
      problem: c.group_id ? "Already linked to other leagues — unlink it there first." : linkProblem(self.state, c.state),
      // Who'd newly see each side's chat.
      joiningUs: [...theirs].filter(([id]) => !inGroup.has(id)).map(([, n]) => n),
      joiningThem: [...inGroup].filter(([id]) => !theirs.has(id)).map(([, n]) => n),
    });
  }
  return NextResponse.json({
    linked: group.filter((l) => l.id !== leagueId).map((l) => ({ id: l.id, name: l.name })),
    candidates: out.sort((a, b) => Number(!!a.problem) - Number(!!b.problem) || a.name.localeCompare(b.name)),
  });
});

async function requireCommissionerOf(user: Parameters<typeof isSuperAdminUser>[0], leagueId: string) {
  if (isSuperAdminUser(user)) return;
  const { rows } = await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
  if (rows[0]?.role !== "commissioner") throw new HttpError(403, "You need to be a commissioner of both leagues to link them.");
}

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { otherLeagueId } = (await req.json().catch(() => ({}))) as { otherLeagueId?: string };
  if (!otherLeagueId || otherLeagueId === leagueId) throw new HttpError(400, "otherLeagueId required");
  await requireCommissionerOf(user, otherLeagueId);

  const [self, other] = await Promise.all([leagueRows([leagueId]), leagueRows([otherLeagueId])]).then(([a, b]) => [a[0], b[0]]);
  if (!other) throw new HttpError(404, "League not found");
  if (other.group_id && other.group_id !== self.group_id) throw new HttpError(400, "That league is already linked to other leagues — unlink it there first.");
  const problem = linkProblem(self.state, other.state);
  if (problem) throw new HttpError(400, problem);

  let groupId = self.group_id;
  if (!groupId) {
    const { rows } = await pool.query("INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id", [user.id]);
    groupId = rows[0].id as string;
    await pool.query("UPDATE leagues SET group_id = $1 WHERE id = $2", [groupId, leagueId]);
  }
  await pool.query("UPDATE leagues SET group_id = $1 WHERE id = $2", [groupId, otherLeagueId]);
  return NextResponse.json({ ok: true });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  await pool.query("UPDATE leagues SET group_id = NULL WHERE id = $1", [leagueId]);
  // A group left with one league isn't a link any more.
  await pool.query(
    `UPDATE leagues SET group_id = NULL WHERE group_id IN (SELECT group_id FROM leagues WHERE group_id IS NOT NULL GROUP BY group_id HAVING count(*) = 1)`
  );
  await pool.query("DELETE FROM league_groups g WHERE NOT EXISTS (SELECT 1 FROM leagues l WHERE l.group_id = g.id)");
  return NextResponse.json({ ok: true });
});
