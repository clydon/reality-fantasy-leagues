import crypto from "crypto";
import type { PoolClient } from "pg";
import { LAST_ACTIVE } from "./last-active";
import { isUuid, type SessionUser } from "./auth-helpers";
import { freeSeat } from "./backstage-members";
import { othersOnSeat } from "./shared-seats";
import { recordChange, roleChange } from "./change-log";
import { joinedLeague, stayedOnCouch } from "./couches";
import { pool, tx, withLeagueLock, HttpError, syncStagesFor } from "./db";
import { logDesk, type DeskEntity } from "./desk";
import { gameName, LEAGUE_SEASON_NAME } from "./league-season";
import { notifyHandedOn } from "./push-events";
import { markBatch, markDesk, restoreSeatMove } from "./desk-seat-moves";
import { LEAGUE_ROLES, lastCommissionerProblem, setLeagueRole, type LeagueRole } from "./roles";

// A seat on the desk (docs/PLAN-desk-parity.md step 1 part 1c; the mock's desk-games.js dgSeatSheet, the same sheet from a
// person's page and, with step 6b, from a game's): someone's place in a game, with its team, picks and scores, and the
// account signed in to it. Its role (Commissioner, Game admin, Player) and Unlink (the seat keeps playing with nobody signed
// in) are tier 1: a line in the person's History with Undo, and one in the game's own Recent changes, written together. A
// game always keeps a Commissioner, so the only one's role and Unlink are refused until it's handed on (classic's unlink
// never checked: Noticed p). Hand on (the mock's dkHandOn): games whose only Commissioner is going, to whoever plays them,
// one person for them all or game by game; tier 1 with Undo, and the new Commissioner is told. Built for a person's seat and
// their Delete (part 1c), a couch nobody runs (step 2) and a game's page (step 6). Classic's routes (the league memberships
// routes for role and unlink) wrote no History, had no Undo and no guard on unlink. Link, Take out, Put back and Remove a
// seat are desk-seat-moves.ts's (part 6b).

export const ROLE_TITLE: Record<LeagueRole, string> = { commissioner: "Commissioner", admin: "Game admin", member: "Player" };

/** "a, b and c" (items may hold commas of their own). */
export const andList = (a: string[]) => (a.length <= 1 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

interface Seat {
  playerId: string | null;
  role: LeagueRole;
  seen: number | null;
  explainerSeenAt: string | null;
  /** The game's name, and its couch's. */
  game: string;
  couch: string | null;
  /** The account signed in to it, by name. */
  person: string;
}

async function seatOf(leagueId: string, userId: string): Promise<Seat> {
  if (!isUuid(leagueId)) throw new HttpError(404, "That game isn't here");
  const { rows } = await pool.query(
    `SELECT m.player_id, m.role, m.results_seen_through, m.explainer_seen_at, l.name, c.name AS couch, COALESCE(u.username, u.name) AS person
       FROM league_memberships m JOIN leagues l ON l.id = m.league_id LEFT JOIN couches c ON c.id = l.couch_id JOIN "user" u ON u.id = m.user_id
      WHERE m.league_id = $1 AND m.user_id = $2 AND l.deleted_at IS NULL`,
    [leagueId, userId]
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, "They aren't signed in to a seat in that game");
  return {
    playerId: r.player_id,
    role: r.role,
    seen: r.results_seen_through,
    explainerSeenAt: r.explainer_seen_at ? new Date(r.explainer_seen_at).toISOString() : null,
    game: r.name,
    couch: r.couch,
    person: r.person,
  };
}

/** "Outlast on Race Night": where a seat is, in History. */
const where = (s: { game: string; couch: string | null }) => (s.couch ? `${s.game} on ${s.couch}` : s.game);

const A_ROLE: Record<LeagueRole, string> = { commissioner: "a Commissioner", admin: "a Game admin", member: "a Player" };

// ---------- the role ----------

/** Their role in the game (tier 1, Undo): refused for the only Commissioner (Hand it on first). */
export async function setSeatRole(user: SessionUser, leagueId: string, userId: string, role: unknown): Promise<{ changeId: string; text: string }> {
  if (typeof role !== "string" || !LEAGUE_ROLES.includes(role as LeagueRole)) throw new HttpError(400, "role is commissioner, admin or member");
  const next = role as LeagueRole;
  const seat = await seatOf(leagueId, userId);
  if (seat.role === next) throw new HttpError(409, `${seat.person} is ${A_ROLE[next]} in ${seat.game} already`);
  const batch = crypto.randomUUID();
  let changeId = "";
  await setLeagueRole(leagueId, userId, next, async (client, before) => {
    await roleChange(client, leagueId, user.id, userId, before, next, batch);
    changeId = await logDesk(client, {
      entity: "person",
      entityId: userId,
      action: "role",
      text: `Made ${ROLE_TITLE[next]} in ${where(seat)}`,
      before: { role: before },
      after: { leagueId, role: next, batch },
      undo: { type: "seat", do: "role", userId, leagueId, before, after: next, batch },
      userId: user.id,
    });
  });
  return { changeId, text: `${seat.person} is ${A_ROLE[next]} in ${seat.game}` };
}

// ---------- unlink ----------

/**
 * Unlinks their account from the seat (tier 1, Undo): the seat keeps its team, picks and scores and goes on in the game
 * with nobody signed in to it; they stay on the couch (as the app's takeOut leaves them). Refused for the only
 * Commissioner.
 */
export async function unlinkSeat(user: SessionUser, leagueId: string, userId: string): Promise<{ changeId: string; text: string }> {
  const seat = await seatOf(leagueId, userId);
  const batch = crypto.randomUUID();
  // On the couch through its games, or in their own right: Unlink can leave them there in their own right (stayedOnCouch),
  // and its Undo puts it back as it was.
  const { rows: via } = await pool.query("SELECT cm.via FROM couch_members cm JOIN leagues l ON l.couch_id = cm.couch_id WHERE l.id = $1 AND cm.user_id = $2", [leagueId, userId]);
  const changeId = await tx(async (db) => {
    const { rows } = await db.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
    const me = rows.find((r) => r.user_id === userId);
    if (!me) throw new HttpError(409, `${seat.person} isn't signed in to a seat there now`);
    if (lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, "member")) throw new HttpError(409, `${seat.person} runs ${seat.game} alone. Hand it to someone first.`);
    await db.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
    // The seat it leaves empty (a game's Seats says when: desk-seat-moves.ts).
    await recordChange(db, leagueId, null, { userId: user.id, kind: "member", tier: 1, text: `Unlinked ${seat.person}'s account from their seat`, batch, detail: { emptied: seat.playerId ? [seat.playerId] : [] } });
    return logDesk(db, {
      entity: "person",
      entityId: userId,
      action: "unlink",
      text: `Unlinked from ${where(seat)}`,
      after: { leagueId, playerId: seat.playerId, batch },
      undo: { type: "seat", do: "unlink", userId, leagueId, playerId: seat.playerId, role: me.role, seen: seat.seen, explainerSeenAt: seat.explainerSeenAt, couchVia: via[0]?.via ?? null, batch },
      userId: user.id,
    });
  });
  // A game in stages (step A12 part 4c): the stages' memberships follow now, not at the game's next write.
  await syncStagesFor([leagueId]);
  await stayedOnCouch(leagueId, userId);
  return { changeId, text: `Unlinked · ${seat.person}'s seat waits for an account` };
}

// ---------- hand on ----------

export interface HandOnGame {
  leagueId: string;
  name: string;
  game: string;
  season: string | null;
  couch: string | null;
}

export interface HandOnCandidate {
  id: string;
  name: string;
  colour: string | null;
  activeAt: string | null;
  /** The games of these they play (league ids). */
  plays: string[];
}

/**
 * Who could run these games next: everyone who plays one of them, most active first, but whoever's going (`from`) and
 * anyone who can't sign in.
 */
export async function handOnFor(leagueIds: string[], from: string | null): Promise<{ games: HandOnGame[]; candidates: HandOnCandidate[] }> {
  const ids = [...new Set(leagueIds.filter(isUuid))].slice(0, 30);
  if (!ids.length) throw new HttpError(400, "Which games?");
  const [{ rows: games }, { rows: people }] = await Promise.all([
    pool.query(
      `SELECT l.id, l.name, c.name AS couch, l.state->'settings'->>'leagueTypeId' AS type, ${LEAGUE_SEASON_NAME} AS season
         FROM leagues l LEFT JOIN couches c ON c.id = l.couch_id WHERE l.id = ANY($1::uuid[]) AND l.deleted_at IS NULL ORDER BY l.created_at`,
      [ids]
    ),
    pool.query(
      `SELECT u.id, COALESCE(u.username, u.name) AS name, st.colour, ${LAST_ACTIVE} AS active, array_agg(m.league_id::text) AS plays
         FROM league_memberships m JOIN "user" u ON u.id = m.user_id LEFT JOIN user_settings st ON st.user_id = u.id
        WHERE m.league_id = ANY($1::uuid[]) AND u.id <> $2 AND u.banned IS NOT TRUE
        GROUP BY u.id, st.colour ORDER BY active DESC NULLS LAST, name`,
      [ids, from ?? ""]
    ),
  ]);
  return {
    games: games.map((g) => ({ leagueId: g.id, name: g.name, game: gameName(g.type), season: g.season, couch: g.couch })),
    candidates: people.map((p) => ({
      id: p.id,
      name: p.name,
      colour: p.colour ?? null,
      activeAt: p.active ? new Date(p.active).toISOString() : null,
      plays: (p.plays as string[]).filter((x) => games.some((g) => g.id === x)),
    })),
  };
}

interface Move {
  leagueId: string;
  to: string;
  before: LeagueRole;
  /** Nobody ran the game before (a couch nobody ran): its Undo may leave it that way again. */
  nobodyRan?: boolean;
}

/**
 * Hands games on (tier 1, Undo): each to someone who plays it, who becomes its Commissioner (whoever ran it stays one too).
 * A line in each game's Recent changes; in History, the hand-on on whoever's going (`from`; a couch nobody runs: the
 * couch's), carrying the Undo, and "Made Commissioner" on each who takes one. Each new Commissioner is told.
 */
export async function handOn(
  user: SessionUser,
  body: { from?: unknown; moves?: unknown }
): Promise<{ changeId: string; text: string; handed: { to: string; name: string; games: string[] }[] }> {
  const from = typeof body.from === "string" && body.from ? body.from : null;
  if (!Array.isArray(body.moves) || !body.moves.length || body.moves.length > 30) throw new HttpError(400, "moves: each game and who runs it");
  const wanted = body.moves.map((m) => ({ leagueId: String((m as { leagueId?: unknown })?.leagueId ?? ""), to: String((m as { to?: unknown })?.to ?? "") }));
  if (new Set(wanted.map((m) => m.leagueId)).size !== wanted.length) throw new HttpError(400, "One person for each game");
  const { games, candidates } = await handOnFor(wanted.map((m) => m.leagueId), from);
  for (const m of wanted) {
    if (!games.some((g) => g.leagueId === m.leagueId)) throw new HttpError(404, "That game isn't here");
    if (!candidates.some((c) => c.id === m.to && c.plays.includes(m.leagueId))) throw new HttpError(400, "Hand it to someone who plays it");
  }
  const gameOf = (id: string) => games.find((g) => g.leagueId === id)!;
  const nameOf = (id: string) => candidates.find((c) => c.id === id)!.name;
  const couches = new Set(wanted.map((m) => gameOf(m.leagueId).couch));
  const oneCouch = couches.size === 1 ? [...couches][0] : null;
  // In History each game is named with its couch, once when they're all on one.
  const named = (ids: string[]) => andList(ids.map((id) => (oneCouch || !gameOf(id).couch ? gameOf(id).name : where({ game: gameOf(id).name, couch: gameOf(id).couch }))));
  const on = oneCouch ? ` on ${oneCouch}` : "";
  const by = [...new Set(wanted.map((m) => m.to))].map((to) => ({ to, name: nameOf(to), games: wanted.filter((m) => m.to === to).map((m) => m.leagueId) }));
  const text =
    by.length === 1
      ? `Handed ${named(by[0].games)}${on} to ${by[0].name}`
      : `Handed ${andList(by.map((r) => `${named(r.games)} to ${r.name}`))}${oneCouch ? `, on ${oneCouch}` : ""}`;
  // Whose History holds the hand-on: whoever's going, else the couch (a couch nobody runs), else the first who takes one.
  const { rows: couchRow } = from ? { rows: [] } : await pool.query("SELECT couch_id FROM leagues WHERE id = $1", [wanted[0].leagueId]);
  const home: { entity: DeskEntity; id: string } = from ? { entity: "person", id: from } : couchRow[0]?.couch_id ? { entity: "couch", id: couchRow[0].couch_id } : { entity: "person", id: by[0].to };
  const batch = crypto.randomUUID();
  // Every game and its lines in one transaction: a game that can't be handed on (they left it, or run it already) leaves
  // them all as they were.
  const changeId = await tx(async (db) => {
    const moves: Move[] = [];
    for (const m of wanted) {
      const { rows } = await db.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1 FOR UPDATE", [m.leagueId]);
      const before = rows.find((r) => r.user_id === m.to)?.role as LeagueRole | undefined;
      if (!before) throw new HttpError(409, `${nameOf(m.to)} isn't in ${gameOf(m.leagueId).name} now`);
      if (before === "commissioner") throw new HttpError(409, `${nameOf(m.to)} runs ${gameOf(m.leagueId).name} already`);
      await db.query("UPDATE league_memberships SET role = 'commissioner' WHERE league_id = $1 AND user_id = $2", [m.leagueId, m.to]);
      await roleChange(db, m.leagueId, user.id, m.to, before, "commissioner", batch);
      moves.push({ ...m, before, nobodyRan: !rows.some((r) => r.role === "commissioner") });
    }
    for (const r of by)
      await logDesk(db, { entity: "person", entityId: r.to, action: "made-commissioner", text: `Made Commissioner of ${named(r.games)}${on}`, after: { batch }, userId: user.id });
    // A game nobody ran (a couch nobody runs): its Undo puts it back as it was, nobody running it, in the Inbox again.
    return logDesk(db, { entity: home.entity, entityId: home.id, action: "hand-on", text, after: { batch, moves }, undo: { type: "seat", do: "handOn", batch, moves }, userId: user.id });
  });
  await syncStagesFor(wanted.map((m) => m.leagueId));
  for (const r of by) notifyHandedOn({ userId: r.to, leagueIds: r.games, games: andList(r.games.map((id) => gameOf(id).name)), key: batch });
  return {
    changeId,
    text: `${by.map((r) => `${r.name} runs ${andList(r.games.map((id) => gameOf(id).name))}`).join("; ")} now`,
    handed: by,
  };
}

// ---------- an account deleted ----------

/**
 * Their account is being deleted (desk-person-actions.ts deleteAccount): their seat goes as the app's takeOut lets one go
 * (freeSeat: before the draft it goes, after it it's disabled and stays in the standings), whoever runs the game, and a
 * line in its Recent changes with no Undo, since the account can't come back. Null when they weren't in it.
 */
export async function letSeatGo(leagueId: string, userId: string, name: string, actor: string, batch: string): Promise<"went" | "stays" | null> {
  let outcome = null as "went" | "stays" | null;
  // A team they shared (step A10 part 4b) stays with the others on it, playing.
  let shared = false;
  let playerId: string | null = null;
  await withLeagueLock(
    leagueId,
    async (s, client) => {
      const { rows } = await client.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2 FOR UPDATE", [leagueId, userId]);
      if (!rows[0]) return;
      const seat = rows[0].player_id ? s.players.find((p) => p.id === rows[0].player_id) : null;
      playerId = seat?.id ?? null;
      shared = !!seat && (await othersOnSeat(client, leagueId, seat.id, userId));
      outcome = (await freeSeat(s, client, leagueId, seat, userId)) ? "went" : "stays";
      await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
    },
    () =>
      outcome && {
        userId: actor,
        kind: "member",
        tier: 3,
        text: outcome === "went" ? `${name}'s account was deleted: their seat went from the game` : shared ? `${name}'s account was deleted: the team they shared stays with the others on it` : `${name}'s account was deleted: their seat stays in the standings, unplayed`,
        batch,
        // The seat it was, for a game's Seats (desk-seat-moves.ts: Out of it, "Account deleted").
        detail: playerId ? { deleted: playerId } : null,
      }
  );
  return outcome;
}

// ---------- Undo ----------

/**
 * History's Undo for a seat's line (desk-undo.ts): the role back, the account signed in to its seat again, or the games
 * handed on back as they were. A change made since stands in the way (their role moved on, someone else is in the seat,
 * nobody else runs a game now), and then it says so and changes nothing. The game's own lines are marked undone with it.
 */
export async function restoreSeat(user: SessionUser, changeId: string, u: Record<string, unknown>): Promise<void> {
  const batch = String(u.batch ?? "");
  const markGames = async (db: PoolClient) => {
    await markBatch(db, batch, user.id);
  };
  switch (u.do) {
    case "role": {
      const leagueId = String(u.leagueId);
      const userId = String(u.userId);
      const { rows } = await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
      if (!rows[0] || rows[0].role !== u.after) throw new HttpError(409, "Their role there has changed since: it can't go back");
      await setLeagueRole(leagueId, userId, u.before, markGames);
      return;
    }
    case "unlink": {
      const leagueId = String(u.leagueId);
      const userId = String(u.userId);
      const playerId = typeof u.playerId === "string" ? u.playerId : null;
      await tx(async (db) => {
        const { rows: who } = await db.query(`SELECT 1 FROM "user" WHERE id = $1`, [userId]);
        if (!who.length) throw new HttpError(409, "Their account was deleted");
        const { rows: league } = await db.query("SELECT state, deleted_at FROM leagues WHERE id = $1 FOR UPDATE", [leagueId]);
        if (!league[0] || league[0].deleted_at) throw new HttpError(409, "That game is gone");
        const { rows: mine } = await db.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
        if (mine.length) throw new HttpError(409, "They're signed in to a seat there again");
        if (playerId) {
          const { rows: taken } = await db.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND player_id = $2", [leagueId, playerId]);
          if (taken.length) throw new HttpError(409, "Someone else is signed in to that seat now");
          const seat = (league[0].state?.players ?? []).find((p: { id: string }) => p.id === playerId);
          if (!seat || seat.disabled) throw new HttpError(409, "Their seat has changed since: it can't go back");
        }
        await db.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through, explainer_seen_at) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))", [
          leagueId,
          userId,
          playerId,
          LEAGUE_ROLES.includes(u.role as LeagueRole) ? u.role : "member",
          typeof u.seen === "number" ? u.seen : null,
          typeof u.explainerSeenAt === "string" ? u.explainerSeenAt : null,
        ]);
        await markGames(db);
      });
      await syncStagesFor([leagueId]);
      await joinedLeague(leagueId, userId);
      if (u.couchVia === "game")
        await pool.query("UPDATE couch_members cm SET via = 'game' FROM leagues l WHERE l.id = $1 AND cm.couch_id = l.couch_id AND cm.user_id = $2", [leagueId, userId]);
      return;
    }
    case "handOn": {
      const moves = (Array.isArray(u.moves) ? u.moves : []) as Move[];
      // Every game checked before any goes back, so a refusal never leaves them half handed back.
      for (const m of moves) {
        const { rows } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [m.leagueId]);
        if (rows.find((r) => r.user_id === m.to)?.role !== "commissioner") throw new HttpError(409, "Who runs those games has changed since: it can't go back");
        if (!m.nobodyRan && !rows.some((r) => r.user_id !== m.to && r.role === "commissioner"))
          throw new HttpError(409, "Nobody else runs one of those games now: it can't go back");
      }
      // A game nobody ran before goes back to nobody running it (setLeagueRole's guard would refuse that otherwise).
      for (const m of moves) await setLeagueRole(m.leagueId, m.to, m.before, markGames, { nobodyRuns: !!m.nobodyRan });
      await markDesk(batch, changeId, user.id);
      return;
    }
    // Link, Take out, Put back and Remove a seat (part 6b).
    case "link":
    case "takeOut":
    case "putBack":
    case "seatBack":
    case "remove":
      return restoreSeatMove(user, changeId, u);
    default:
      throw new HttpError(409, "That one can't be undone here");
  }
}
