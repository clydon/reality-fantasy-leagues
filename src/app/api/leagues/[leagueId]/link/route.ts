import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isSuperAdminUser } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { groupDisplayName, groupOrder, linkProblem } from "@/lib/server/league-groups";
import { linkedLeague, unlinkedLeague } from "@/lib/server/couches";
import type { LeagueState } from "@/lib/game/types";
import { logChange } from "@/lib/server/change-log";

// Linked leagues (db/migrations/0040, league-groups.ts): League Settings' "Linked leagues".
//   GET    -- this league's group (in its order, with its favorite -- 0046), and the caller's other
//             leagues it could join, each with why not (if it can't) and who would newly share the
//             chat (the warning before linking).
//   POST   -- { otherLeagueId }: link the two. The caller must be a commissioner of both (or a site
//             admin); the other league must be unlinked, or already in this league's group.
//   PUT    -- { order?: string[], favoriteId?: string | null, name?: string | null }: the group's order
//             (every league in it, once), the league the app opens on for its members, and its name
//             (0047; null or blank goes back to show + season). A commissioner of this league.
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
  const { ids: groupIds, favoriteId } = await groupOrder(leagueId);
  const group = await leagueRows(groupIds);
  const self = group.find((l) => l.id === leagueId)!;
  const ordered = groupIds.map((id) => group.find((l) => l.id === id)!).filter(Boolean);

  // Candidates: the caller's other leagues where they're commissioner, not already in this group.
  const { rows: mine } = await pool.query(
    "SELECT league_id FROM league_memberships WHERE user_id = $1 AND role = 'commissioner' AND NOT (league_id = ANY($2::uuid[]))",
    [user.id, groupIds]
  );
  const candidates = await leagueRows(mine.map((r) => r.league_id));
  const inGroup = await membersOf(groupIds);
  const { rows: named } = await pool.query(
    `SELECT g.name, s.name AS show_name FROM leagues l
       LEFT JOIN league_groups g ON g.id = l.group_id
       LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
      WHERE l.id = $1`,
    [leagueId]
  );
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
    linked: ordered.filter((l) => l.id !== leagueId).map((l) => ({ id: l.id, name: l.name })),
    // The whole group, this league included, in order (empty when it isn't linked).
    order: ordered.length > 1 ? ordered.map((l) => ({ id: l.id, name: l.name })) : [],
    favoriteId,
    name: (named[0]?.name as string | null) ?? null,
    defaultName: groupDisplayName(null, named[0]?.show_name ?? null, self.state.settings?.wikiSeason ?? null),
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
    await pool.query("UPDATE leagues SET group_id = $1, group_position = 0 WHERE id = $2", [groupId, leagueId]);
  }
  // Joins at the end of the group's order.
  await pool.query(
    `UPDATE leagues SET group_id = $1,
            group_position = (SELECT COALESCE(max(group_position), -1) + 1 FROM leagues WHERE group_id = $1)
      WHERE id = $2`,
    [groupId, otherLeagueId]
  );
  // A linked group is one couch (couches.ts): the other league joins this one's.
  await linkedLeague(otherLeagueId, leagueId);
  // Recent changes (step 5): in both games' logs.
  for (const id of [leagueId, otherLeagueId]) await logChange(pool, id, { userId: user.id, kind: "league", tier: 1, text: "Linked two games: one reveal and one chat" });
  return NextResponse.json({ ok: true });
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { order?: unknown; favoriteId?: unknown; name?: unknown };
  const { rows } = await pool.query("SELECT group_id FROM leagues WHERE id = $1", [leagueId]);
  const groupId = rows[0]?.group_id as string | null;
  if (!groupId) throw new HttpError(400, "This league isn't linked to any others.");
  const { ids } = await groupOrder(leagueId);

  if (body.order !== undefined) {
    const order = body.order;
    if (!Array.isArray(order) || order.length !== ids.length || new Set(order).size !== ids.length || !order.every((id) => ids.includes(id))) {
      throw new HttpError(400, "order must list every linked league once");
    }
    await pool.query(
      `UPDATE leagues l SET group_position = o.pos - 1
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, pos)
        WHERE l.id = o.id AND l.group_id = $2`,
      [order, groupId]
    );
  }
  if (body.favoriteId !== undefined) {
    const fav = body.favoriteId;
    if (fav !== null && (typeof fav !== "string" || !ids.includes(fav))) throw new HttpError(400, "favoriteId must be a linked league");
    await pool.query("UPDATE league_groups SET favorite_league_id = $1 WHERE id = $2", [fav, groupId]);
  }
  if (body.name !== undefined) {
    if (body.name !== null && typeof body.name !== "string") throw new HttpError(400, "name must be text");
    const name = body.name?.trim() || null;
    if (name && name.length > 60) throw new HttpError(400, "Keep the name to 60 characters.");
    await pool.query("UPDATE league_groups SET name = $1 WHERE id = $2", [name, groupId]);
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { rows: was } = await pool.query("SELECT group_id FROM leagues WHERE id = $1", [leagueId]);
  // A group whose favorite leaves has no favorite.
  await pool.query("UPDATE league_groups SET favorite_league_id = NULL WHERE favorite_league_id = $1", [leagueId]);
  await pool.query("UPDATE leagues SET group_id = NULL, group_position = NULL WHERE id = $1", [leagueId]);
  // A group left with one league isn't a link any more.
  await pool.query(
    `UPDATE leagues SET group_id = NULL, group_position = NULL WHERE group_id IN (SELECT group_id FROM leagues WHERE group_id IS NOT NULL GROUP BY group_id HAVING count(*) = 1)`
  );
  await pool.query("DELETE FROM league_groups g WHERE NOT EXISTS (SELECT 1 FROM leagues l WHERE l.group_id = g.id)");
  // Outside a group, a classic league is a couch of its own again (couches.ts).
  if (was[0]?.group_id) {
    await unlinkedLeague(leagueId, user.id);
    await logChange(pool, leagueId, { userId: user.id, kind: "league", tier: 1, text: "Unlinked this game from the others" });
  }
  return NextResponse.json({ ok: true });
});
