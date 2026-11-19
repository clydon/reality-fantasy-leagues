import StateLogic from "@/lib/game/state-logic.js";
import { asItStands, keepsAnswers, leagueAnswers, storedAnswers, type AnswerRow } from "./answer-points";
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
import { paceMarks, type MarkMemo } from "./own-pace-seats";
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
  // Every seat's mark, for a game at your own pace (where the others are): a shared seat's is its lowest.
  const marks = new Map<string, Map<string, number | null>>(leagueIds.map((id) => [id, new Map()]));
  for (const r of rows) {
    const seats = users.get(r.league_id);
    if (r.player_id && seats && (!seats.has(r.player_id) || r.user_id === userId)) seats.set(r.player_id, r.user_id);
    if (r.user_id === userId && r.player_id) mine.set(r.league_id, { playerId: r.player_id, marked: r.results_seen_through });
    const m = marks.get(r.league_id);
    if (r.player_id && m) {
      const was = m.get(r.player_id);
      const now = r.results_seen_through as number | null;
      m.set(r.player_id, was === undefined ? now : was === null || now === null ? null : Math.min(was, now));
    }
  }
  return { mine, users, marks };
}

/**
 * A waiver moment you've reached (docs/PLAN-own-pace-games.md, sync point 2): the earliest episode up to your mark where someone's
 * team lost a person and its waiver week hasn't settled, in a game with exclusive teams and waivers. Who isn't there yet (its
 * people, by their marks; computer players keep pace), and whether its week is on.
 */
function gatherOf(state: LeagueState, mark: number | null, me: string): NonNullable<GameView["pace"]>["gather"] {
  const G = StateLogic.GhostLogic;
  const W = StateLogic.WaiverLogic;
  if (!G.draftsTogether(state) || !G.draftDone(state) || !W.enabled(state) || mark === null) return null;
  const start = StateLogic.startEpisode(state) ?? 1;
  const periods = W.periods(state);
  for (let n = start; n <= mark; n++) {
    const ep = state.episodes.find((e) => e.number === n);
    if (!ep) continue;
    const week = periods.find((p) => p.episode === n);
    if (week && week.phase !== "open") continue;
    const lost = state.castaways.filter((c) => c.exitEpisodeId === ep.id && W.lossOpen(state, c));
    if (!lost.length) continue;
    const waiting = state.players
      .filter((p) => p.id !== me && !p.automated && !p.disabled && p.lateJoin && (p.lateJoin.seenThrough ?? (p.lateJoin.startEpisode ?? 1) - 1) < n)
      .map((p) => p.name);
    const teamOf = (c: (typeof lost)[number]) => state.players.find((p) => p.id === (c.ownerIds ?? [])[0])?.name ?? "someone";
    return { episode: n, lost: lost.map((c) => ({ name: c.name, team: teamOf(c), yours: (c.ownerIds ?? []).includes(me) })), waiting, open: !!week && !waiting.length };
  }
  return null;
}

/**
 * A game at your own pace (docs/PLAN-own-pace-games.md): everyone else in it (not its computer players, which are never behind
 * anyone) and the episode they're on, null once they've finished. The words a strip and the reveal button make of it are the
 * sheet's (src/new/couch/pace.ts); nothing here locks.
 */
function othersIn(state: LeagueState, me: string, marks: Map<string, number | null> | undefined): { name: string; week: number | null }[] {
  const G = StateLogic.GhostLogic;
  return state.players
    .filter((p) => p.id !== me && !p.disabled && !p.automated && G.lateJoinOf(state, p.id))
    .map((p) => {
      const lj = G.lateJoinOf(state, p.id)!;
      const mark = marks?.get(p.id) ?? (Number.isInteger(lj.startEpisode) ? (lj.startEpisode as number) - 1 : 0);
      return { name: p.name, week: lj.catchingUp ? mark + 1 : null };
    });
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

/**
 * Whether a game is over as far as `mark` has seen (null: everything), from its state alone, before it's read in full (E2: a season of
 * short games is mostly over, and the running games and the archive's page are all a read needs in full): over (StateLogic.gameOver:
 * its span's last episode in, or won early) and your mark at its last episode (lastEpisode). A game to the season's end isn't, until
 * its finale. The full view's `over` agrees (check-short-games.js holds the two to it).
 */
export function overByMark(state: LeagueState, mark: number | null): boolean {
  const last = StateLogic.lastEpisode(state);
  return last !== null && StateLogic.gameOver(state) && (mark === null || mark >= last);
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
  /** Every seat's mark, by player (seatsIn): a game at your own pace says where the others are. */
  marks?: Map<string, number | null>;
  /** Step A11 part 2b: a game of questions that races or knocks players out, its answers, read once for its walk (answer-points.ts
   *  asItStands: `state` carries the league's as it stands) and reused by what reads it next; step C2 part 4c, a draft's own
   *  questions', for their lines. */
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
export async function gamesHere(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  ro: ReadOnly | null = null,
  only?: string | ReadonlySet<string>,
  o: { over?: "skip" } = {}
): Promise<{ seen: number; here: GameHere[] }> {
  if (ro) return readOnlyHere(user, seasonId, ro);
  const wanted = (id: string) => !only || (typeof only === "string" ? id === only : only.has(id));
  const list = (await games(user.id, couchId ? { couchIds: [couchId], seasonId, withSolo: true } : { mine: true, seasonId })).filter((g) => g.yourRole && wanted(g.leagueId));
  const seen = await seenThrough(user.id, seasonId);
  const here: GameHere[] = [];
  if (list.length) {
    const ids = list.map((g) => g.leagueId);
    const [{ mine, users, marks }, states] = await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]);
    for (const g of list) {
      const seat = mine.get(g.leagueId);
      const state = states.get(g.leagueId);
      if (!seat || !state) continue;
      // E2: a game over as far as you've seen, left out before it's read in full (its state says so: overByMark).
      if (o.over === "skip" && overByMark(state, markFor(state, seat, seen))) continue;
      try {
        const ready = await readyLeague(g.leagueId, state);
        const { state: walked, answers } = await standingHere(g.leagueId, ready, user.id);
        here.push({
          game: g,
          ref: refOf(g),
          state: walked,
          playerId: seat.playerId,
          mark: markFor(ready, seat, seen),
          userOf: (p) => users.get(g.leagueId)?.get(p) ?? null,
          marks: marks.get(g.leagueId),
          ...(answers ? { answers } : {}),
        });
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

/**
 * Your games on a season as you may see them (the Games tab). E2 (docs/PLAN-start-a-game-redo.md, "Short games at scale"):
 * `o.running`, only those not over as far as you've seen (the Games tab of Round 3's design, which holds what's on; the rest are the
 * archive's: seasonArchive). A game over for you reads without its sheet or the others' marks (nothing's open, nobody's waited on).
 */
export async function seasonGames(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  ro: ReadOnly | null = null,
  o: { running?: boolean; only?: ReadonlySet<string> } = {}
): Promise<{ seenThrough: number | null; games: GameView[] }> {
  const { seen, here } = await gamesHere(user, seasonId, couchId, ro, o.only, o.running ? { over: "skip" } : {});
  const out: GameView[] = [];
  // E2: the people's marks, read once for all of the season's games (paceMarks).
  const memo: MarkMemo = new Map();
  for (const h of here) {
    try {
      const view = await viewWithCalls(user, seasonId, h, memo);
      if (!o.running || !view.over) out.push(view);
    } catch (e) {
      console.error(`[season-games] league ${h.game.leagueId}:`, e);
    }
  }
  return { seenThrough: Number.isFinite(seen) ? seen : null, games: out };
}

/** One finished game, kept small for the archive (E2): its name and kind, the episodes it ran, who won it and your place, as far as
 *  you've seen (only a game over by your mark is in it). */
export interface ArchivedGame {
  leagueId: string;
  name: string;
  gameName: string;
  from: number | null;
  to: number | null;
  players: number;
  /** Who won it (ties share it): their names, and whether one is you. */
  winners: { name: string; you: boolean }[];
  /** Your place and total, or null when you didn't play it (read-only). */
  you: { rank: string; place: number; total: number } | null;
}

/**
 * The archive (E2; Round 3's design shows it: B3): your games on a season that are over as far as you've seen, newest first (by the
 * episode each ended), a page at a time: `before` an episode (the last page's oldest `to`), `limit` of them (20 by default, 50 at
 * most; a page ends on a whole episode, so it can hold a few more), and whether there are more. Spoiler-safe as the Games tab is: each read at your mark, so a game whose end you haven't seen
 * isn't in it yet (it's on the Games tab, running for you). Each read in full and kept small here: a finished game costs about 10 ms
 * (no sheet, no marks), so nothing is stored for it (the plan's E2 notes why).
 */
export async function seasonArchive(user: SessionUser, seasonId: string, couchId: string | null, o: { before?: number | null; limit?: number } = {}): Promise<{ seenThrough: number | null; games: ArchivedGame[]; more: boolean }> {
  const limit = Math.max(1, Math.min(50, Number.isInteger(o.limit) ? (o.limit as number) : 20));
  // Which games are over for you, and where each ended, from their states alone (overByMark); then only the page's read in full.
  const list = (await games(user.id, couchId ? { couchIds: [couchId], seasonId, withSolo: true } : { mine: true, seasonId })).filter((g) => g.yourRole);
  const seen = await seenThrough(user.id, seasonId);
  const ids = list.map((g) => g.leagueId);
  const [{ mine }, states] = ids.length ? await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]) : [{ mine: new Map() }, new Map()];
  const over: { id: string; name: string; ended: number }[] = [];
  for (const g of list) {
    const seat = mine.get(g.leagueId);
    const state = states.get(g.leagueId);
    if (!seat || !state || !overByMark(state, markFor(state, seat, seen))) continue;
    const ended = StateLogic.lastEpisode(state) as number;
    if (o.before == null || ended < o.before) over.push({ id: g.leagueId, name: g.name, ended });
  }
  over.sort((a, b) => b.ended - a.ended || a.name.localeCompare(b.name));
  // A page ends on a whole episode (its last episode's other games come with it), so the next page's `before` misses none.
  let n = Math.min(limit, over.length);
  while (n < over.length && over[n].ended === over[n - 1].ended) n++;
  const order = new Map(over.slice(0, n).map((x, i) => [x.id, i]));
  const { games: views } = await seasonGames(user, seasonId, couchId, null, { only: new Set(order.keys()) });
  const page = views
    .filter((g) => g.over)
    .sort((a, b) => (order.get(a.leagueId) ?? 0) - (order.get(b.leagueId) ?? 0))
    .map((g): ArchivedGame => {
    const top = g.table.filter((r) => r.place === 1);
    const mine = g.table.find((r) => r.you);
    return {
      leagueId: g.leagueId,
      name: g.name,
      gameName: g.gameName,
      from: g.from,
      to: g.to ?? g.through,
      players: g.players,
      winners: top.map((r) => ({ name: r.name, you: r.you })),
      you: mine ? { rank: mine.rank, place: mine.place, total: mine.total } : null,
    };
  });
  return { seenThrough: Number.isFinite(seen) ? seen : null, games: page, more: over.length > n };
}

/**
 * The couch's games here that you don't play (the castaway sheet's In the couch's games: the user, 2026-11-17, "couch games that
 * are still active"), each read only at your own mark as the desk's read-only view reads one (readOnlyHere), and only while it's
 * on: not archived, not over by your mark. Asked for by the sheet alone (`?others=1`), so Tonight, the Games tab and every move
 * stay about your own games.
 */
export async function couchOthers(user: SessionUser, seasonId: string, couchId: string): Promise<{ games: GameView[] }> {
  const [list, seen] = await Promise.all([games(user.id, { couchIds: [couchId], seasonId }), seenThrough(user.id, seasonId)]);
  const theirs = list.filter((g) => !g.yourRole && !g.archived && !g.solo);
  if (!theirs.length) return { games: [] };
  const ids = theirs.map((g) => g.leagueId);
  const [{ users }, states] = await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]);
  const out: GameView[] = [];
  const memo: MarkMemo = new Map();
  for (const g of theirs) {
    const state = states.get(g.leagueId);
    if (!state) continue;
    try {
      const ready = await readyLeague(g.leagueId, state);
      const { state: walked, answers } = await standingHere(g.leagueId, ready, user.id);
      const h: GameHere = { game: g, ref: refOf(g), state: walked, playerId: "", mark: seen === EVERYTHING ? null : seen, userOf: (p) => users.get(g.leagueId)?.get(p) ?? null, readOnly: true, ...(answers ? { answers } : {}) };
      const view = await viewWithCalls(user, seasonId, h, memo);
      if (!view.over) out.push(view);
    } catch (e) {
      console.error(`[season-games] couch game ${g.leagueId}:`, e);
    }
  }
  return { games: out };
}

/** One of your games as you may see it, with the calls or bingo cards it reads (step 12: a pool's Who goes home?, Weekly Calls,
 *  Weekly Bingo), or a game of questions' answers (step A4). */
export async function viewWithCalls(user: SessionUser, seasonId: string, h: GameHere, memo?: MarkMemo): Promise<GameView> {
  // Read-only: the couch's calls and lines, and no card, call or sheet of yours (none is dealt).
  const o = { state: h.state, couchId: h.game.couchId, seasonId, playerId: h.readOnly ? null : h.playerId, userId: user.id, mark: h.mark, userOf: h.userOf };
  // Step R1 part 2: which it reads is in the game's pieces (how it scores: its answers, bingo lines or the show's calls).
  const pieces = StateLogic.piecesOf(h.state);
  // A game of questions (step A4) ranks by its answers' points, graded at your mark (answer-points.ts); its answers are
  // read once for its table and its sheet. Step C2 part 4c: a draft's own questions, graded the same way, a line of its table.
  const asks = keepsAnswers(h.state);
  const rows = asks ? (h.answers ?? (await storedAnswers(h.game.leagueId).catch(() => undefined))) : undefined;
  const calls = await (asks ? leagueAnswers({ ...o, leagueId: h.game.leagueId, rows }) : pieces.hasBingo ? leagueBingo(o) : leagueCalls(o)).catch((e) => {
    console.error(`[season-games] calls ${h.game.leagueId}:`, e);
    return null;
  });
  // Anyone playing it at their own pace (docs/PLAN-own-pace-games.md): their marks, for whoever the couch is waiting on. A game
  // that's over as far as you've seen waits on nobody, so it's read without them (E2: a season of short games is mostly over).
  let view = gameView(h.ref, h.state, h.readOnly ? null : h.playerId, h.mark, h.userOf, calls ?? undefined, { marks: new Map() });
  if (!view.over) {
    const marks = await paceMarks(h.game.leagueId, h.state, undefined, memo).catch(() => new Map<string, number>());
    if (marks.size) view = gameView(h.ref, h.state, h.readOnly ? null : h.playerId, h.mark, h.userOf, calls ?? undefined, { marks });
  }
  // A game at your own pace: where the others are, for its plate and its reveal button, and the season's last episode
  // (docs/PLAN-own-pace-games.md).
  if (!h.readOnly && StateLogic.GhostLogic.ownPace(h.state)) {
    const G = StateLogic.GhostLogic;
    const start = G.lateJoinOf(h.state, h.playerId)?.startEpisode;
    const pool = G.needsTeam(h.state, h.playerId) && Number.isInteger(start) ? G.draftPool(h.state, start as number, !G.sharedJoin(h.state)) : null;
    view.pace = {
      others: othersIn(h.state, h.playerId, h.marks),
      last: Math.max(0, ...h.state.episodes.map((e) => e.number)),
      team: pool ? { need: Math.min(G.teamSize(h.state), pool.length), pool } : null,
      draft: G.draftsTogether(h.state) && !G.draftDone(h.state) ? (StateLogic.DraftLogic.isStarted(h.state) ? "live" : "waiting") : null,
      gather: gatherOf(h.state, h.mark, h.playerId),
    };
  }
  // A game that starts when a phase does (step A3 of docs/PLAN-start-a-game-gpt.md): the phase by name, from its rulebook.
  const phase = StateLogic.startPhase(h.state);
  if (phase) view.phase = (await leaguePhases(pool, h.game.leagueId, seasonId)).find((p) => p.id === phase)?.name ?? phase;
  // A sheet of questions to answer now (step A4 part 2): a game of questions', or a draft's finale predictions (answers.ts), or
  // (step C2 part 4c) its own questions. None once it's over as far as you've seen (nothing's open: sheetOf says null; E2).
  if (!h.readOnly && !view.over && (asks || StateLogic.finaleOfGame(h.state))) {
    view.sheet = await sheetOf(user, seasonId, h, undefined, rows).catch((e) => {
      console.error(`[season-games] sheet ${h.game.leagueId}:`, e);
      return null;
    });
  }
  return view;
}

function refOf(g: Game): GameRefIn {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, yourRole: g.yourRole, solo: g.solo, archived: g.archived, ownPace: g.ownPace, stageOf: g.stageOf };
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
