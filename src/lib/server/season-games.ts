import StateLogic from "@/lib/game/state-logic.js";
import { asItStands, leagueAnswers, storedAnswers, type AnswerRow } from "./answer-points";
import { sheetOf } from "./answers";
import { gameView, weekProgress, type GameRefIn, type GameView, type UserOf, type WeekProgress } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { leagueBingo } from "./bingo";
import { leagueCalls } from "./calls";
import { leaguePhases } from "./phase-starts";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { readyLeague } from "./league-read";
import { leagueStates } from "./league-states";
import type { ReadOnly } from "./read-only";
import { games, type Game } from "./show-space";

// Your games on a season, for the new design's show space (docs/PLAN-new-design.md step 1; GET
// /api/seasons/[id]/games): each one's moves, table, rules and cast as you may see them (game-view.ts), from your
// copy of the league at your mark. The writes go through the league routes the classic app uses (lineups, picks,
// predictions), so both designs play the same game.
//
// Spoiler-safe through guard.ts: your mark is the season's (seenThrough), or, for a late joiner catching up in a
// league, that league's own (their week), whichever is earlier. Not polled: read on opening the show and after a
// save. Each league's state comes through league-states.ts, so a second read costs a hash.

interface Seat {
  playerId: string;
  marked: number | null;
}

/** Your seat in each of these leagues, and every seat's account (for faces). A team two people share (step A10 part 4b:
 *  shared-seats.ts) is its first account's, except to someone on it, who sees it as theirs. */
async function seatsIn(userId: string, leagueIds: string[]) {
  const { rows } = await pool.query(
    "SELECT league_id, user_id, player_id, results_seen_through FROM league_memberships WHERE league_id = ANY($1::uuid[]) ORDER BY seat_slot, created_at",
    [leagueIds]
  );
  const mine = new Map<string, Seat>();
  const users = new Map<string, Map<string, string>>(leagueIds.map((id) => [id, new Map()]));
  for (const r of rows) {
    const seats = users.get(r.league_id);
    if (r.player_id && seats && (!seats.has(r.player_id) || r.user_id === userId)) seats.set(r.player_id, r.user_id);
    if (r.user_id === userId && r.player_id) mine.set(r.league_id, { playerId: r.player_id, marked: r.results_seen_through });
  }
  return { mine, users };
}

/** A league's mark for this viewer: the season's, or a catching-up late joiner's own week if earlier. */
function markFor(state: LeagueState, seat: Seat, seen: number): number | null {
  const late = StateLogic.GhostLogic.lateJoinOf(state, seat.playerId);
  if (late?.catchingUp) {
    const own = seat.marked ?? (Number.isInteger(late.startEpisode) ? (late.startEpisode as number) - 1 : 0);
    return Math.min(own, seen);
  }
  return seen === EVERYTHING ? null : seen;
}

/** One of your games on a season, ready to read: its state (league-read.ts), your seat, your mark there, faces. */
export interface GameHere {
  game: Game;
  ref: GameRefIn;
  state: LeagueState;
  playerId: string;
  /** Your mark for this league (markFor): null when you see everything. */
  mark: number | null;
  userOf: UserOf;
  /** Open read-only from the desk (read-only.ts): the couch's game with no seat of yours in it; `playerId` is "". */
  readOnly?: true;
  /** Step A11 part 2b: a game of questions that races or knocks players out, its answers, read once for its walk (answer-points.ts
   *  asItStands: `state` carries the league's as it stands) and reused by what reads it next. */
  answers?: AnswerRow[];
}

/** A league ready to read: a game of questions that races or knocks players out walked as it stands (step A11 part 2b). One that
 *  can't be walked (its answers unreadable) reads as it would without its knockouts, as any other reader without them does. Step A12
 *  part 4b: a game in stages' stage on another season at `userId`'s mark there. */
async function standingHere(leagueId: string, ready: LeagueState, userId: string): Promise<{ state: LeagueState; answers?: AnswerRow[] }> {
  try {
    const { state, rows } = await asItStands(leagueId, ready, undefined, { userId });
    return { state, answers: rows };
  } catch (e) {
    console.error(`[season-games] walk ${leagueId}:`, e);
    return { state: ready };
  }
}

/**
 * Your games on a season (with `couchId`, that couch's that you play), each with its ready state and your mark, in
 * the couch's order; and your season mark (guard.ts). Read by /games, /episodes and the reveal. One league's
 * unreadable state costs that game, not the show space. `ro`: the one game open read-only instead, as its couch sees it.
 * `only`: just that one (a game's questions, answers.ts).
 */
export async function gamesHere(user: SessionUser, seasonId: string, couchId: string | null, ro: ReadOnly | null = null, only?: string): Promise<{ seen: number; here: GameHere[] }> {
  if (ro) return readOnlyHere(user, seasonId, ro);
  const list = (await games(user.id, couchId ? { couchIds: [couchId], seasonId, withSolo: true } : { mine: true, seasonId })).filter((g) => g.yourRole && (!only || g.leagueId === only));
  const seen = await seenThrough(user.id, seasonId);
  const here: GameHere[] = [];
  if (list.length) {
    const ids = list.map((g) => g.leagueId);
    const [{ mine, users }, states] = await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]);
    for (const g of list) {
      const seat = mine.get(g.leagueId);
      const state = states.get(g.leagueId);
      if (!seat || !state) continue;
      try {
        const ready = await readyLeague(g.leagueId, state);
        const { state: walked, answers } = await standingHere(g.leagueId, ready, user.id);
        here.push({ game: g, ref: refOf(g), state: walked, playerId: seat.playerId, mark: markFor(ready, seat, seen), userOf: (p) => users.get(g.leagueId)?.get(p) ?? null, ...(answers ? { answers } : {}) });
      } catch (e) {
        console.error(`[season-games] league ${g.leagueId}:`, e);
      }
    }
  }
  return { seen, here };
}

/** The game open read-only (read-only.ts), at your own mark: no seat, so no late joiner's week of yours either. */
async function readOnlyHere(user: SessionUser, seasonId: string, ro: ReadOnly): Promise<{ seen: number; here: GameHere[] }> {
  const [[g], seen] = await Promise.all([games(user.id, { leagueId: ro.leagueId, seasonId }), seenThrough(user.id, seasonId)]);
  if (!g) return { seen, here: [] };
  const [{ users }, states] = await Promise.all([seatsIn(user.id, [g.leagueId]), leagueStates([g.leagueId])]);
  const state = states.get(g.leagueId);
  if (!state) return { seen, here: [] };
  try {
    const ready = await readyLeague(g.leagueId, state);
    const { state: walked, answers } = await standingHere(g.leagueId, ready, user.id);
    return {
      seen,
      here: [{ game: g, ref: refOf(g), state: walked, playerId: "", mark: seen === EVERYTHING ? null : seen, userOf: (p) => users.get(g.leagueId)?.get(p) ?? null, readOnly: true, ...(answers ? { answers } : {}) }],
    };
  } catch (e) {
    // As gamesHere: an unreadable state costs that game, not the show space (the Games tab says it can't be read).
    console.error(`[season-games] league ${g.leagueId}:`, e);
    return { seen, here: [] };
  }
}

export async function seasonGames(user: SessionUser, seasonId: string, couchId: string | null, ro: ReadOnly | null = null): Promise<{ seenThrough: number | null; games: GameView[] }> {
  const { seen, here } = await gamesHere(user, seasonId, couchId, ro);
  const out: GameView[] = [];
  for (const h of here) {
    try {
      out.push(await viewWithCalls(user, seasonId, h));
    } catch (e) {
      console.error(`[season-games] league ${h.game.leagueId}:`, e);
    }
  }
  return { seenThrough: Number.isFinite(seen) ? seen : null, games: out };
}

/** One of your games as you may see it, with the calls or bingo cards it reads (step 12: a pool's Who goes home?, Weekly Calls,
 *  Weekly Bingo), or a game of questions' answers (step A4). */
export async function viewWithCalls(user: SessionUser, seasonId: string, h: GameHere): Promise<GameView> {
  // Read-only: the couch's calls and lines, and no card, call or sheet of yours (none is dealt).
  const o = { state: h.state, couchId: h.game.couchId, seasonId, playerId: h.readOnly ? null : h.playerId, userId: user.id, mark: h.mark, userOf: h.userOf };
  // Step R1 part 2: which it reads is in the game's pieces (how it scores: its answers, bingo lines or the show's calls).
  const pieces = StateLogic.piecesOf(h.state);
  // A game of questions (step A4) ranks by its answers' points, graded at your mark (answer-points.ts); its answers are
  // read once for its table and its sheet.
  const rows = pieces.hasQuestions ? (h.answers ?? (await storedAnswers(h.game.leagueId).catch(() => undefined))) : undefined;
  const calls = await (pieces.hasQuestions ? leagueAnswers({ ...o, leagueId: h.game.leagueId, rows }) : pieces.hasBingo ? leagueBingo(o) : leagueCalls(o)).catch((e) => {
    console.error(`[season-games] calls ${h.game.leagueId}:`, e);
    return null;
  });
  const view = gameView(h.ref, h.state, h.readOnly ? null : h.playerId, h.mark, h.userOf, calls ?? undefined);
  // A game that starts when a phase does (step A3 of docs/PLAN-start-a-game-gpt.md): the phase by name, from its rulebook.
  const phase = StateLogic.startPhase(h.state);
  if (phase) view.phase = (await leaguePhases(pool, h.game.leagueId, seasonId)).find((p) => p.id === phase)?.name ?? phase;
  // A sheet of questions to answer now (step A4 part 2): a game of questions', or a draft's finale predictions (answers.ts).
  if (!h.readOnly && (pieces.hasQuestions || StateLogic.finaleOfGame(h.state))) {
    view.sheet = await sheetOf(user, seasonId, h, undefined, rows).catch((e) => {
      console.error(`[season-games] sheet ${h.game.leagueId}:`, e);
      return null;
    });
  }
  return view;
}

function refOf(g: Game): GameRefIn {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, yourRole: g.yourRole, solo: g.solo, archived: g.archived };
}

/**
 * Who's set for the next episode in each of these games with a weekly move (a lineup or a pick), by league, for the
 * hub's Up next (/api/me/home). Nothing about results; the states are the ones the home's moves just read, so each
 * costs a hash.
 */
export async function progressOf(user: SessionUser, these: Game[]): Promise<Map<string, WeekProgress>> {
  const out = new Map<string, WeekProgress>();
  if (!these.length) return out;
  const states = await leagueStates(these.map((g) => g.leagueId));
  // Step R1: a lineup's or a pool's (a game scored by moments, or by who survives: its spec's score.by), never a type compared by name.
  const weekly = these.filter((g) => {
    const s = states.get(g.leagueId);
    const scores = s ? StateLogic.piecesOf(s).scores : null;
    return scores === "moments" || scores === "survive";
  });
  if (!weekly.length) return out;
  const { mine: seats, users } = await seatsIn(user.id, weekly.map((g) => g.leagueId));
  for (const g of weekly) {
    const state = states.get(g.leagueId);
    if (!state) continue;
    try {
      const p = weekProgress(state, seats.get(g.leagueId)?.playerId ?? null, (id) => users.get(g.leagueId)?.get(id) ?? null, { counts: g.solo === "public" });
      if (p) out.set(g.leagueId, p);
    } catch (e) {
      console.error(`[season-games] progress ${g.leagueId}:`, e);
    }
  }
  return out;
}
