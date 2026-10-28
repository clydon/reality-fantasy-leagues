import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { castOf } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import { isUuid, type SessionUser } from "./auth-helpers";
import { outPreview, takeOut } from "./backstage-members";
import { plainChange, recordChange } from "./change-log";
import { couchMembers, ensureOwner, joinedLeague, newCouch, requireCouch } from "./couches";
import { pool, HttpError, withLeagueLock } from "./db";
import { followLeagueProgress } from "./follows";
import { EVERYTHING, seenThrough } from "./guard";
import { joinLeague } from "./join-league";
import { leagueStates } from "./league-states";
import { notifyCouchJoined, notifyJoinRequest, notifyLetIn, notifyMemberJoined } from "./push-events";
import { latestAired, seasonSchedules, upNext, type SeasonSchedule } from "./schedule";
import { endedThrough } from "./calls";
import { games, seasonHeaders, type Game } from "./show-space";

// Couches you start, join and leave, and joining the games on them (docs/PLAN-new-design.md step 9; the mock's round2.js
// newCouchSheet, joinRoute, catchupSheet, couchSwitch and settings.js' Who can join).
//
// A couch: anyone starts one (they own it), anyone on it invites with their own code (couch_invites, six letters and
// digits with nothing to misread), and anyone with a code joins it. Someone on a couch in its own right (couch_members.via
// 'couch') stays on it whatever happens to its games; only leaving the couch takes them off, and leaving takes them out of
// its games too (tier 3, each restorable from Recent changes for 30 days, as 6a's Leave these games).
//
// A game on the couch: its Who can join (GhostLogic.joinMode) is open (anyone on the couch joins on their own), ask
// (they ask, whoever runs it lets them in, and they then join on their own) or locked. A game that hasn't started
// (no draft done, no results) takes a new player as classic's join does (into the draft). One that's underway takes
// them as a late joiner made visible at once: castaways that can be on several teams (or no teams: Survival Pool) let them
// start live or catch up from the first episode, one episode at a time on the honor system; an exclusive game starts
// them live with a team from the free agents. Every join is a line in Recent changes.
//
// Spoiler-safe: nothing here says what happened in an episode. A live start's team is picked from who's still in, which
// the join sheet says before anyone asks for it; joining live leaves your mark where it was (you reveal the rest as
// anyone behind does).

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32: no I, O, 0 or 1
const MAX_COUCHES = 25;
const NAME_MAX = 40;

type Queryable = Pick<PoolClient, "query">;

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

/** A code as typed: upper case, letters and digits only. */
export function normalizeCode(code: unknown): string {
  return typeof code === "string" ? code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

function makeCode(): string {
  return Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/** This person's invite code for the couch: theirs if they have one, else a new one. */
async function codeFor(db: Queryable, couchId: string, userId: string): Promise<string> {
  const { rows } = await db.query(
    "SELECT code FROM couch_invites WHERE couch_id = $1 AND created_by = $2 AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at LIMIT 1",
    [couchId, userId]
  );
  if (rows.length) return rows[0].code as string;
  for (let i = 0; i < 6; i++) {
    const { rows: made } = await db.query("INSERT INTO couch_invites (code, couch_id, created_by) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING code", [
      makeCode(),
      couchId,
      userId,
    ]);
    if (made.length) return made[0].code as string;
  }
  throw new HttpError(500, "Couldn't make a code. Try again.");
}

const nameOf = (user: SessionUser) => (user as { username?: string | null }).username || user.name;

// ---------- couches ----------

/** Start a couch: you own it, and here's your code to send. */
export async function startCouch(user: SessionUser, rawName: unknown): Promise<{ id: string; name: string; code: string }> {
  const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new HttpError(400, "Give the couch a name");
  if (name.length > NAME_MAX) throw new HttpError(400, `Keep it under ${NAME_MAX} characters`);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE user_id = $1", [user.id]);
  if (rows[0].n >= MAX_COUCHES) throw new HttpError(429, `You're on ${MAX_COUCHES} couches. Leave one first.`);
  return tx(async (c) => {
    const id = await newCouch(c, name, user.id);
    await c.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'couch')", [id, user.id]);
    return { id, name, code: await codeFor(c, id, user.id) };
  });
}

/** Your code for a couch you're on (anyone on it can invite). */
export async function inviteCode(user: SessionUser, couchId: string): Promise<{ code: string }> {
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(403, "Only people on the couch invite to it");
  return { code: await codeFor(pool, couchId, user.id) };
}

/**
 * A new code for a couch you're on (step 15 part 1, from Noticed: invite codes never expire): your old one stops working (it's
 * retired, kept for the record) and a new one is made. Anyone already on the couch stays; nobody else's code changes.
 */
export async function newInviteCode(user: SessionUser, couchId: string): Promise<{ code: string }> {
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(403, "Only people on the couch invite to it");
  return tx(async (c) => {
    await c.query("UPDATE couch_invites SET expires_at = now() WHERE couch_id = $1 AND created_by = $2 AND (expires_at IS NULL OR expires_at > now())", [
      couchId,
      user.id,
    ]);
    return { code: await codeFor(c, couchId, user.id) };
  });
}

/** Whoever started a couch (its owner) renames it (step 15 part 1, from Noticed: no couch rename or hand-off). */
export async function renameCouch(user: SessionUser, couchId: string, rawName: unknown): Promise<{ name: string }> {
  if ((await requireCouch(user, couchId)) !== "owner") throw new HttpError(403, "Whoever started the couch names it");
  const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new HttpError(400, "Give the couch a name");
  if (name.length > NAME_MAX) throw new HttpError(400, `Keep it under ${NAME_MAX} characters`);
  await pool.query("UPDATE couches SET name = $2 WHERE id = $1", [couchId, name]);
  return { name };
}

/** The owner hands the couch on to someone else on it, who can rename it and hand it on again; the owner stays on it. */
export async function handOnCouch(user: SessionUser, couchId: string, to: unknown): Promise<{ owner: string }> {
  if ((await requireCouch(user, couchId)) !== "owner") throw new HttpError(403, "Only whoever started the couch hands it on");
  if (typeof to !== "string" || to === user.id) throw new HttpError(400, "Hand it to someone else on the couch");
  return tx(async (c) => {
    const { rows } = await c.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, to]);
    if (!rows.length) throw new HttpError(404, "They're not on the couch");
    await c.query("UPDATE couch_members SET role = 'member' WHERE couch_id = $1 AND user_id = $2", [couchId, user.id]);
    await c.query("UPDATE couch_members SET role = 'owner', via = 'couch' WHERE couch_id = $1 AND user_id = $2", [couchId, to]);
    return { owner: to };
  });
}

/** The couch a code leads to: a couch's invite, else (so the couch's old codes still work) a league's join code. */
async function couchOfCode(code: string): Promise<{ couchId: string; from: string | null } | null> {
  if (!code) return null;
  const { rows } = await pool.query(
    `SELECT i.couch_id, COALESCE(u.username, u.name) AS from_name FROM couch_invites i LEFT JOIN "user" u ON u.id = i.created_by
      WHERE i.code = $1 AND (i.expires_at IS NULL OR i.expires_at > now())`,
    [code]
  );
  if (rows.length) return { couchId: rows[0].couch_id, from: rows[0].from_name ?? null };
  const { rows: league } = await pool.query("SELECT couch_id FROM leagues WHERE join_code = $1 AND couch_id IS NOT NULL", [code]);
  return league.length ? { couchId: league[0].couch_id, from: null } : null;
}

export interface CouchInvite {
  code: string;
  couch: { id: string; name: string; size: number; faces: { userId: string; name: string }[] };
  /** Whoever's code it is: "riley saved you a seat". */
  from: string | null;
  signedIn: boolean;
  /** You're on it already. */
  onIt: boolean;
  /** The shows the couch is playing now, each with its games and who may join them. */
  seasons: CouchSeason[];
}

export interface CouchSeason {
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  /** The next episode to air, and the last that has. */
  next: number | null;
  aired: number;
  games: JoinGame[];
}

/** What an invite opens on (GET /api/couches/invite/[code]): the couch, then its games. Open signed out (the code is the key). */
export async function couchInvite(rawCode: unknown, viewer: SessionUser | null): Promise<CouchInvite> {
  const code = normalizeCode(rawCode);
  const found = await couchOfCode(code);
  if (!found) throw new HttpError(404, "No couch with that code. Check it with whoever sent it.");
  const { rows } = await pool.query("SELECT id, name FROM couches WHERE id = $1", [found.couchId]);
  if (!rows.length) throw new HttpError(404, "No couch with that code. Check it with whoever sent it.");
  const members = (await couchMembers([found.couchId])).get(found.couchId) ?? [];
  const list = await couchGameList(viewer, found.couchId);
  return {
    code,
    couch: { id: rows[0].id, name: rows[0].name, size: members.length, faces: members.slice(0, 6).map((m) => ({ userId: m.userId, name: m.name })) },
    from: found.from,
    signedIn: !!viewer,
    onIt: !!viewer && members.some((m) => m.userId === viewer.id),
    seasons: await bySeason(list.filter((g) => !g.ended)),
  };
}

/**
 * Join a couch with a code. Already on it: nothing changes (except you're on it in your own right now). `letIn`: an
 * account still waiting to get in (early access) whose invite lets it in (the desk's Who gets in, step 9 part 2), let
 * in with the join.
 */
export async function joinCouch(user: SessionUser, rawCode: unknown, opts: { letIn?: boolean } = {}): Promise<{ couchId: string; name: string; already: boolean }> {
  const found = await couchOfCode(normalizeCode(rawCode));
  if (!found) throw new HttpError(404, "No couch with that code. Check it with whoever sent it.");
  const { rows: count } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE user_id = $1", [user.id]);
  const joined = await tx(async (c) => {
    const { rows } = await c.query("SELECT name FROM couches WHERE id = $1 FOR UPDATE", [found.couchId]);
    if (!rows.length) throw new HttpError(404, "No couch with that code. Check it with whoever sent it.");
    if (opts.letIn) await c.query(`UPDATE "user" SET approved = true WHERE id = $1`, [user.id]);
    const { rows: was } = await c.query("SELECT via FROM couch_members WHERE couch_id = $1 AND user_id = $2", [found.couchId, user.id]);
    if (!was.length && count[0].n >= MAX_COUCHES) throw new HttpError(429, `You're on ${MAX_COUCHES} couches. Leave one first.`);
    await c.query(
      `INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')
       ON CONFLICT (couch_id, user_id) DO UPDATE SET via = 'couch'`,
      [found.couchId, user.id]
    );
    await ensureOwner(c, found.couchId);
    return { couchId: found.couchId, name: rows[0].name as string, already: was.length > 0 };
  });
  // Everyone already on it hears (step 15 part 2: Invites and join requests), once it's committed.
  if (!joined.already) notifyCouchJoined(joined.couchId, user.id, nameOf(user));
  return joined;
}

export interface LeaveCouch {
  name: string;
  /** Your games on it: leaving takes you out of them. */
  games: string[];
  drafted: boolean;
  /** Why you can't (the last Commissioner of a game there), or null. */
  problem: string | null;
  /** You started it: someone else will own it. */
  owner: boolean;
  batch: string | null;
}

/** Leave a couch (tier 3): out of its games too (restorable for 30 days), never as a game's last Commissioner. */
export async function leaveCouch(user: SessionUser, couchId: string, preview: boolean): Promise<LeaveCouch> {
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(404, "Couch not found");
  const mine = (await games(user.id, { couchIds: [couchId] })).filter((g) => g.yourRole);
  const out = await outPreview(mine, user.id);
  const { rows } = await pool.query("SELECT name FROM couches WHERE id = $1", [couchId]);
  const base = { name: rows[0]?.name ?? "the couch", games: out.games, drafted: out.drafted, problem: out.problem, owner: role === "owner" };
  if (preview || out.problem) {
    if (!preview && out.problem) throw new HttpError(409, out.problem);
    return { ...base, batch: null };
  }
  const batch = crypto.randomUUID();
  for (const g of mine) await takeOut(g.leagueId, user.id, { actor: user.id, batch, text: `${out.name} left the couch` });
  await tx(async (c) => {
    await c.query("DELETE FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, user.id]);
    await ensureOwner(c, couchId);
    const { rows: keep } = await c.query(
      "SELECT EXISTS (SELECT 1 FROM leagues WHERE couch_id = $1) OR EXISTS (SELECT 1 FROM couch_members WHERE couch_id = $1) AS keep",
      [couchId]
    );
    if (!keep[0].keep) await c.query("DELETE FROM couches WHERE id = $1", [couchId]);
  });
  return { ...base, batch };
}

// ---------- the games on a couch ----------

export type JoinMode = "open" | "ask" | "locked";

export interface JoinGame {
  leagueId: string;
  name: string;
  gameName: string;
  gameType: string;
  seasonId: string | null;
  /** Castaways can be on several teams (or there are no teams): a new player takes nothing and may catch up. */
  shared: boolean;
  mode: JoinMode;
  /** Its draft is done or an episode has results: a new player starts from an episode. */
  underway: boolean;
  /** The latest episode with results in it (0 for none): "Episodes 1 to 4 have aired". */
  latest: number;
  players: number;
  /** How many castaways a new player picks (0: no team, Survival Pool). */
  teamSize: number;
  /** Who runs it, who'd let you in. */
  runners: string[];
  ended: boolean;
  /** A game over a span (step 6 of docs/PLAN-sports-data.md): its first and last episode; null to the season's end. */
  span: { from: number; to: number } | null;
  /** The episode it starts with: a game started after a span ended is its run back. Null while it waits for its phase (step A3
   *  of docs/PLAN-start-a-game-gpt.md). */
  start: number | null;
  /** Locked down for the season (step 15 part 4: competitive mode): nobody new, whatever Who can join said. */
  lockedDown: boolean;
  /** You, signed in: in it, your request waiting, let in (yours to use). */
  you: { playing: boolean; asked: boolean; letIn: boolean } | null;
}

/** It's over: a winner, or nobody left, or its span's last episode is in (StateLogic.gameOver); for a game scored outside its
 *  state, its season's (or span's) last episode has aired. */
function gameOver(s: LeagueState, schedule: SeasonSchedule | undefined): boolean {
  const type = StateLogic.getLeagueType(s);
  return type.hasCalls || type.hasBingo ? endedThrough(schedule, latestAired(schedule), StateLogic.endEpisode(s)) : StateLogic.gameOver(s);
}

/** Every game on a couch with who may join it, in the couch's order. */
async function couchGameList(viewer: SessionUser | null, couchId: string): Promise<JoinGame[]> {
  const list = await games(viewer?.id ?? "", { couchIds: [couchId] });
  if (!list.length) return [];
  const ids = list.map((g) => g.leagueId);
  const seasonIds = [...new Set(list.map((g) => g.seasonId).filter((id): id is string => !!id))];
  const [states, { rows: memberRows }, { rows: asks }, schedules] = await Promise.all([
    leagueStates(ids),
    pool.query(
      `SELECT m.league_id, m.role, COALESCE(u.username, u.name) AS name FROM league_memberships m JOIN "user" u ON u.id = m.user_id
        WHERE m.league_id = ANY($1::uuid[]) ORDER BY m.created_at`,
      [ids]
    ),
    viewer
      ? pool.query(
          `SELECT DISTINCT ON (league_id) league_id, decided_at, outcome FROM game_join_requests
            WHERE league_id = ANY($1::uuid[]) AND user_id = $2 ORDER BY league_id, created_at DESC`,
          [ids, viewer.id]
        )
      : Promise.resolve({ rows: [] as { league_id: string; decided_at: Date | null; outcome: string | null }[] }),
    seasonSchedules(seasonIds),
  ]);
  const out: JoinGame[] = [];
  for (const g of list) {
    const s = states.get(g.leagueId);
    if (!s) continue;
    const G = StateLogic.GhostLogic;
    const ask = asks.find((a) => a.league_id === g.leagueId);
    out.push({
      leagueId: g.leagueId,
      name: g.name,
      gameName: g.gameName,
      gameType: g.gameType,
      seasonId: g.seasonId,
      shared: G.sharedJoin(s),
      mode: G.joinMode(s),
      underway: G.isUnderway(s),
      latest: StateLogic.SpoilerLogic.latestWithResults(s),
      players: s.players.filter((p) => !p.disabled && !G.isGhost(p)).length,
      teamSize: G.teamSize(s),
      runners: memberRows.filter((m) => m.league_id === g.leagueId && (m.role === "commissioner" || m.role === "admin")).map((m) => m.name as string),
      // An archived game (step 10 part 2b) takes nobody new, as a season that's over doesn't. A game scored outside its state
      // (Weekly Calls, Weekly Bingo: step 12) is over once its season's last episode has aired.
      ended: gameOver(s, g.seasonId ? schedules.get(g.seasonId) : undefined) || g.archived,
      span: StateLogic.endEpisode(s) === null || StateLogic.startEpisode(s) === null ? null : { from: StateLogic.startEpisode(s) as number, to: StateLogic.endEpisode(s) as number },
      start: StateLogic.startEpisode(s),
      lockedDown: G.lockedDown(s),
      you: viewer ? { playing: !!g.yourRole, asked: !!ask && !ask.decided_at, letIn: ask?.outcome === "let-in" } : null,
    });
  }
  return out;
}

/** Games grouped by their season, soonest-airing first, each with the show's art and where it is. */
async function bySeason(list: JoinGame[]): Promise<CouchSeason[]> {
  const seasonIds = [...new Set(list.map((g) => g.seasonId).filter((id): id is string => !!id))];
  if (!seasonIds.length) return [];
  const [headers, schedules] = await Promise.all([seasonHeaders(seasonIds), seasonSchedules(seasonIds)]);
  const out: CouchSeason[] = [];
  for (const id of seasonIds) {
    const h = headers.get(id);
    if (!h) continue;
    const sched = schedules.get(id);
    const next = upNext(sched);
    out.push({
      seasonId: id,
      name: h.show.name,
      seasonNumber: h.seasonNumber,
      artUrl: h.show.artUrl,
      next: next?.number ?? null,
      aired: latestAired(sched),
      games: list.filter((g) => g.seasonId === id),
    });
  }
  return out.sort((a, b) => (a.next ?? 999) - (b.next ?? 999));
}

/** The couch's games and who may join each (GET /api/couches/[id]/games): Commercial break, the join page, a show's Games. */
export async function couchGamesFor(user: SessionUser, couchId: string): Promise<{ seasons: CouchSeason[]; games: JoinGame[] }> {
  const role = await requireCouch(user, couchId);
  const list = await couchGameList(role === "viewer" ? null : user, couchId);
  return { seasons: await bySeason(list.filter((g) => !g.ended)), games: list };
}

async function gameOnCouch(user: SessionUser, couchId: string, leagueId: string): Promise<{ game: Game; state: LeagueState; join: JoinGame }> {
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(403, "Join the couch first");
  if (!isUuid(leagueId)) throw new HttpError(404, "That game isn't on this couch");
  const list = await couchGameList(user, couchId);
  const join = list.find((g) => g.leagueId === leagueId);
  const game = (await games(user.id, { couchIds: [couchId] })).find((g) => g.leagueId === leagueId);
  const state = (await leagueStates([leagueId])).get(leagueId);
  if (!join || !game || !state) throw new HttpError(404, "That game isn't on this couch");
  return { game, state, join };
}

export interface JoinOptions {
  game: JoinGame;
  /** Underway: start live (the next episode) or, when castaways can be on several teams, catch up from the first. */
  starts: { live: number; catchUp: number | null } | null;
  /** How far you've seen this show: a live start past it shows who's still in. */
  seen: number | null;
  /** The start these castaways are for, and how many to pick. */
  start: number | null;
  team: number;
  pool: { id: string; name: string; photo: string | null; tribe: { name: string; colour: string } | null }[];
}

/** Before joining an underway game: where you can start, and (for a start) the castaways to pick your team from. */
export async function joinOptions(user: SessionUser, couchId: string, leagueId: string, startAsked: unknown): Promise<JoinOptions> {
  const { game, state, join } = await gameOnCouch(user, couchId, leagueId);
  const G = StateLogic.GhostLogic;
  const seenMark = game.seasonId ? await seenThrough(user.id, game.seasonId) : 0;
  const seen = seenMark === EVERYTHING ? null : seenMark;
  if (!join.underway) return { game: join, starts: null, seen, start: null, team: 0, pool: [] };
  const live = join.latest + 1;
  const first = G.startChoices(state)[0] ?? 1;
  const starts = { live, catchUp: join.shared && first < live ? first : null };
  const n = Number(startAsked);
  const start = Number.isInteger(n) && (n === live || n === starts.catchUp) ? n : null;
  const team = G.teamSize(state);
  if (start === null || !team) return { game: join, starts, seen, start, team, pool: [] };
  const ids = new Set(G.draftPool(state, start, !join.shared));
  const view = StateLogic.SpoilerLogic.viewThrough(state, start - 1);
  const pool = castOf(view)
    .filter((c) => ids.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, photo: c.photo, tribe: c.tribe }));
  return { game: join, starts, seen, start, team, pool };
}

/** Join a game on the couch: open, or let in. Underway: `start` (live or catch up) and `team` (the castaways picked). */
export async function joinGame(user: SessionUser, couchId: string, leagueId: string, body: { start?: unknown; team?: unknown }) {
  const { game, state, join } = await gameOnCouch(user, couchId, leagueId);
  if (join.you?.playing) throw new HttpError(409, "You're already in it");
  if (join.ended) throw new HttpError(409, "That game's over");
  if (join.mode === "locked") throw new HttpError(403, join.lockedDown ? "This game is locked down for the season: nobody new joins" : "Nobody new can join this game");
  const { rows: letIn } = await pool.query(
    "SELECT id FROM game_join_requests WHERE league_id = $1 AND user_id = $2 AND outcome = 'let-in' ORDER BY decided_at DESC LIMIT 1",
    [leagueId, user.id]
  );
  if (join.mode === "ask" && !letIn.length) throw new HttpError(403, "Ask to join first");
  const used = async (c: Queryable) => {
    if (letIn.length) await c.query("UPDATE game_join_requests SET outcome = 'joined' WHERE id = $1", [letIn[0].id]);
  };
  const name = nameOf(user);
  const G = StateLogic.GhostLogic;

  // Not started yet, or coming back to a seat you left: classic's join (into the draft, or your old seat back).
  const ownSeat = state.players.some((p) => p.disabled && p.disabledFromUserId === user.id);
  if (!join.underway || ownSeat) {
    await joinLeague(leagueId, user, async (c) => {
      await used(c);
      await recordChange(c, leagueId, null, plainChange(user.id, "member", ownSeat ? `${name} came back to ${game.gameName}` : `${name} joined ${game.gameName}`));
    });
    return { leagueId, seasonId: game.seasonId, start: null as number | null, catchingUp: false };
  }

  const latest = join.latest;
  const live = latest + 1;
  const start = Number(body.start);
  const catchUpFrom = join.shared ? (G.startChoices(state)[0] ?? 1) : null;
  if (!Number.isInteger(start) || (start !== live && start !== catchUpFrom)) {
    throw new HttpError(400, join.shared ? `Start from Episode ${live}, or catch up from Episode ${catchUpFrom}` : `New players start from Episode ${live}`);
  }
  const team = Array.isArray(body.team) ? body.team.filter((x): x is string => typeof x === "string") : [];
  const seasonMark = game.seasonId ? await seenThrough(user.id, game.seasonId) : 0;
  const catchingUp = start - 1 < latest;
  // Catching up: your league starts at the episode before your start. Live: where you are, so anything since stays for
  // your reveal, as for anyone behind.
  const mark = catchingUp ? start - 1 : Math.min(start - 1, seasonMark === EVERYTHING ? start - 1 : seasonMark);
  const text = `${name} joined ${game.gameName}${catchingUp ? `, catching up from Episode ${start}` : ` from Episode ${start}`}`;
  await withLeagueLock(
    leagueId,
    async (s, client) => {
      const { rows: there } = await client.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
      if (there.length) throw new HttpError(409, "You're already in it");
      const p = StateLogic.addPlayer(s, name);
      if (!p.lateJoin) throw new HttpError(409, "Nobody new can join this game");
      const problem = G.begin(s, p.id, start, team, { freeAgents: !join.shared });
      if (problem) throw new HttpError(400, problem);
      // Seen at once: on the couch, a new player plays in the open (classic's ghosts are its own join's).
      G.convert(s, p.id);
      const lj = G.lateJoinOf(s, p.id);
      if (lj) lj.seenThrough = mark;
      await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, 'member', $4)", [
        leagueId,
        user.id,
        p.id,
        mark,
      ]);
      await used(client);
    },
    plainChange(user.id, "member", text)
  );
  await joinedLeague(leagueId, user.id);
  await followLeagueProgress(user.id, leagueId);
  notifyMemberJoined(leagueId, user.id, name, false);
  return { leagueId, seasonId: game.seasonId, start, catchingUp };
}

/** Ask to join a game whose Who can join is "Ask me first"; whoever runs it hears. */
export async function askToJoin(user: SessionUser, couchId: string, leagueId: string): Promise<{ asked: true }> {
  const { join } = await gameOnCouch(user, couchId, leagueId);
  if (join.you?.playing) throw new HttpError(409, "You're already in it");
  if (join.mode === "locked") throw new HttpError(403, "Nobody new can join this game");
  if (join.mode === "open") throw new HttpError(409, "Anyone on the couch can join this one");
  if (join.you?.letIn) throw new HttpError(409, "You're let in already: join it");
  const { rows } = await pool.query(
    `INSERT INTO game_join_requests (league_id, user_id) VALUES ($1, $2)
     ON CONFLICT (league_id, user_id) WHERE decided_at IS NULL DO NOTHING RETURNING id`,
    [leagueId, user.id]
  );
  if (rows.length) notifyJoinRequest(leagueId, join.seasonId, nameOf(user), join.gameName);
  return { asked: true };
}

/** Take back a request that's still waiting. */
export async function withdrawAsk(user: SessionUser, couchId: string, leagueId: string): Promise<{ asked: false }> {
  await requireCouch(user, couchId);
  if (!isUuid(leagueId)) throw new HttpError(404, "That game isn't on this couch");
  await pool.query(
    "UPDATE game_join_requests SET decided_at = now(), decided_by = $2, outcome = 'withdrawn' WHERE league_id = $1 AND user_id = $2 AND decided_at IS NULL",
    [leagueId, user.id]
  );
  return { asked: false };
}

export interface JoinRequest {
  id: string;
  leagueId: string;
  gameName: string;
  userId: string;
  name: string;
  at: string;
  /** On the couch less than a week. */
  newToCouch: boolean;
}

/** The requests waiting on these games (Backstage's Needs you, for whoever runs them). */
export async function requestsFor(games: { leagueId: string; gameName: string }[]): Promise<JoinRequest[]> {
  if (!games.length) return [];
  const { rows } = await pool.query(
    `SELECT r.id, r.league_id, r.user_id, r.created_at, COALESCE(u.username, u.name) AS name, l.couch_id,
            (SELECT cm.joined_at FROM couch_members cm WHERE cm.couch_id = l.couch_id AND cm.user_id = r.user_id) AS joined_at
       FROM game_join_requests r JOIN "user" u ON u.id = r.user_id JOIN leagues l ON l.id = r.league_id
      WHERE r.league_id = ANY($1::uuid[]) AND r.decided_at IS NULL ORDER BY r.created_at`,
    [games.map((g) => g.leagueId)]
  );
  const week = 7 * 24 * 3600 * 1000;
  return rows.map((r) => ({
    id: r.id,
    leagueId: r.league_id,
    gameName: games.find((g) => g.leagueId === r.league_id)?.gameName ?? "the game",
    userId: r.user_id,
    name: r.name,
    at: new Date(r.created_at).toISOString(),
    newToCouch: !r.joined_at || Date.now() - new Date(r.joined_at).getTime() < week,
  }));
}

/** Let someone in (they then join on their own) or decline, quietly. For whoever runs the game. */
export async function answerRequest(user: SessionUser, couchId: string, requestId: string, letIn: boolean): Promise<{ ok: true }> {
  await requireCouch(user, couchId);
  if (!isUuid(requestId)) throw new HttpError(404, "That request has been answered");
  const { rows } = await pool.query(
    `SELECT r.id, r.league_id, r.user_id, COALESCE(u.username, u.name) AS name, l.couch_id, l.name AS league_name
       FROM game_join_requests r JOIN "user" u ON u.id = r.user_id JOIN leagues l ON l.id = r.league_id
      WHERE r.id = $1 AND r.decided_at IS NULL`,
    [requestId]
  );
  const r = rows[0];
  if (!r || r.couch_id !== couchId) throw new HttpError(404, "That request has been answered");
  const { rows: me } = await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [r.league_id, user.id]);
  if (!(me[0]?.role === "commissioner" || me[0]?.role === "admin")) throw new HttpError(403, "Only whoever runs the game answers");
  const game = (await games(user.id, { couchIds: [couchId] })).find((g) => g.leagueId === r.league_id);
  // A game locked down since they asked (step 15 part 4) takes nobody new: decline is still yours.
  const st = letIn ? (await leagueStates([r.league_id])).get(r.league_id) : null;
  if (st && StateLogic.GhostLogic.lockedDown(st)) throw new HttpError(409, "This game is locked down for the season: nobody new joins");
  await tx(async (c) => {
    const { rowCount } = await c.query("UPDATE game_join_requests SET decided_at = now(), decided_by = $2, outcome = $3 WHERE id = $1 AND decided_at IS NULL", [
      requestId,
      user.id,
      letIn ? "let-in" : "declined",
    ]);
    if (!rowCount) throw new HttpError(404, "That request has been answered");
    if (letIn) await recordChange(c, r.league_id, null, plainChange(user.id, "member", `Let ${r.name} into ${game?.gameName ?? r.league_name}`));
  });
  if (letIn) notifyLetIn(r.league_id, game?.seasonId ?? null, r.user_id, nameOf(user), game?.gameName ?? r.league_name);
  return { ok: true };
}
