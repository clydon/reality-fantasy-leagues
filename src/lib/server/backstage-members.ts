import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { dropBlindPicksForPlayer } from "./blind-draft";
import { roleChange, type ChangeSpec, type MemberUndo } from "./change-log";
import { leftLeague } from "./couches";
import { pool, withLeagueLock, HttpError } from "./db";
import { couchGames } from "./league-changes";
import { leagueStates } from "./league-states";
import { LEAGUE_ROLES, lastCommissionerProblem, setLeagueRole, type LeagueRole } from "./roles";
import type { Game } from "./show-space";

// Backstage › Members & roles (docs/PLAN-new-design.md step 6a; the mock's backstage.js bsMembers and guards.js): who plays
// the couch's games on a season and who runs each. Commissioner (results, waivers, rules and roles) and Game admin (results
// and waivers, picking for people in a draft) can be handed off or shared; a game always keeps a Commissioner, so the last
// one can't step down or leave (roles.ts lastCommissionerProblem). A role changes across every game here in one batch
// (tier 1, Undo on the toast and in Recent changes). Taking someone out of the games, or leaving them yourself, is tier 3:
// hard to undo (their seat stops playing), so the screen asks for a hold, and Recent changes can restore it for 30 days.

const RESTORE_DAYS = 30;

export interface MemberGame {
  leagueId: string;
  name: string;
  gameName: string;
  gameType: string;
  /** You're a Commissioner of it (or a site admin): you may change its roles. */
  yours: boolean;
}

export interface Member {
  userId: string;
  name: string;
  you: boolean;
  /** Their role in each game here by league id; absent: not in that game. */
  roles: Record<string, LeagueRole>;
}

export interface Members {
  games: MemberGame[];
  members: Member[];
  /** You run a game here (you can read this page). */
  runs: boolean;
}

async function scope(user: SessionUser, seasonId: string, couchId: string | null) {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  const { here, runs } = await couchGames(user, seasonId, couchId);
  return { here, runs, admin: isSuperAdminUser(user) };
}

export async function membersFor(user: SessionUser, seasonId: string, couchId: string | null): Promise<Members> {
  const { here, runs, admin } = await scope(user, seasonId, couchId);
  if (!runs.size) throw new HttpError(403, "Backstage is for whoever runs a game here");
  const ids = here.map((g) => g.leagueId);
  const [{ rows }, states] = await Promise.all([
    pool.query(
      `SELECT m.league_id, m.user_id, m.player_id, m.role, COALESCE(u.username, u.name) AS name, min(m.created_at) OVER (PARTITION BY m.user_id) AS first
         FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = ANY($1::uuid[])`,
      [ids]
    ),
    leagueStates(ids),
  ]);
  // Named as the games name them (their seat: "alex"), as the tables do; the account's name when there's no seat.
  const seatName = (leagueId: string, playerId: string | null) => states.get(leagueId)?.players.find((p) => p.id === playerId)?.name ?? null;
  const people = new Map<string, Member & { first: number }>();
  for (const r of rows) {
    const name = seatName(r.league_id, r.player_id) ?? r.name;
    const m: Member & { first: number } = people.get(r.user_id) ?? { userId: r.user_id, name, you: r.user_id === user.id, roles: {}, first: r.first ? Date.parse(r.first) : 0 };
    m.roles[r.league_id] = r.role;
    people.set(r.user_id, m);
  }
  // You first, then whoever runs the most, then by when they joined.
  const rank = (m: Member) => Object.values(m.roles).reduce((n, r) => n + (r === "commissioner" ? 2 : r === "admin" ? 1 : 0), 0);
  const members = [...people.values()]
    .sort((a, b) => Number(b.you) - Number(a.you) || rank(b) - rank(a) || a.first - b.first || a.name.localeCompare(b.name))
    .map((m): Member => ({ userId: m.userId, name: m.name, you: m.you, roles: m.roles }));
  return {
    games: here.map((g) => ({ leagueId: g.leagueId, name: g.name, gameName: g.gameName, gameType: g.gameType, yours: admin || g.yourRole === "commissioner" })),
    members,
    runs: true,
  };
}

/** The games here a Commissioner may change for this person: every one they're in that you're a Commissioner of. */
function targets(here: Game[], admin: boolean, mine: Set<string>, leagueIds: unknown): Game[] {
  const yours = here.filter((g) => admin || g.yourRole === "commissioner");
  const wanted = Array.isArray(leagueIds) ? yours.filter((g) => leagueIds.includes(g.leagueId)) : yours;
  return wanted.filter((g) => mine.has(g.leagueId));
}

async function theirLeagues(userId: string, leagueIds: string[]): Promise<Map<string, { role: string; playerId: string | null; seen: number | null }>> {
  const { rows } = await pool.query("SELECT league_id, role, player_id, results_seen_through FROM league_memberships WHERE user_id = $1 AND league_id = ANY($2::uuid[])", [
    userId,
    leagueIds,
  ]);
  return new Map(rows.map((r) => [r.league_id, { role: r.role, playerId: r.player_id, seen: r.results_seen_through }]));
}

/** Someone's role in the games here (all of theirs you're a Commissioner of, or `leagueIds`): one batch, with Undo. */
export async function setMemberRole(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  userId: string,
  role: unknown,
  leagueIds?: unknown
): Promise<{ batch: string; games: number }> {
  if (typeof role !== "string" || !LEAGUE_ROLES.includes(role as LeagueRole)) throw new HttpError(400, "role must be commissioner, admin or member");
  const { here, admin } = await scope(user, seasonId, couchId);
  const theirs = await theirLeagues(userId, here.map((g) => g.leagueId));
  const games = targets(here, admin, new Set(theirs.keys()), leagueIds).filter((g) => theirs.get(g.leagueId)?.role !== role);
  if (!here.some((g) => admin || g.yourRole === "commissioner")) throw new HttpError(403, "Only a Commissioner changes roles");
  if (!games.length) return { batch: "", games: 0 };
  // Every game checked before any changes, so a refusal never leaves the roles half changed.
  for (const g of games) {
    const { rows } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [g.leagueId]);
    const problem = lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, role as LeagueRole);
    if (problem) throw new HttpError(409, games.length > 1 || here.length > 1 ? `${problem.replace(/\.$/, "")} (${g.name}).` : problem);
  }
  const batch = crypto.randomUUID();
  for (const g of games) await setLeagueRole(g.leagueId, userId, role, (client, before) => roleChange(client, g.leagueId, user.id, userId, before, role as string, batch));
  return { batch, games: games.length };
}

/**
 * Takes `userId` out of `leagueId` (tier 3), as classic's leave does: before the draft the seat goes; after it, it's
 * disabled (its team and points stay in the standings, nobody plays it). Their membership goes; the last Commissioner
 * can't go. The line carries a MemberUndo, open for 30 days.
 */
async function takeOut(leagueId: string, userId: string, spec: { actor: string; batch: string; text: string }): Promise<boolean> {
  let undo: MemberUndo | null = null;
  await withLeagueLock(
    leagueId,
    async (s, client: PoolClient) => {
      const { rows } = await client.query("SELECT user_id, role, player_id, results_seen_through FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
      const me = rows.find((r) => r.user_id === userId);
      if (!me) return;
      const problem = lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, "member");
      if (problem) throw new HttpError(409, problem);
      const seat = me.player_id ? s.players.find((p) => p.id === me.player_id) : null;
      const removed = !s.draftPicksMade;
      if (seat) {
        if (removed) {
          StateLogic.removePlayer(s, seat.id);
          await dropBlindPicksForPlayer(client, leagueId, seat.id);
          StateLogic.BlindDraftLogic.setLockedPlayerIds(s, StateLogic.BlindDraftLogic.lockedPlayerIds(s).filter((id) => id !== seat.id));
        } else StateLogic.disablePlayer(s, seat.id, userId);
      }
      await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
      undo = { type: "member", userId, playerId: me.player_id ?? "", name: seat?.formerName ?? seat?.name ?? "someone", role: me.role, seen: me.results_seen_through, removed };
    },
    (): ChangeSpec | null =>
      undo
        ? {
            userId: spec.actor,
            kind: "member",
            tier: 3,
            text: spec.text,
            batch: spec.batch,
            undo,
            undoUntil: new Date(Date.now() + RESTORE_DAYS * 24 * 3600 * 1000),
          }
        : null
  );
  if (!undo) return false;
  await leftLeague(leagueId);
  return true;
}

/** What taking someone out (or leaving) would do, for the hold sheet's sentence; and the guard, before anyone holds. */
export interface OutPreview {
  name: string;
  games: string[];
  /** After the draft their seat stays in the standings, unplayed; before it, it goes. */
  drafted: boolean;
  /** Why it can't happen (the last Commissioner), or null. */
  problem: string | null;
}

async function outPreview(here: Game[], userId: string): Promise<OutPreview> {
  const theirs = await theirLeagues(userId, here.map((g) => g.leagueId));
  const games = here.filter((g) => theirs.has(g.leagueId));
  const { rows: who } = await pool.query(`SELECT COALESCE(username, name) AS name FROM "user" WHERE id = $1`, [userId]);
  let problem: string | null = null;
  let drafted = false;
  for (const g of games) {
    const { rows } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [g.leagueId]);
    const p = lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, "member");
    if (p && !problem) problem = `Every game needs a Commissioner. Hand ${g.name} to someone first.`;
    const { rows: st } = await pool.query("SELECT (state->>'draftPicksMade')::int AS made FROM leagues WHERE id = $1", [g.leagueId]);
    if (st[0]?.made) drafted = true;
  }
  return { name: who[0]?.name ?? "someone", games: games.map((g) => g.name), drafted, problem };
}

/** Takes someone else out of every game here you're a Commissioner of (tier 3). `preview`: only what it would do. */
export async function removeMember(user: SessionUser, seasonId: string, couchId: string | null, userId: string, preview: boolean) {
  if (userId === user.id) throw new HttpError(400, "To leave yourself, use Leave these games");
  const { here, admin } = await scope(user, seasonId, couchId);
  const theirs = await theirLeagues(userId, here.map((g) => g.leagueId));
  const games = targets(here, admin, new Set(theirs.keys()), undefined);
  if (!games.length) throw new HttpError(403, "Only a Commissioner of their games can take them out");
  const out = await outPreview(games, userId);
  if (preview || out.problem) {
    if (!preview && out.problem) throw new HttpError(409, out.problem);
    return { ...out, batch: null };
  }
  const batch = crypto.randomUUID();
  for (const g of games) await takeOut(g.leagueId, userId, { actor: user.id, batch, text: `Took ${out.name} out of the games` });
  return { ...out, batch };
}

/** You leave every game of the couch's on this season (tier 3); never as the last Commissioner. `preview`: only what it would do. */
export async function leaveGames(user: SessionUser, seasonId: string, couchId: string | null, preview: boolean) {
  const { here } = await scope(user, seasonId, couchId);
  const mine = here.filter((g) => g.yourRole);
  if (!mine.length) throw new HttpError(404, "You're not in a game here");
  const out = await outPreview(mine, user.id);
  if (preview || out.problem) {
    if (!preview && out.problem) throw new HttpError(409, out.problem);
    return { ...out, batch: null };
  }
  const batch = crypto.randomUUID();
  for (const g of mine) await takeOut(g.leagueId, user.id, { actor: user.id, batch, text: `${out.name} left the games` });
  return { ...out, batch };
}

/** Classic's leave (POST /api/leagues/[id]/leave): the same guard, so a league is never left without a Commissioner. */
export async function leaveProblem(leagueId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [leagueId]);
  return lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, "member");
}
