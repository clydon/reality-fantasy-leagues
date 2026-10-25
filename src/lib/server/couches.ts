import type { PoolClient } from "pg";
import { pool, HttpError } from "./db";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { groupDisplayName } from "./league-groups";

// Couches (db/migrations/0100): the lasting group of people a league is a game in, across seasons and shows.
//
// Until the couch switches to the new design, the classic app keeps them in step through the functions below,
// by the same rule 0101 filled them in with: each linked group (league-groups.ts) is one couch, each league
// outside a group is a couch of its own, and everyone in a couch's leagues is on the couch. A league made,
// joined, left, linked or unlinked in classic moves its couch to match. None of it may cost the classic action
// it follows, so each is best effort (logged on failure), and healCouches puts right whatever a failure, or a
// league made outside the app (a fixture), left behind when its people next open the new design's home.
//
// Step 9 keeps leaving a game and leaving the couch apart. Someone is on a couch either because they play one of its
// games (couch_members.via 'game') or in its own right ('couch': they started it, joined with its code, or were taken
// out of its games in the new design, where they stay on the couch). Classic's leave takes a 'game' member off once
// they're in none of its leagues, as it always has; a 'couch' member goes only by leaving the couch (couch-joins.ts).

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function inStep(what: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[couches] ${what}:`, e);
  }
}

/** A couch with members but no owner gets one: its maker if they're on it, else its earliest commissioner, else its earliest member (0101's rule). */
export async function ensureOwner(c: PoolClient, couchId: string) {
  await c.query(
    `UPDATE couch_members cm SET role = 'owner'
       FROM (SELECT m.user_id FROM couch_members m JOIN couches co ON co.id = m.couch_id
              WHERE m.couch_id = $1 AND NOT EXISTS (SELECT 1 FROM couch_members o WHERE o.couch_id = $1 AND o.role = 'owner')
              ORDER BY COALESCE(m.user_id = co.created_by, false) DESC,
                       EXISTS (SELECT 1 FROM league_memberships lm JOIN leagues l ON l.id = lm.league_id
                                WHERE l.couch_id = $1 AND lm.user_id = m.user_id AND lm.role = 'commissioner') DESC,
                       m.joined_at, m.user_id
              LIMIT 1) pick
      WHERE cm.couch_id = $1 AND cm.user_id = pick.user_id`,
    [couchId]
  );
}

/** Everyone in this league onto this couch. */
async function addLeagueMembers(c: PoolClient, couchId: string, leagueId: string) {
  await c.query(
    `INSERT INTO couch_members (couch_id, user_id, role, joined_at)
     SELECT $1, user_id, 'member', created_at FROM league_memberships WHERE league_id = $2
     ON CONFLICT (couch_id, user_id) DO NOTHING`,
    [couchId, leagueId]
  );
}

/** Off the couch: everyone there only for its games who's in none of them now (the classic rule), then an owner if it
 *  lost its own. Someone on the couch in its own right (via 'couch') stays. */
async function pruneMembers(c: PoolClient, couchId: string) {
  await c.query(
    `DELETE FROM couch_members cm WHERE cm.couch_id = $1 AND cm.via = 'game'
        AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id
                         WHERE l.couch_id = $1 AND m.user_id = cm.user_id)`,
    [couchId]
  );
  await ensureOwner(c, couchId);
}

export async function newCouch(c: PoolClient, name: string, createdBy: string | null): Promise<string> {
  // Who can fill in its results starts as the desk's default for new couches (app_settings 'new_couch_fill', step 6b).
  const { rows } = await c.query(
    `INSERT INTO couches (name, created_by, results_by_anyone)
     VALUES ($1, $2, COALESCE((SELECT value <> 'false'::jsonb FROM app_settings WHERE key = 'new_couch_fill'), true)) RETURNING id`,
    [name.slice(0, 80), createdBy]
  );
  return rows[0].id as string;
}

/** A league made in classic: a couch of its own, named after it, its maker the owner. */
export function couchForNewLeague(leagueId: string, userId: string, name: string): Promise<void> {
  return inStep(`new league ${leagueId}`, () =>
    tx(async (c) => {
      const couchId = await newCouch(c, name, userId);
      await c.query("UPDATE leagues SET couch_id = $1 WHERE id = $2 AND couch_id IS NULL", [couchId, leagueId]);
      await c.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING", [couchId, userId]);
    })
  );
}

/** Someone joined a league (a code, an invite, an admin): they're on its couch. */
export function joinedLeague(leagueId: string, userId: string): Promise<void> {
  return inStep(`join ${leagueId}`, () =>
    tx(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO couch_members (couch_id, user_id) SELECT couch_id, $2 FROM leagues WHERE id = $1 AND couch_id IS NOT NULL
         ON CONFLICT (couch_id, user_id) DO NOTHING RETURNING couch_id`,
        [leagueId, userId]
      );
      if (rows.length) await ensureOwner(c, rows[0].couch_id);
    })
  );
}

/** Someone left a league or was taken out of it: off its couch too, unless another of its leagues still has them. */
export function leftLeague(leagueId: string): Promise<void> {
  return inStep(`leave ${leagueId}`, () =>
    tx(async (c) => {
      const { rows } = await c.query("SELECT couch_id FROM leagues WHERE id = $1", [leagueId]);
      if (rows[0]?.couch_id) await pruneMembers(c, rows[0].couch_id);
    })
  );
}

/** A league was deleted (its memberships went with it): its couch loses whoever that leaves in none, and goes once it has
 *  no games and nobody on it in its own right (a couch someone started or joined stays, games or not). */
export function leagueDeleted(couchId: string | null): Promise<void> {
  if (!couchId) return Promise.resolve();
  return inStep(`deleted league's couch ${couchId}`, () =>
    tx(async (c) => {
      await pruneMembers(c, couchId);
      const { rows } = await c.query(
        "SELECT EXISTS (SELECT 1 FROM leagues WHERE couch_id = $1) OR EXISTS (SELECT 1 FROM couch_members WHERE couch_id = $1) AS keep",
        [couchId]
      );
      if (!rows[0].keep) await c.query("DELETE FROM couches WHERE id = $1", [couchId]);
    })
  );
}

/**
 * The new design took someone out of a game, or they left it there (backstage-members.ts): they stay on the couch, as
 * the mock has it. Once they're in none of its games they're on it in its own right, so classic's rule never prunes them.
 */
export function stayedOnCouch(leagueId: string, userId: string): Promise<void> {
  return inStep(`stay on ${leagueId}'s couch`, async () => {
    await pool.query(
      `UPDATE couch_members cm SET via = 'couch' FROM leagues l
        WHERE l.id = $1 AND cm.couch_id = l.couch_id AND cm.user_id = $2 AND cm.via = 'game'
          AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues o ON o.id = m.league_id WHERE o.couch_id = l.couch_id AND m.user_id = $2)`,
      [leagueId, userId]
    );
  });
}

/**
 * `leagueId` was linked into `intoLeagueId`'s group: it joins that league's couch, with its people. A couch it
 * leaves with no games is folded in (members and invite codes) and goes; one with games left keeps them and
 * loses whoever is now in none of them.
 */
export function linkedLeague(leagueId: string, intoLeagueId: string): Promise<void> {
  return inStep(`link ${leagueId} into ${intoLeagueId}`, () =>
    tx(async (c) => {
      const { rows } = await c.query("SELECT id, couch_id FROM leagues WHERE id = ANY($1::uuid[]) FOR UPDATE", [[leagueId, intoLeagueId]]);
      const from = rows.find((r) => r.id === leagueId)?.couch_id as string | null | undefined;
      const into = rows.find((r) => r.id === intoLeagueId)?.couch_id as string | null | undefined;
      if (!into || from === into) return; // no couch to join (healCouches settles it), or already there
      await c.query("UPDATE leagues SET couch_id = $1 WHERE id = $2", [into, leagueId]);
      await addLeagueMembers(c, into, leagueId);
      if (from) {
        const { rows: left } = await c.query("SELECT 1 FROM leagues WHERE couch_id = $1 LIMIT 1", [from]);
        if (left.length) {
          await pruneMembers(c, from);
        } else {
          await c.query(
            `INSERT INTO couch_members (couch_id, user_id, role, joined_at) SELECT $1, user_id, 'member', joined_at FROM couch_members WHERE couch_id = $2
             ON CONFLICT (couch_id, user_id) DO NOTHING`,
            [into, from]
          );
          await c.query("UPDATE couch_invites SET couch_id = $1 WHERE couch_id = $2", [into, from]);
          await c.query("DELETE FROM couches WHERE id = $1", [from]);
        }
      }
      await ensureOwner(c, into);
    })
  );
}

/**
 * A league was taken out of its group: outside a group it's a couch of its own again, named after it, with its
 * people (`userId`, who unlinked it, the owner when they play it). The couch it leaves keeps its other games.
 */
export function unlinkedLeague(leagueId: string, userId: string): Promise<void> {
  return inStep(`unlink ${leagueId}`, () =>
    tx(async (c) => {
      const { rows } = await c.query("SELECT name, couch_id FROM leagues WHERE id = $1 FOR UPDATE", [leagueId]);
      if (!rows.length) return;
      const from = rows[0].couch_id as string | null;
      if (from) {
        const { rows: others } = await c.query("SELECT 1 FROM leagues WHERE couch_id = $1 AND id <> $2 LIMIT 1", [from, leagueId]);
        if (!others.length) return; // already on a couch of its own
      }
      const couchId = await newCouch(c, rows[0].name, userId);
      await c.query("UPDATE leagues SET couch_id = $1 WHERE id = $2", [couchId, leagueId]);
      await addLeagueMembers(c, couchId, leagueId);
      await c.query("UPDATE couch_members SET role = 'owner' WHERE couch_id = $1 AND user_id = $2", [couchId, userId]);
      await ensureOwner(c, couchId);
      if (from) await pruneMembers(c, from);
    })
  );
}

/**
 * Puts right this person's couches before the new design reads them: a league of theirs with no couch gets
 * one (its group's, if the group has one; else a new one, named as 0101 names them), and they're on the couch
 * of every league they're in. A read with nothing to fix costs one query. A solo game (a public pool, a practice
 * couch: leagues.solo, step 9 part 3) is on no couch on purpose and is left alone.
 */
export async function healCouches(userId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT l.id, l.couch_id, (cm.user_id IS NOT NULL) AS on_couch
       FROM league_memberships m JOIN leagues l ON l.id = m.league_id
       LEFT JOIN couch_members cm ON cm.couch_id = l.couch_id AND cm.user_id = m.user_id
      WHERE m.user_id = $1 AND l.solo IS NULL AND (l.couch_id IS NULL OR cm.user_id IS NULL)`,
    [userId]
  );
  for (const r of rows) {
    await tx(async (c) => {
      const { rows: lr } = await c.query(
        `SELECT l.id, l.name, l.couch_id, l.group_id, l.created_by, g.name AS group_name, s.name AS show_name,
                l.state->'settings'->>'wikiSeason' AS season
           FROM leagues l LEFT JOIN league_groups g ON g.id = l.group_id
           LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
          WHERE l.id = $1 FOR UPDATE OF l`,
        [r.id]
      );
      const league = lr[0];
      if (!league) return;
      let couchId = league.couch_id as string | null;
      if (!couchId && league.group_id) {
        const { rows: sib } = await c.query(
          "SELECT couch_id FROM leagues WHERE group_id = $1 AND couch_id IS NOT NULL ORDER BY group_position NULLS LAST, name, id LIMIT 1",
          [league.group_id]
        );
        couchId = (sib[0]?.couch_id as string | undefined) ?? null;
      }
      if (!couchId) {
        const season = league.season == null ? null : Number(league.season);
        const name = league.group_id ? groupDisplayName(league.group_name, league.show_name, season) : league.name;
        couchId = await newCouch(c, name, league.created_by);
      }
      // The whole group comes along, so it stays one couch.
      const { rows: moved } = await c.query(
        "UPDATE leagues SET couch_id = $1 WHERE couch_id IS NULL AND (id = $2 OR (group_id IS NOT NULL AND group_id = $3)) RETURNING id",
        [couchId, league.id, league.group_id]
      );
      for (const m of moved) await addLeagueMembers(c, couchId, m.id);
      await c.query("INSERT INTO couch_members (couch_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [couchId, userId]);
      await ensureOwner(c, couchId);
    });
  }
}

export type CouchRole = "owner" | "member";

/** This person's role on a couch: owner or member, "viewer" for a site admin who isn't on it. 404 otherwise. */
export async function requireCouch(user: SessionUser, couchId: string): Promise<CouchRole | "viewer"> {
  if (!isUuid(couchId)) throw new HttpError(404, "Couch not found");
  const { rows } = await pool.query(
    "SELECT c.id, cm.role FROM couches c LEFT JOIN couch_members cm ON cm.couch_id = c.id AND cm.user_id = $2 WHERE c.id = $1",
    [couchId, user.id]
  );
  if (!rows.length) throw new HttpError(404, "Couch not found");
  if (rows[0].role) return rows[0].role as CouchRole;
  if (isSuperAdminUser(user)) return "viewer";
  throw new HttpError(404, "Couch not found");
}

export interface CouchMember {
  userId: string;
  name: string;
  role: CouchRole;
  joinedAt: string;
}

/** Everyone on these couches, by couch, owners first then by when they joined. */
export async function couchMembers(couchIds: string[]): Promise<Map<string, CouchMember[]>> {
  const out = new Map<string, CouchMember[]>(couchIds.map((id) => [id, []]));
  if (!couchIds.length) return out;
  const { rows } = await pool.query(
    `SELECT cm.couch_id, cm.user_id, COALESCE(u.username, u.name) AS name, cm.role, cm.joined_at
       FROM couch_members cm JOIN "user" u ON u.id = cm.user_id
      WHERE cm.couch_id = ANY($1::uuid[])
      ORDER BY (cm.role = 'owner') DESC, cm.joined_at, cm.user_id`,
    [couchIds]
  );
  for (const r of rows) {
    out.get(r.couch_id)?.push({ userId: r.user_id, name: r.name, role: r.role, joinedAt: new Date(r.joined_at).toISOString() });
  }
  return out;
}
