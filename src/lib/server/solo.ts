import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { gameView, type GameView } from "@/lib/game/game-view";
import { BOT_NAMES, practiceTeams, type PracticeGame } from "@/lib/game/practice";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, withLeagueLock, HttpError } from "./db";
import { existingSolo as existing, makeLeague } from "./new-game";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { followLeagueProgress } from "./follows";
import { gamesHere, type GameHere } from "./season-games";

// Playing solo (docs/PLAN-new-design.md step 9 part 3; the mock's solo.js): two kinds of game on no couch
// (db/migrations/0120's leagues.solo), both ordinary leagues the engine, the moves, the reveal and the season sync play
// as they play any game.
//
//   A season's public pool ("Survivor 51 · Everyone"): Survival Pool and a weekly Who goes home? call (PickEmLogic's
//   calls, settings.calls) against everyone on the app. Made by the first person to join; nobody runs it (every seat is a
//   member's), and its results are the season's shared facts, which the season sync brings to every league on the season.
//   Usernames only: its seats are named after accounts, there's no chat (couch-chat.ts has no couch; classic's chat routes
//   refuse it) and nobody hears who joined. Someone behind sees it at their mark like any game (game-view.ts through
//   guard.ts); its table is the top ten and you (game-view.ts poolTop), and who's picked is a count. It holds POOL_CAP
//   players: the whole pool is one league's state, read in full whenever it changed (docs/HOSTING.md).
//
//   A practice couch: you against three computer players (bot-logic.js) at one level (Easy / Normal / Sharp: casual,
//   solid, sharp) on one season's real results, Weekly Lineup or Outlast, a turn-based draft that starts at once. The bots
//   take their turns inside whatever write or read moves the league on (db.ts withLeagueLock -> bots.ts, league-read.ts
//   readyLeague), so nothing runs on a schedule. One per person and season; never counted toward a couch.
//
// Both are for a competition that's set up as a game (an admin's, or one a player made a game: step 10 part 2b) with its
// cast in and an episode still to come. Joining or starting underway plays from the next episode (startEpisode); someone
// behind is told the pick or the draft shows who's still in.

/** The most people one season's public pool holds (docs/HOSTING.md: its state is read in full after every change). */
export const POOL_CAP = 100;

export type BotLevel = "easy" | "normal" | "sharp";
const LEVEL: Record<BotLevel, "casual" | "solid" | "sharp"> = { easy: "casual", normal: "solid", sharp: "sharp" };
const LEVEL_OF: Record<string, BotLevel> = { casual: "easy", solid: "normal", sharp: "sharp" };
export type { PracticeGame };
const PRACTICE_NAME: Record<PracticeGame, string> = { "active-roster": "Weekly Lineup", "classic-draft": "Outlast" };

const nameOf = (user: SessionUser) => (user as { username?: string | null }).username || user.name;

interface SeasonRow {
  id: string;
  number: number;
  status: string;
  castIn: boolean;
  slug: string;
  showName: string;
  kind: string;
  /** Set up as a game (shows.set_up_at): an admin's show, or one someone made a game (step 10). */
  ready: boolean;
}

async function seasonRows(ids: string[]): Promise<Map<string, SeasonRow>> {
  const out = new Map<string, SeasonRow>();
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.status, ss.cast_approved_at IS NOT NULL AS cast_in, s.slug, s.name, s.kind,
            (s.archived = false AND s.set_up_at IS NOT NULL) AS ready
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = ANY($1::uuid[])`,
    [ids]
  );
  for (const r of rows) {
    out.set(r.id, { id: r.id, number: r.season_number, status: r.status, castIn: r.cast_in, slug: r.slug, showName: r.name, kind: r.kind, ready: r.ready });
  }
  return out;
}

/** The first episode whose picks are still open: the next to air. */
function nextOpen(schedule: SeasonSchedule | undefined, now: Date): number | null {
  for (const ep of schedule?.episodes ?? []) if (ep.airAt && new Date(ep.airAt).getTime() > now.getTime()) return ep.number;
  return null;
}

/** Why this season has no solo games, or null. */
export function soloBlocked(row: SeasonRow | undefined, schedule: SeasonSchedule | undefined, now = new Date()): string | null {
  if (!row || !row.ready) return "This show isn't set up for games yet";
  if (row.kind !== "competition") return "Solo games come to this kind of show later";
  if (!row.castIn) return "Its cast isn't in yet";
  if (row.status === "completed") return "The season's over";
  const eps = schedule?.episodes ?? [];
  if (eps.length && row.status !== "upcoming" && nextOpen(schedule, now) === null) return "Every episode has aired";
  return null;
}

/** Where a game made now starts: the next episode to air (1 before the premiere). */
function startNow(schedule: SeasonSchedule | undefined, now: Date): number {
  return nextOpen(schedule, now) ?? latestAired(schedule, now) + 1;
}

async function seasonFor(seasonId: string, now: Date): Promise<{ row: SeasonRow; schedule: SeasonSchedule | undefined }> {
  const [rows, schedules] = await Promise.all([seasonRows([seasonId]), seasonSchedules([seasonId], now)]);
  const row = rows.get(seasonId);
  if (!row) throw new HttpError(404, "Season not found");
  return { row, schedule: schedules.get(seasonId) };
}

const label = (row: SeasonRow) => `${row.showName.replace(/^The /, "")} ${row.number}`;

// ---------- the public pool ----------

/** The season's pool, made now if nobody has yet. */
async function poolLeague(row: SeasonRow, schedule: SeasonSchedule | undefined, now: Date): Promise<string> {
  const have = await existing("public", row.id, null);
  if (have) return have;
  const start = startNow(schedule, now);
  const made = await makeLeague(row, {
    name: `${label(row)} · Everyone`,
    solo: "public",
    createdBy: null,
    type: "pickem",
    after: (s) => {
      s.settings.calls = true;
      // Nobody new to a league is behind on its picks: it starts where it's made.
      if (start > 1) StateLogic.updateSettings(s, "startEpisode", start);
    },
  });
  return made ?? (await existing("public", row.id, null))!;
}

export interface PoolInfo {
  seasonId: string;
  label: string;
  /** Null: the season has a pool to join (or will, on the first Join); else why not. */
  blocked: string | null;
  leagueId: string | null;
  players: number;
  full: boolean;
  joined: boolean;
  /** Yours, as you may see it (game-view.ts at your mark: its table is the top ten and you). */
  game: GameView | null;
}

async function poolPlayers(leagueId: string | null): Promise<number> {
  if (!leagueId) return 0;
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM league_memberships WHERE league_id = $1", [leagueId]);
  return rows[0].n;
}

/** Your games on a season, ready to read (season-games.ts), when a solo read hasn't been handed them. */
const yoursOn = async (user: SessionUser, seasonId: string) => (await gamesHere(user, seasonId, null)).here;

/** A season's public pool for you: whether you can join it, how many are in, and yours if you're in. */
export async function poolFor(user: SessionUser, seasonId: string, now = new Date(), here?: GameHere[]): Promise<PoolInfo> {
  const { row, schedule } = await seasonFor(seasonId, now);
  const blocked = soloBlocked(row, schedule, now);
  const leagueId = await existing("public", seasonId, null);
  const players = await poolPlayers(leagueId);
  const h = leagueId ? (here ?? (await yoursOn(user, seasonId))).find((x) => x.game.leagueId === leagueId) : undefined;
  const mine = h ? viewOf(h) : null;
  return {
    seasonId,
    label: label(row),
    // A season over keeps your pool to look at; only new joins stop.
    blocked: mine ? null : blocked,
    leagueId,
    players,
    full: players >= POOL_CAP,
    joined: !!mine,
    game: mine,
  };
}

const viewOf = (h: GameHere) => gameView(h.ref, h.state, h.playerId, h.mark, h.userOf);

/** Join a season's public pool (made now if it's the first): from the next episode to air, never catching up. */
export async function joinPool(user: SessionUser, seasonId: string, now = new Date()): Promise<{ leagueId: string; start: number }> {
  const { row, schedule } = await seasonFor(seasonId, now);
  const blocked = soloBlocked(row, schedule, now);
  if (blocked) throw new HttpError(409, blocked);
  const leagueId = await poolLeague(row, schedule, now);
  const name = nameOf(user);
  let start = 1;
  await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query("SELECT count(*)::int AS n, bool_or(user_id = $2) AS mine FROM league_memberships WHERE league_id = $1", [leagueId, user.id]);
    if (rows[0].mine) throw new HttpError(409, "You're already in it");
    if (rows[0].n >= POOL_CAP) throw new HttpError(409, `The ${label(row)} pool is full`);
    // Where a pick is still open: this episode's until it airs, else the next.
    const { ep, open } = poolWindow(s);
    start = Math.max(StateLogic.startEpisode(s), ep ? (open ? ep.number : ep.number + 1) : 1);
    const p = StateLogic.addPlayer(s, name);
    // Its own season starts here: earlier episodes are history, not missed picks (PickEmLogic.history). Seen at once (no
    // ghost: a pool has nobody to let them in), and never catching up.
    if (start > StateLogic.startEpisode(s)) {
      p.lateJoin = { startEpisode: start, catchingUp: false };
      StateLogic.ensureEpisodeNumber(s, start, false);
    } else delete p.lateJoin;
    StateLogic.GhostLogic.convert(s, p.id);
    await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')", [leagueId, user.id, p.id]);
  });
  await followLeagueProgress(user.id, leagueId);
  return { leagueId, start };
}

function poolWindow(s: LeagueState) {
  const ep = StateLogic.pickEmUpcomingEpisode(s);
  return { ep, open: !!ep && !StateLogic.pickEmDecided(ep, s) && !StateLogic.hasAired(ep) };
}

async function seatIn(leagueId: string, userId: string): Promise<string> {
  const { rows } = await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
  if (!rows.length) throw new HttpError(404, "You're not in it");
  return rows[0].player_id as string;
}

/** Leave the pool: your seat and its picks go (a pool has no draft to keep them for). */
export async function leavePool(user: SessionUser, seasonId: string): Promise<{ left: true }> {
  const leagueId = await existing("public", seasonId, null);
  if (!leagueId) throw new HttpError(404, "You're not in it");
  const playerId = await seatIn(leagueId, user.id);
  await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.removePlayer(s, playerId);
    await client.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
  });
  return { left: true };
}

/** Your Who goes home? call for the pool's open episode (null takes it back). */
export async function callPool(user: SessionUser, seasonId: string, castawayId: unknown): Promise<{ call: string | null }> {
  const leagueId = await existing("public", seasonId, null);
  if (!leagueId) throw new HttpError(404, "You're not in it");
  const playerId = await seatIn(leagueId, user.id);
  let call: string | null = null;
  await withLeagueLock(leagueId, (s) => {
    const { ep, open } = poolWindow(s);
    if (!ep || !open) throw new HttpError(409, "Calls for this episode closed when it started");
    if (StateLogic.GhostLogic.startFor(s, playerId) > ep.number) throw new HttpError(409, `Your pool starts with Episode ${StateLogic.GhostLogic.startFor(s, playerId)}`);
    if (castawayId === null) StateLogic.removePickEmCall(s, ep.id, playerId);
    else if (typeof castawayId === "string") {
      StateLogic.setPickEmCall(s, ep.id, playerId, castawayId);
      if (StateLogic.pickEmCallFor(s, ep.id, playerId)?.castawayId !== castawayId) throw new HttpError(400, "They can't be called: pick someone still in");
    } else throw new HttpError(400, "castawayId required");
    call = StateLogic.pickEmCallFor(s, ep.id, playerId)?.castawayId ?? null;
  });
  return { call };
}

// ---------- the practice couch ----------

export interface PracticeInfo {
  seasonId: string;
  label: string;
  blocked: string | null;
  leagueId: string | null;
  gameName: string | null;
  level: BotLevel | null;
  /** Your game, as you may see it (null before you start one). */
  game: GameView | null;
  drafting: boolean;
}

export async function practiceFor(user: SessionUser, seasonId: string, now = new Date(), here?: GameHere[]): Promise<PracticeInfo> {
  const { row, schedule } = await seasonFor(seasonId, now);
  const leagueId = await existing("practice", seasonId, user.id);
  const h = leagueId ? (here ?? (await yoursOn(user, seasonId))).find((x) => x.game.leagueId === leagueId) : undefined;
  const game = h ? viewOf(h) : null;
  const bot = h?.state.players.find((p) => p.automated);
  return {
    seasonId,
    label: label(row),
    blocked: leagueId ? null : soloBlocked(row, schedule, now),
    leagueId: h ? leagueId : null,
    gameName: game?.gameName ?? null,
    level: bot ? (LEVEL_OF[(bot as { botLevel?: string }).botLevel ?? "solid"] ?? "normal") : null,
    game,
    drafting: !!h && !(StateLogic.currentDraftTurn(structuredClone(h.state))?.isComplete ?? true),
  };
}

/** Start your practice couch on a season: you and three computer players, the draft open at once in a random order. */
export async function startPractice(user: SessionUser, seasonId: string, body: { game?: unknown; level?: unknown }, now = new Date()): Promise<{ leagueId: string }> {
  if (body.game !== "active-roster" && body.game !== "classic-draft") throw new HttpError(400, "Choose Weekly Lineup or Outlast");
  const game: PracticeGame = body.game;
  const level: BotLevel = body.level === "easy" || body.level === "normal" || body.level === "sharp" ? body.level : "normal";
  const { row, schedule } = await seasonFor(seasonId, now);
  const blocked = soloBlocked(row, schedule, now);
  if (blocked) throw new HttpError(409, blocked);
  if (await existing("practice", seasonId, user.id)) throw new HttpError(409, "You have a practice couch on this season: end it to start another");
  const start = startNow(schedule, now);
  let human = "";
  const leagueId = await makeLeague(row, {
    name: `Practice · ${PRACTICE_NAME[game]}`,
    solo: "practice",
    createdBy: user.id,
    type: game,
    before: (s) => {
      human = StateLogic.addPlayer(s, nameOf(user)).id;
      for (const name of BOT_NAMES) {
        const bot = StateLogic.addPlayer(s, name, { automated: true });
        (bot as { botLevel?: string }).botLevel = LEVEL[level];
      }
    },
    after: async (s, client, id) => {
      // Your seat's membership in the same transaction as the setup: a game of yours never exists without you in it.
      await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')", [id, user.id, human]);
      // A turn-based draft (castaways on one team each), its teams fitted to who's still in.
      StateLogic.updateSettings(s, "ownershipMode", "exclusive");
      const teams = practiceTeams(game, s.castaways.filter((c) => c.status === "active").length);
      if (!teams) throw new HttpError(409, `Too few are left in ${label(row)} to draft four teams`);
      for (const [k, v] of Object.entries(teams)) StateLogic.updateSettings(s, k, v);
      if (start > 1) StateLogic.updateSettings(s, "startEpisode", start);
      StateLogic.updateSettings(s, "waiverRecommendation", "balanced");
      StateLogic.syncDraftOrder(s);
      for (let i = s.draftOrder.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [s.draftOrder[i], s.draftOrder[j]] = [s.draftOrder[j], s.draftOrder[i]];
      }
      StateLogic.forceStartDraft(s);
    },
  }).catch(async (e) => {
    // A refused setup leaves its half-made league behind: take it away.
    await pool.query("DELETE FROM leagues WHERE solo = 'practice' AND solo_season_id = $1 AND created_by = $2", [seasonId, user.id]);
    throw e;
  });
  if (!leagueId) throw new HttpError(409, "You have a practice couch on this season already");
  // Whoever drafts before you has picked already: the bots took their turns in the write that opened the draft.
  await followLeagueProgress(user.id, leagueId);
  return { leagueId };
}

/** End your practice couch on a season: the game and its draft go. */
export async function endPractice(user: SessionUser, seasonId: string): Promise<{ ended: true }> {
  const leagueId = await existing("practice", seasonId, user.id);
  if (!leagueId) throw new HttpError(404, "No practice couch here");
  await pool.query("DELETE FROM leagues WHERE id = $1 AND solo = 'practice' AND created_by = $2", [leagueId, user.id]);
  return { ended: true };
}

// ---------- the solo hub ----------

export interface SoloSeason {
  seasonId: string;
  pool: PoolInfo;
  practice: PracticeInfo;
}

/** Each of your shows' solo games (the solo hub's Play on your own): the season's pool and your practice couch there. */
export async function soloFor(user: SessionUser, now = new Date()): Promise<{ seasons: SoloSeason[] }> {
  const { rows } = await pool.query(
    `SELECT season_id FROM show_follows WHERE user_id = $1 AND following
     UNION SELECT solo_season_id FROM leagues l JOIN league_memberships m ON m.league_id = l.id
      WHERE m.user_id = $1 AND l.solo IS NOT NULL AND l.solo_season_id IS NOT NULL`,
    [user.id]
  );
  const ids = rows.map((r) => r.season_id as string);
  const [seasons, schedules] = await Promise.all([seasonRows(ids), seasonSchedules(ids, now)]);
  const out: SoloSeason[] = [];
  for (const id of ids) {
    const row = seasons.get(id);
    const schedule = schedules.get(id);
    // A season with nothing to play and nothing of yours is left out.
    const mine = await pool.query("SELECT 1 FROM leagues l JOIN league_memberships m ON m.league_id = l.id WHERE m.user_id = $1 AND l.solo IS NOT NULL AND l.solo_season_id = $2", [user.id, id]);
    if (soloBlocked(row, schedule, now) && !mine.rows.length) continue;
    const here = mine.rows.length ? await yoursOn(user, id) : [];
    const [p, pr] = await Promise.all([poolFor(user, id, now, here), practiceFor(user, id, now, here)]);
    out.push({ seasonId: id, pool: p, practice: pr });
  }
  // Soonest to air first, as the hub's shows are; then by name.
  const soon = (s: SoloSeason) => schedules.get(s.seasonId)?.episodes.find((e) => e.airAt && new Date(e.airAt) > now)?.airAt ?? "9";
  out.sort((a, b) => soon(a).localeCompare(soon(b)) || a.pool.label.localeCompare(b.pool.label));
  return { seasons: out };
}
