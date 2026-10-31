import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { LEVEL_WORDS, levelOf } from "@/lib/game/computer-players";
import type { LeagueState, Player } from "@/lib/game/types";
import { noLinkFor } from "@/lib/desk-seat-words";
import { LAST_ACTIVE } from "./last-active";
import { isUuid, type SessionUser } from "./auth-helpers";
import { freeSeat, takeOut } from "./backstage-members";
import { recordChange, type MemberUndo } from "./change-log";
import { joinedLeague, stayedOnCouch } from "./couches";
import { likeOf, pool, withLeagueLock, HttpError } from "./db";
import { logDesk } from "./desk";
import { SEARCH } from "./desk-people";
import { followLeagueProgress } from "./follows";
import { restoreMember } from "./league-changes";
import { notifyDeskSeat } from "./push-events";
import { LEAGUE_ROLES, lastCommissionerProblem, type LeagueRole } from "./roles";
import { WAITING } from "./way-in";
import { stagesBegun } from "./stages";

/** Whether the draft has moved on since `picks` picks: a game in stages (step A12 part 4c) has no draft of its own, so any stage begun
 *  since (a seat that went from one went before any had: backstage-members.ts freeSeat). */
async function movedOn(s: LeagueState, client: Pick<PoolClient, "query">, leagueId: string, picks: unknown): Promise<boolean> {
  if ((s.draftPicksMade ?? 0) !== picks) return true;
  return StateLogic.StageLogic.on(s) && (await stagesBegun(client, leagueId));
}

// A game's seats on the desk (docs/PLAN-desk-parity.md step 6, part 6b; the mock's desk-games.js dgSeatsHTML, dgLinkSheet,
// dgTakeOut, dgEmptySheet and dgOutSheet). A seat is a place in a game (its team, picks and scores) with one account signed in
// to it: signed in, empty (a live seat with no account: saved by an invite, unlinked, or left by an account deleted while the
// game was: Noticed ah) or out (left, taken out or removed: a disabled seat, or one the change log says went before a draft).
// Link an account (tier 1, Undo): to an empty seat, or to someone's (they come out and stay on the couch); the seat takes the
// account's name in the tables (Noticed o), the role is any of the three (Noticed q), they join the couch and are told; never
// leaving a game with no Commissioner (Noticed p). Take out is the app's takeOut (not classic's disablePlayer, which forgot
// the account: Noticed n), Put back is Recent changes' restoreMember at any time, and an empty seat can be removed (tier 3:
// disabled after a draft, gone before). Each is a line in the game's Recent changes and in the desk's History of the game
// and the person, written in one transaction with the change. Role, Unlink and Hand on are desk-seats.ts's (part 1c).

/** An account, as a seat's row shows it. */
export interface SeatPerson {
  id: string;
  name: string;
  colour: string | null;
  activeAt: string | null;
  you: boolean;
  admin: boolean;
  waiting: boolean;
  stopped: boolean;
}

/** A seat someone's signed in to. */
export interface SeatIn {
  person: SeatPerson;
  playerId: string | null;
  /** The seat's own name, when the tables name it differently from the account (a seat linked before 6b). */
  seatName: string | null;
  role: LeagueRole;
  /** The game's only Commissioner. */
  alone: boolean;
  /** Their other games on the couch (Take out's "and in its other game"). */
  otherGames: number;
}

/** A seat nobody's signed in to. */
export interface SeatEmpty {
  playerId: string;
  name: string;
  /** Saved by an invite nobody's used, unlinked, its account deleted while the game was, else nothing known. */
  why: "saved" | "unlinked" | "deleted" | null;
  by: string | null;
  at: string | null;
}

/** Someone, or a seat, out of the game. */
export interface SeatOut {
  person: SeatPerson | null;
  /** The account was deleted: the seat can't be theirs again. */
  accountGone: boolean;
  /** Its seat's id: still there (disabled, in the standings) while `stays`, else gone (it went before a draft). */
  playerId: string | null;
  name: string;
  how: "left" | "out" | "removed" | "deleted";
  /** Who did it ("you" for you), when known. */
  by: string | null;
  at: string | null;
  /** The role they come back as. */
  role: LeagueRole;
  /** Still on the game's couch. */
  onCouch: boolean;
  /** Its team stays in the standings (the seat's there, disabled). */
  stays: boolean;
}

export interface GameSeats {
  in: SeatIn[];
  empty: SeatEmpty[];
  out: SeatOut[];
  /** Computer players: they play on their own; Backstage › Members adds and takes them out. */
  computer: { playerId: string; name: string; level: string }[];
  /** It has drafted: a seat that goes stays in the standings, unplayed. */
  drafted: boolean;
  /** Why no account can be linked here (a practice game, a public pool), else null. */
  noLink: string | null;
}

const PERSON = `u.id, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS admin, (${WAITING}) AS waiting, u.banned IS TRUE AS stopped,
  ${LAST_ACTIVE} AS active, st.colour`;

const personOf = (r: Record<string, unknown>, me: string): SeatPerson => ({
  id: r.id as string,
  name: r.name as string,
  colour: (r.colour as string | null) ?? null,
  activeAt: r.active ? new Date(r.active as string).toISOString() : null,
  you: r.id === me,
  admin: !!r.admin,
  waiting: !!r.waiting,
  stopped: !!r.stopped,
});

/** What a change line says about seats (written by this file and desk-seats.ts from part 6b on). */
interface SeatDetail {
  /** Seats it left with nobody signed in. */
  emptied?: string[];
  /** A seat with no account removed: it went (before a draft) or stayed disabled. */
  removed?: { playerId: string; name: string; went: boolean };
  /** An account deleted: its seat. */
  deleted?: string;
}

interface MemberLine {
  id: string;
  batch: string;
  user_id: string | null;
  who: string | null;
  undo: MemberUndo | { type: string } | null;
  detail: SeatDetail | null;
  created_at: Date;
  undone_at: Date | null;
}

const memberUndo = (l: MemberLine): MemberUndo | null => (l.undo?.type === "member" ? (l.undo as MemberUndo) : null);

/** The game's open member lines that say something about seats, newest first; `userId`: only the ones taking them out. */
async function memberLines(db: Pick<PoolClient, "query">, leagueId: string, userId: string | null = null): Promise<MemberLine[]> {
  const { rows } = await db.query(
    `SELECT c.id, c.batch, c.user_id, COALESCE(u.username, u.name) AS who, c.undo, c.detail, c.created_at, c.undone_at
       FROM league_changes c LEFT JOIN "user" u ON u.id = c.user_id
      WHERE c.league_id = $1 AND c.kind = 'member' AND c.undone_at IS NULL
        AND (c.undo->>'type' = 'member' OR c.detail ?| array['emptied', 'removed', 'deleted'])
        AND ($2::text IS NULL OR (c.undo->>'type' = 'member' AND c.undo->>'userId' = $2))
      ORDER BY c.created_at DESC`,
    [leagueId, userId]
  );
  return rows;
}

const players = (s: LeagueState): Player[] => s.players ?? [];
const roleOf = (r: unknown): LeagueRole => (LEAGUE_ROLES.includes(r as LeagueRole) ? (r as LeagueRole) : "member");

/** A game's seats, as its page shows them; null for a deleted game (its seats are in its delete line until it's back). */
export async function gameSeats(user: SessionUser, leagueId: string): Promise<GameSeats | null> {
  if (!isUuid(leagueId)) return null;
  const { rows: L } = await pool.query("SELECT state, couch_id, solo, deleted_at FROM leagues WHERE id = $1", [leagueId]);
  const g = L[0];
  if (!g || g.deleted_at) return null;
  const s = g.state as LeagueState;
  const [{ rows: members }, lines, { rows: invites }, { rows: others }, { rows: couch }] = await Promise.all([
    pool.query(
      `SELECT m.player_id, m.role, ${PERSON} FROM league_memberships m JOIN "user" u ON u.id = m.user_id LEFT JOIN user_settings st ON st.user_id = u.id
        WHERE m.league_id = $1 ORDER BY CASE m.role WHEN 'commissioner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at, u.id`,
      [leagueId]
    ),
    memberLines(pool, leagueId),
    pool.query(
      `SELECT i.player_id, i.created_at, COALESCE(u.username, u.name) AS by FROM league_invites i JOIN "user" u ON u.id = i.invited_by
        WHERE i.league_id = $1 AND i.status = 'pending' AND i.player_id IS NOT NULL ORDER BY i.created_at DESC`,
      [leagueId]
    ),
    pool.query(
      `SELECT m.user_id, count(*)::int AS n FROM league_memberships m JOIN leagues o ON o.id = m.league_id
        WHERE o.couch_id = $1 AND o.id <> $2 AND o.deleted_at IS NULL GROUP BY m.user_id`,
      [g.couch_id, leagueId]
    ),
    pool.query("SELECT user_id FROM couch_members WHERE couch_id = $1", [g.couch_id]),
  ]);
  const byId = new Map(players(s).map((p) => [p.id, p]));
  const other = new Map(others.map((r) => [r.user_id as string, r.n as number]));
  const onCouch = new Set(couch.map((r) => r.user_id as string));
  const commissioners = members.filter((m) => m.role === "commissioner").length;
  const inGame = new Set(members.map((m) => m.id as string));
  const linked = new Set(members.map((m) => m.player_id as string | null).filter(Boolean));
  const when = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
  const byWho = (l: MemberLine) => (l.user_id === user.id ? "you" : l.who);

  const seatsIn: SeatIn[] = members.map((m) => {
    const seat = m.player_id ? byId.get(m.player_id) : undefined;
    return {
      person: personOf(m, user.id),
      playerId: m.player_id ?? null,
      seatName: seat && !seat.disabled && seat.name !== m.name ? seat.name : null,
      role: roleOf(m.role),
      alone: m.role === "commissioner" && commissioners === 1,
      otherGames: other.get(m.id) ?? 0,
    };
  });

  // Empty: a live seat, not a computer's, with nobody signed in.
  const empty: SeatEmpty[] = [];
  for (const p of players(s)) {
    if (p.disabled || p.automated || linked.has(p.id)) continue;
    const inv = invites.find((i) => i.player_id === p.id);
    const un = inv ? null : lines.find((l) => !l.undone_at && l.detail?.emptied?.includes(p.id));
    empty.push({ playerId: p.id, name: p.name, why: inv ? "saved" : un ? "unlinked" : null, by: inv ? inv.by : un ? byWho(un) : null, at: when(inv?.created_at ?? un?.created_at) });
  }
  // A seat whose account was deleted while the game was (restored without it: Noticed ah) says so.
  if (empty.some((e) => !e.why)) {
    const { rows: del } = await pool.query(
      `SELECT x->>'player_id' AS player_id, x->>'user_id' AS user_id FROM league_changes c, jsonb_array_elements(COALESCE(c.undo->'memberships', '[]'::jsonb)) x
        WHERE c.league_id = $1 AND c.kind = 'game.delete' AND c.undone_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = x->>'user_id')`,
      [leagueId]
    );
    for (const e of empty) if (!e.why && del.some((d) => d.player_id === e.playerId)) e.why = "deleted";
  }

  // Out: a disabled seat (left, taken out or removed after a draft), then one the change log says went before a draft.
  const outs: (Omit<SeatOut, "person" | "accountGone" | "onCouch"> & { userId: string | null })[] = [];
  const lineFor = (pid: string) => lines.find((l) => !l.undone_at && (memberUndo(l)?.playerId === pid || l.detail?.removed?.playerId === pid || l.detail?.deleted === pid));
  const howOf = (l: MemberLine | undefined, userId: string | null): Pick<SeatOut, "how" | "by" | "at"> => {
    const u = l && memberUndo(l);
    if (u) return l!.user_id === u.userId ? { how: "left", by: null, at: when(l!.created_at) } : { how: "out", by: byWho(l!), at: when(l!.created_at) };
    if (l?.detail?.removed) return { how: "removed", by: byWho(l), at: when(l.created_at) };
    if (l?.detail?.deleted) return { how: "deleted", by: null, at: when(l.created_at) };
    // Classic's leave kept the account on the seat and wrote no line; classic's Remove player kept no account (Noticed n).
    return { how: userId ? "left" : "removed", by: null, at: null };
  };
  for (const p of players(s)) {
    if (!p.disabled || p.automated) continue;
    const l = lineFor(p.id);
    const userId = (l && memberUndo(l)?.userId) || p.disabledFromUserId || null;
    if (userId && inGame.has(userId)) continue;
    outs.push({ userId, playerId: p.id, name: p.formerName ?? p.name, role: roleOf(l && memberUndo(l)?.role), stays: true, ...howOf(l, userId) });
  }
  for (const l of lines) {
    if (l.undone_at) continue;
    const u = memberUndo(l);
    if (u?.removed && !byId.has(u.playerId) && !inGame.has(u.userId) && !outs.some((o) => o.userId === u.userId))
      outs.push({ userId: u.userId, playerId: u.playerId || null, name: u.name, role: roleOf(u.role), stays: false, ...howOf(l, u.userId) });
    const r = l.detail?.removed;
    if (r?.went && !byId.has(r.playerId) && !outs.some((o) => !o.userId && o.playerId === r.playerId))
      outs.push({ userId: null, playerId: r.playerId, name: r.name, role: "member", stays: false, ...howOf(l, null) });
  }
  const ids = [...new Set(outs.map((o) => o.userId).filter(Boolean))] as string[];
  const { rows: accounts } = ids.length
    ? await pool.query(`SELECT ${PERSON} FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id WHERE u.id = ANY($1::text[])`, [ids])
    : { rows: [] as Record<string, unknown>[] };
  const out: SeatOut[] = outs
    .map(({ userId, ...o }) => {
      const a = userId ? accounts.find((x) => x.id === userId) : undefined;
      return { ...o, person: a ? personOf(a, user.id) : null, accountGone: !!userId && !a, onCouch: !!userId && onCouch.has(userId), how: userId && !a ? ("deleted" as const) : o.how };
    })
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return {
    in: seatsIn,
    empty,
    out,
    computer: players(s)
      .filter((p) => p.automated && !p.disabled)
      .map((p) => ({ playerId: p.id, name: p.name, level: LEVEL_WORDS[levelOf(p as Parameters<typeof levelOf>[0])] })),
    // A game in stages (step A12 part 4c): once any stage has begun, as freeSeat reads it.
    drafted: (s.draftPicksMade ?? 0) > 0 || (StateLogic.StageLogic.on(s) && (await stagesBegun(pool, leagueId))),
    noLink: noLinkFor(g.solo),
  };
}

// ---------- who could sign in to a seat ----------

export interface LinkCandidate extends SeatPerson {
  /** What linking them means here: signed in to this seat now, waiting, stopped, out of this game (Put back instead), in
   *  it already (their own seat is left empty), on the couch, or not (they join it too). */
  rel: "here" | "waiting" | "stopped" | "out" | "inGame" | "onCouch" | "notOnCouch";
  /** Out: how and when. */
  out: { how: SeatOut["how"]; at: string | null } | null;
  /** In the game as its only Commissioner: wherever they sign in there, they stay Commissioner. */
  alone: boolean;
}

/**
 * Link an account's list: with no search, the couch's people without a seat in the game (most active first; someone out
 * of it shows, and can't be chosen); with one, every account by name, username or email, the couch's first, six of them.
 * `seat`: the account signed in to the seat being linked (it can't be chosen).
 */
export async function linkCandidates(user: SessionUser, leagueId: string, opts: { q?: string | null; seat?: string | null }): Promise<{ list: LinkCandidate[]; total: number; searched: boolean }> {
  const [seats, { rows: L }] = await Promise.all([gameSeats(user, leagueId), pool.query("SELECT couch_id FROM leagues WHERE id = $1", [leagueId])]);
  if (!seats) throw new HttpError(404, "That game isn't here");
  const couchId = (L[0]?.couch_id as string | null) ?? null;
  const term = (opts.q ?? "").trim();
  const inGame = new Map(seats.in.map((x) => [x.person.id, x]));
  const out = new Map(seats.out.filter((o) => o.person).map((o) => [o.person!.id, o]));
  const ON_COUCH = `EXISTS (SELECT 1 FROM couch_members cm WHERE cm.couch_id = $1 AND cm.user_id = u.id)`;
  let rows: Record<string, unknown>[];
  let total: number;
  if (!term) {
    ({ rows } = await pool.query(
      `SELECT ${PERSON}, true AS on_couch FROM couch_members cm JOIN "user" u ON u.id = cm.user_id LEFT JOIN user_settings st ON st.user_id = u.id
        WHERE cm.couch_id = $1 AND NOT EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = $2 AND m.user_id = u.id)
        ORDER BY active DESC NULLS LAST, name LIMIT 50`,
      [couchId, leagueId]
    ));
    total = rows.length;
  } else {
    const where = SEARCH(2);
    const [{ rows: found }, { rows: n }] = await Promise.all([
      pool.query(
        `SELECT ${PERSON}, ${ON_COUCH} AS on_couch FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id
          WHERE ${where} ORDER BY on_couch DESC, active DESC NULLS LAST, name LIMIT 6`,
        [couchId, likeOf(term)]
      ),
      pool.query(`SELECT count(*)::int AS n FROM "user" u WHERE ${SEARCH(1)}`, [likeOf(term)]),
    ]);
    rows = found;
    total = n[0].n;
  }
  const list = rows.map((r): LinkCandidate => {
    const p = personOf(r, user.id);
    const o = out.get(p.id);
    const rel: LinkCandidate["rel"] =
      p.id === opts.seat ? "here" : p.waiting ? "waiting" : p.stopped ? "stopped" : o ? "out" : inGame.has(p.id) ? "inGame" : r.on_couch ? "onCouch" : "notOnCouch";
    return { ...p, rel, out: o ? { how: o.how, at: o.at } : null, alone: !!inGame.get(p.id)?.alone };
  });
  return { list, total, searched: !!term };
}

// ---------- the actions ----------

interface Game {
  id: string;
  name: string;
  couch: { id: string; name: string } | null;
  solo: string | null;
}

async function gameOf(leagueId: string): Promise<Game> {
  if (!isUuid(leagueId)) throw new HttpError(404, "That game isn't here");
  const { rows } = await pool.query("SELECT l.id, l.name, l.solo, l.deleted_at, c.id AS couch_id, c.name AS couch FROM leagues l LEFT JOIN couches c ON c.id = l.couch_id WHERE l.id = $1", [leagueId]);
  const g = rows[0];
  if (!g) throw new HttpError(404, "That game isn't here");
  if (g.deleted_at) throw new HttpError(409, "That game's deleted: restore it first");
  return { id: g.id, name: g.name, couch: g.couch_id ? { id: g.couch_id, name: g.couch } : null, solo: g.solo ?? null };
}

/** "Outlast on Race Night": where a seat is, in a person's History. */
const where = (g: Game) => (g.couch ? `${g.name} on ${g.couch.name}` : g.name);

async function account(userId: string): Promise<{ id: string; name: string; waiting: boolean; stopped: boolean } | null> {
  const { rows } = await pool.query(`SELECT u.id, COALESCE(u.username, u.name) AS name, (${WAITING}) AS waiting, u.banned IS TRUE AS stopped FROM "user" u WHERE u.id = $1`, [userId]);
  return rows[0] ?? null;
}

const A_ROLE: Record<LeagueRole, string> = { commissioner: "a Commissioner", admin: "a Game admin", member: "a Player" };

/** The game's lines that share this batch, marked undone (Recent changes follows the desk's Undo). */
export const markBatch = (db: Pick<PoolClient, "query">, batch: string, by: string) =>
  db.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE batch = $1 AND undone_at IS NULL", [batch, by]);

interface MembershipRow {
  user_id: string;
  player_id: string | null;
  role: LeagueRole;
  results_seen_through: number | null;
  explainer_seen_at: Date | null;
  seat_slot?: number;
}

/** Commissioners left once `gone` are out and `to` has `role`: never none where there was one (Noticed p). */
function commissionerProblem(rows: MembershipRow[], gone: string | null, to: string, role: LeagueRole): string | null {
  const before = rows.filter((r) => r.role === "commissioner").length;
  const after = rows.filter((r) => r.user_id !== gone && r.user_id !== to && r.role === "commissioner").length + (role === "commissioner" ? 1 : 0);
  return before > 0 && after === 0 ? "Every game needs a Commissioner. Hand it to someone first." : null;
}

/**
 * Links the account `to` to a seat (tier 1, Undo): an empty one (`playerId`), or the one `userId` is signed in to (they come
 * out, and stay on the couch). Its team, picks and scores are theirs; the seat takes their name in the tables; if they had a
 * seat in the game already, it's left empty; they join the couch and are told. Refused for someone waiting, stopped or out
 * of the game (Put back gives them their own seat), and when it would leave the game with no Commissioner.
 */
export async function linkSeat(user: SessionUser, leagueId: string, target: { userId?: string; playerId?: string }, body: { to?: unknown; role?: unknown }): Promise<{ changeId: string; text: string }> {
  const to = typeof body.to === "string" ? body.to : "";
  if (!to) throw new HttpError(400, "to: the account to sign in to the seat");
  if (typeof body.role !== "string" || !LEAGUE_ROLES.includes(body.role as LeagueRole)) throw new HttpError(400, "role is commissioner, admin or member");
  const role = body.role as LeagueRole;
  const g = await gameOf(leagueId);
  const noLink = noLinkFor(g.solo);
  if (noLink) throw new HttpError(409, noLink);
  if (target.userId === to) throw new HttpError(409, "They're signed in to it already");
  const who = await account(to);
  if (!who) throw new HttpError(404, "Nobody by that id");
  if (who.waiting) throw new HttpError(409, `${who.name} is waiting to get in: let them in first`);
  if (who.stopped) throw new HttpError(409, `${who.name} can't sign in`);
  const VIA = "SELECT via FROM couch_members WHERE couch_id = $1 AND user_id = $2";
  const [from, { rows: couchRow }, { rows: fromVia }] = await Promise.all([
    target.userId ? account(target.userId) : null,
    pool.query(VIA, [g.couch?.id ?? null, to]),
    pool.query(VIA, [g.couch?.id ?? null, target.userId ?? null]),
  ]);
  if (target.userId && !from) throw new HttpError(404, "Nobody by that id");
  const batch = crypto.randomUUID();
  let changeId = "";
  let seatName = "";
  await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query<MembershipRow>("SELECT user_id, player_id, role, results_seen_through, explainer_seen_at, seat_slot FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
    const mover = target.userId ? rows.find((r) => r.user_id === target.userId) : undefined;
    if (target.userId && !mover) throw new HttpError(409, `${from!.name} isn't signed in to a seat there now`);
    const playerId = mover ? mover.player_id : target.playerId;
    const seat = players(s).find((p) => p.id === playerId);
    if (!playerId || !seat || seat.disabled) throw new HttpError(409, "That seat isn't in the game now");
    if (!mover) {
      if (seat.automated) throw new HttpError(409, "That's a computer player's seat");
      if (rows.some((r) => r.player_id === playerId)) throw new HttpError(409, "Someone's signed in to that seat now");
    }
    const mine = rows.find((r) => r.user_id === to);
    // Out of the game (they left or were taken out): Put back gives them their own seat.
    if (!mine) {
      const line = (await memberLines(client, leagueId, to))[0];
      if (line || players(s).some((p) => p.disabled && p.disabledFromUserId === to))
        throw new HttpError(409, `${who.name} ${line && line.user_id !== to ? "was taken out of" : "left"} ${g.name}: Put back gives them their own seat`);
    }
    const problem = commissionerProblem(rows, mover?.user_id ?? null, to, role);
    if (problem) throw new HttpError(409, problem);
    seatName = seat.name;
    if (mover) await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, mover.user_id]);
    // On a team two people share (step A10 part 4b), they take the place of whoever came out (the other stays in theirs).
    const slot = mover?.seat_slot ?? 0;
    if (mine) await client.query("UPDATE league_memberships SET player_id = $3, role = $4, seat_slot = $5 WHERE league_id = $1 AND user_id = $2", [leagueId, to, playerId, role, slot]);
    else await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, seat_slot) VALUES ($1, $2, $3, $4, $5)", [leagueId, to, playerId, role, slot]);
    // Named as the account in the tables, as an invite that hands a seat over names it (join-league.ts).
    seat.name = who.name;
    const emptied = mine?.player_id ? [mine.player_id] : [];
    await recordChange(client, leagueId, null, { userId: user.id, kind: "member", tier: 1, text: `Linked ${who.name} to ${seatName}'s seat`, batch, detail: { emptied } });
    changeId = await logDesk(client, {
      entity: "game",
      entityId: leagueId,
      action: "link",
      text: `Linked ${who.name} to ${seatName}'s seat${mover ? `: ${from!.name} came out` : ""}`,
      after: { batch, playerId, to, role },
      undo: {
        type: "seat",
        do: "link",
        leagueId,
        playerId,
        to,
        role,
        oldName: seatName,
        newName: who.name,
        mine: mine ? { playerId: mine.player_id, role: mine.role } : null,
        from: mover
          ? {
              userId: mover.user_id,
              role: mover.role,
              slot: mover.seat_slot ?? 0,
              seen: mover.results_seen_through,
              explainerSeenAt: mover.explainer_seen_at ? new Date(mover.explainer_seen_at).toISOString() : null,
              couchVia: fromVia[0]?.via ?? null,
            }
          : null,
        toOnCouch: couchRow.length > 0,
        batch,
      },
      userId: user.id,
    });
    await logDesk(client, { entity: "person", entityId: to, action: "linked", text: `Linked to ${seatName}'s seat in ${where(g)}`, after: { batch, leagueId }, userId: user.id });
    if (mover) await logDesk(client, { entity: "person", entityId: mover.user_id, action: "moved-out", text: `Moved out of their seat in ${where(g)}`, after: { batch, leagueId }, userId: user.id });
  });
  if (target.userId) await stayedOnCouch(leagueId, target.userId);
  await joinedLeague(leagueId, to);
  await followLeagueProgress(to, leagueId).catch((e) => console.error("[desk-seat-moves] follow:", e));
  notifyDeskSeat({
    userId: to,
    leagueId,
    title: `You're in ${g.name}`,
    body: `A site admin signed you in to ${seatName}'s seat${g.couch ? ` on ${g.couch.name}` : ""}: its team, picks and scores are yours.`,
    key: batch,
  });
  return { changeId, text: `${who.name} is in ${seatName}'s seat in ${g.name}${role === "member" ? "" : `, as ${A_ROLE[role]}`}` };
}

/**
 * Takes them out of the game (tier 3, the app's takeOut): after a draft their seat stays in the standings, unplayed; before
 * one, or with none, it goes. They stay on the couch. Put back from the game's page any time (and from Recent changes for 30
 * days, as Backstage's).
 */
export async function takeOutSeat(user: SessionUser, leagueId: string, userId: string): Promise<{ changeId: string; text: string }> {
  const g = await gameOf(leagueId);
  const who = await account(userId);
  if (!who) throw new HttpError(404, "Nobody by that id");
  const batch = crypto.randomUUID();
  let changeId = "";
  const done = await takeOut(leagueId, userId, {
    actor: user.id,
    batch,
    text: `Took ${who.name} out of the game`,
    inside: async (client) => {
      changeId = await logDesk(client, {
        entity: "game",
        entityId: leagueId,
        action: "take-out",
        text: `Took ${who.name} out`,
        after: { batch, userId },
        undo: { type: "seat", do: "takeOut", leagueId, userId, batch },
        userId: user.id,
      });
      await logDesk(client, { entity: "person", entityId: userId, action: "taken-out", text: `Taken out of ${where(g)}`, after: { batch, leagueId }, userId: user.id });
    },
  });
  if (!done) throw new HttpError(409, `${who.name} isn't in ${g.name} now`);
  return { changeId, text: `${who.name} is out of ${g.name}` };
}

/**
 * Puts someone out of the game back (tier 1, Undo): their own seat, team and points (Recent changes' restoreMember, at any
 * time), as the role they had; back on the couch if they'd left it; they're told. By account: `userId`. A seat with no
 * account (`playerId`, removed): it waits for an account again.
 */
export async function putBack(user: SessionUser, leagueId: string, who: { userId?: string; playerId?: string }): Promise<{ changeId: string; text: string }> {
  const g = await gameOf(leagueId);
  if (who.playerId) return putSeatBack(user, g, who.playerId);
  const userId = who.userId!;
  const person = await account(userId);
  if (!person) throw new HttpError(409, "Their account was deleted, so the seat can't be theirs again");
  const batch = crypto.randomUUID();
  let changeId = "";
  let back = "";
  await withLeagueLock(leagueId, async (s, client) => {
    const { rows: mine } = await client.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2 FOR UPDATE", [leagueId, userId]);
    if (mine.length) throw new HttpError(409, `${person.name} is back in already`);
    // Their seat while it's there (disabled), with the line that took them out of it (or none: classic's leave wrote
    // none); else their newest line out, whose seat went before a draft.
    const seat = players(s).find((p) => p.disabled && p.disabledFromUserId === userId);
    const lines = await memberLines(client, leagueId, userId);
    const line = seat ? lines.find((l) => memberUndo(l)?.playerId === seat.id) : lines[0];
    const undo: MemberUndo | null = line
      ? memberUndo(line)
      : seat
        ? { type: "member", userId, playerId: seat.id, name: seat.formerName ?? seat.name, role: "member", seen: null, removed: false }
        : null;
    if (!undo) throw new HttpError(404, `${person.name} isn't out of ${g.name}`);
    const before = new Set(players(s).map((p) => p.id));
    await restoreMember(s, client, leagueId, undo);
    const { rows: now } = await client.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
    const playerId = now[0]?.player_id as string;
    back = players(s).find((p) => p.id === playerId)?.name ?? person.name;
    if (line) await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [line.id, user.id]);
    await recordChange(client, leagueId, null, { userId: user.id, kind: "member", tier: 1, text: `Put ${back} back in the game`, batch });
    changeId = await logDesk(client, {
      entity: "game",
      entityId: leagueId,
      action: "put-back",
      text: `Put ${back} back`,
      after: { batch, userId },
      undo: { type: "seat", do: "putBack", leagueId, userId, playerId, lineId: line?.id ?? null, added: !before.has(playerId), picks: s.draftPicksMade ?? 0, batch },
      userId: user.id,
    });
    await logDesk(client, { entity: "person", entityId: userId, action: "put-back", text: `Put back in ${where(g)}`, after: { batch, leagueId }, userId: user.id });
  });
  await joinedLeague(leagueId, userId);
  await followLeagueProgress(userId, leagueId).catch((e) => console.error("[desk-seat-moves] follow:", e));
  notifyDeskSeat({ userId, leagueId, title: `You're back in ${g.name}`, body: `A site admin put you back${g.couch ? ` on ${g.couch.name}` : ""}, with your team and points as they were.`, key: batch });
  return { changeId, text: `${back} is back in ${g.name}, with their team and points` };
}

/** A seat with no account back in the game (it was removed): it waits for an account again. */
async function putSeatBack(user: SessionUser, g: Game, playerId: string): Promise<{ changeId: string; text: string }> {
  const batch = crypto.randomUUID();
  let changeId = "";
  let name = "";
  await withLeagueLock(g.id, async (s, client) => {
    const line = (await memberLines(client, g.id)).find((l) => l.detail?.removed?.playerId === playerId);
    const seat = players(s).find((p) => p.id === playerId);
    let id = playerId;
    if (seat) {
      if (!seat.disabled || seat.disabledFromUserId) throw new HttpError(409, "That seat isn't out of the game");
      name = seat.formerName ?? seat.name;
      StateLogic.reclaimPlayer(s, seat.id);
    } else if (line?.detail?.removed?.went) {
      name = line.detail.removed.name;
      id = StateLogic.addPlayer(s, name).id;
    } else throw new HttpError(404, "That seat isn't out of the game");
    if (line) await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [line.id, user.id]);
    await recordChange(client, g.id, null, { userId: user.id, kind: "member", tier: 1, text: `Put ${name}'s seat back`, batch });
    changeId = await logDesk(client, {
      entity: "game",
      entityId: g.id,
      action: "seat-back",
      text: `Put ${name}'s seat back`,
      after: { batch, playerId: id },
      undo: { type: "seat", do: "seatBack", leagueId: g.id, playerId: id, lineId: line?.id ?? null, added: id !== playerId, picks: s.draftPicksMade ?? 0, batch },
      userId: user.id,
    });
  });
  return { changeId, text: `${name}'s seat is back, waiting for an account` };
}

/**
 * Removes a seat nobody's signed in to (tier 3): after a draft it stays in the standings, unplayed, and nobody can sign in
 * to it; before one it goes from the game. An invite that saved it still lets its invitee in, as a new player. Put it back
 * from the game's page any time.
 */
export async function removeSeat(user: SessionUser, leagueId: string, playerId: string): Promise<{ changeId: string; text: string }> {
  const g = await gameOf(leagueId);
  const batch = crypto.randomUUID();
  let changeId = "";
  let name = "";
  await withLeagueLock(leagueId, async (s, client) => {
    const seat = players(s).find((p) => p.id === playerId);
    if (!seat || seat.disabled) throw new HttpError(409, "That seat isn't in the game now");
    if (seat.automated) throw new HttpError(409, "That's a computer player's seat: Backstage › Members takes them out");
    const { rows } = await client.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND player_id = $2 FOR UPDATE", [leagueId, playerId]);
    if (rows.length) throw new HttpError(409, "Someone's signed in to that seat now");
    name = seat.name;
    const picks = s.draftPicksMade ?? 0;
    const went = await freeSeat(s, client, leagueId, seat, "");
    await recordChange(client, leagueId, null, { userId: user.id, kind: "member", tier: 3, text: `Removed ${name}'s seat`, batch, detail: { removed: { playerId, name, went } } });
    changeId = await logDesk(client, {
      entity: "game",
      entityId: leagueId,
      action: "remove-seat",
      text: `Removed ${name}'s seat`,
      after: { batch, playerId },
      undo: { type: "seat", do: "remove", leagueId, playerId, name, went, picks, batch },
      userId: user.id,
    });
  });
  return { changeId, text: `${name}'s seat is out of ${g.name}` };
}

// ---------- Undo ----------

/** The desk's lines from the same change (the person's), marked undone with the one that carried the Undo. */
export const markDesk = (batch: string, changeId: string, by: string) =>
  pool.query("UPDATE admin_changes SET undone_at = now(), undone_by = $3 WHERE after->>'batch' = $1 AND id <> $2 AND undone_at IS NULL", [batch, changeId, by]);

/**
 * History's Undo for 6b's seat lines (desk-seats.ts restoreSeat hands them here): a link taken back, someone taken out put
 * back, someone put back taken out again, a seat put back removed again, a removed seat back. A change made since stands in
 * the way, and then it says so and changes nothing.
 */
export async function restoreSeatMove(user: SessionUser, changeId: string, u: Record<string, unknown>): Promise<void> {
  const leagueId = String(u.leagueId);
  const batch = String(u.batch ?? "");
  const { rows: alive } = await pool.query("SELECT deleted_at FROM leagues WHERE id = $1", [leagueId]);
  if (!alive[0] || alive[0].deleted_at) throw new HttpError(409, "That game is gone");
  switch (u.do) {
    case "link": {
      const to = String(u.to);
      const playerId = String(u.playerId);
      const mine = u.mine as { playerId: string | null; role: LeagueRole } | null;
      const from = u.from as { userId: string; role: LeagueRole; slot?: number; seen: number | null; explainerSeenAt: string | null; couchVia: string | null } | null;
      if (from && !(await account(from.userId))) throw new HttpError(409, "The account that was in the seat was deleted");
      await withLeagueLock(leagueId, async (s, client) => {
        const { rows } = await client.query<MembershipRow>("SELECT user_id, player_id, role, results_seen_through, explainer_seen_at FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
        const now = rows.find((r) => r.user_id === to);
        if (!now || now.player_id !== playerId) throw new HttpError(409, "Who's in that seat has changed since: it can't go back");
        if (from && rows.some((r) => r.user_id === from.userId)) throw new HttpError(409, "The account that was in the seat is in the game again");
        if (mine?.playerId) {
          const old = players(s).find((p) => p.id === mine.playerId);
          if (!old || old.disabled) throw new HttpError(409, "Their old seat has changed since: it can't go back");
          if (rows.some((r) => r.player_id === mine.playerId)) throw new HttpError(409, "Someone's signed in to their old seat since");
        }
        const seat = players(s).find((p) => p.id === playerId);
        if (!seat || seat.disabled) throw new HttpError(409, "That seat has changed since: it can't go back");
        // Never a game left with no Commissioner by the Undo either.
        const after = rows.filter((r) => r.user_id !== to && r.role === "commissioner").length + (mine?.role === "commissioner" || from?.role === "commissioner" ? 1 : 0);
        if (rows.some((r) => r.role === "commissioner") && !after) throw new HttpError(409, "Every game needs a Commissioner: it can't go back");
        // Their old seat is empty (checked above): its first place. The account that came out takes back the place it held on a
        // team two people share (step A10 part 4b), which `to` held until now.
        if (mine) await client.query("UPDATE league_memberships SET player_id = $3, role = $4, seat_slot = 0 WHERE league_id = $1 AND user_id = $2", [leagueId, to, mine.playerId, mine.role]);
        else await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, to]);
        if (from)
          await client.query(
            "INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through, explainer_seen_at, seat_slot) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7)",
            [leagueId, from.userId, playerId, from.role, from.seen, from.explainerSeenAt, from.slot ?? 0]
          );
        if (seat.name === u.newName) seat.name = String(u.oldName);
        await markBatch(client, batch, user.id);
      });
      if (from) {
        await joinedLeague(leagueId, from.userId);
        if (from.couchVia === "game")
          await pool.query("UPDATE couch_members cm SET via = 'game' FROM leagues l WHERE l.id = $1 AND cm.couch_id = l.couch_id AND cm.user_id = $2", [leagueId, from.userId]);
      }
      // Off the couch again if the link brought them onto it and they've no game there now.
      if (!u.toOnCouch)
        await pool.query(
          `DELETE FROM couch_members cm USING leagues l WHERE l.id = $1 AND cm.couch_id = l.couch_id AND cm.user_id = $2 AND cm.role <> 'owner'
             AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues o ON o.id = m.league_id WHERE o.couch_id = l.couch_id AND m.user_id = $2)`,
          [leagueId, to]
        );
      else if (!mine) await stayedOnCouch(leagueId, to);
      break;
    }
    case "takeOut": {
      const { rows } = await pool.query("SELECT id, undo, undone_at FROM league_changes WHERE batch = $1 AND league_id = $2 AND undo->>'type' = 'member'", [batch, leagueId]);
      if (!rows[0]) throw new HttpError(409, "That one can't be undone here");
      if (rows[0].undone_at) throw new HttpError(409, "They're back in already");
      const undo = rows[0].undo as MemberUndo;
      await withLeagueLock(leagueId, async (s, client) => {
        await restoreMember(s, client, leagueId, undo);
        const { rowCount } = await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1 AND undone_at IS NULL", [rows[0].id, user.id]);
        if (!rowCount) throw new HttpError(409, "They're back in already");
      });
      await joinedLeague(leagueId, undo.userId);
      break;
    }
    case "putBack": {
      const userId = String(u.userId);
      const playerId = String(u.playerId);
      await withLeagueLock(leagueId, async (s, client) => {
        const { rows } = await client.query("SELECT user_id, player_id, role FROM league_memberships WHERE league_id = $1 FOR UPDATE", [leagueId]);
        const me = rows.find((r) => r.user_id === userId);
        if (!me || me.player_id !== playerId) throw new HttpError(409, "Their seat has changed since: it can't go back");
        const problem = lastCommissionerProblem(rows.map((r) => ({ userId: r.user_id, role: r.role })), userId, "member");
        if (problem) throw new HttpError(409, problem);
        if (u.added && (await movedOn(s, client, leagueId, u.picks))) throw new HttpError(409, "The draft has moved on since: take them out from their seat instead");
        const seat = players(s).find((p) => p.id === playerId);
        // The app's rule, as when they went: before a draft the seat goes, after one it's disabled again.
        await freeSeat(s, client, leagueId, seat, userId);
        await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
        // The line that took them out stands again, so the game's page says how they went.
        if (u.lineId) await client.query("UPDATE league_changes SET undone_at = NULL, undone_by = NULL WHERE id = $1", [String(u.lineId)]);
        await markBatch(client, batch, user.id);
      });
      await stayedOnCouch(leagueId, userId);
      break;
    }
    case "seatBack": {
      const playerId = String(u.playerId);
      await withLeagueLock(leagueId, async (s, client) => {
        const seat = players(s).find((p) => p.id === playerId);
        if (!seat || seat.disabled) throw new HttpError(409, "That seat has changed since: it can't go back");
        const { rows } = await client.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND player_id = $2", [leagueId, playerId]);
        if (rows.length) throw new HttpError(409, "Someone's signed in to that seat since");
        if (u.added) {
          if (await movedOn(s, client, leagueId, u.picks)) throw new HttpError(409, "The draft has moved on since: it can't go back");
          await freeSeat(s, client, leagueId, seat, "");
        } else StateLogic.disablePlayer(s, playerId);
        if (u.lineId) await client.query("UPDATE league_changes SET undone_at = NULL, undone_by = NULL WHERE id = $1", [String(u.lineId)]);
        await markBatch(client, batch, user.id);
      });
      break;
    }
    case "remove": {
      const playerId = String(u.playerId);
      await withLeagueLock(leagueId, async (s, client) => {
        const seat = players(s).find((p) => p.id === playerId);
        if (u.went) {
          if (seat) throw new HttpError(409, "That seat is back already");
          if (await movedOn(s, client, leagueId, u.picks)) throw new HttpError(409, "The draft has moved on since: put the seat back from the game's page");
          StateLogic.addPlayer(s, String(u.name));
        } else {
          if (!seat || !seat.disabled || seat.disabledFromUserId) throw new HttpError(409, "That seat is back already");
          StateLogic.reclaimPlayer(s, playerId);
        }
        const { rowCount } = await markBatch(client, batch, user.id);
        if (!rowCount) throw new HttpError(409, "That seat is back already");
      });
      break;
    }
    default:
      throw new HttpError(409, "That one can't be undone here");
  }
  await markDesk(batch, changeId, user.id);
}
