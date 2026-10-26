import StateLogic from "@/lib/game/state-logic.js";
import { gameView, weekProgress, type GameRefIn, type GameView, type UserOf, type WeekProgress } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { leagueCalls } from "./calls";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { readyLeague } from "./league-read";
import { leagueStates } from "./league-states";
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

/** Your seat in each of these leagues, and every seat's account (for faces). */
async function seatsIn(userId: string, leagueIds: string[]) {
  const { rows } = await pool.query(
    "SELECT league_id, user_id, player_id, results_seen_through FROM league_memberships WHERE league_id = ANY($1::uuid[])",
    [leagueIds]
  );
  const mine = new Map<string, Seat>();
  const users = new Map<string, Map<string, string>>(leagueIds.map((id) => [id, new Map()]));
  for (const r of rows) {
    if (r.player_id) users.get(r.league_id)?.set(r.player_id, r.user_id);
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
}

/**
 * Your games on a season (with `couchId`, that couch's that you play), each with its ready state and your mark, in
 * the couch's order; and your season mark (guard.ts). Read by /games, /episodes and the reveal. One league's
 * unreadable state costs that game, not the show space.
 */
export async function gamesHere(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ seen: number; here: GameHere[] }> {
  const list = (await games(user.id, couchId ? { couchIds: [couchId], seasonId, withSolo: true } : { mine: true, seasonId })).filter((g) => g.yourRole);
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
        here.push({ game: g, ref: refOf(g), state: ready, playerId: seat.playerId, mark: markFor(ready, seat, seen), userOf: (p) => users.get(g.leagueId)?.get(p) ?? null });
      } catch (e) {
        console.error(`[season-games] league ${g.leagueId}:`, e);
      }
    }
  }
  return { seen, here };
}

export async function seasonGames(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ seenThrough: number | null; games: GameView[] }> {
  const { seen, here } = await gamesHere(user, seasonId, couchId);
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

/** One of your games as you may see it, with the calls it reads (step 12 part 2: a pool's Who goes home?, Weekly Calls). */
export async function viewWithCalls(user: SessionUser, seasonId: string, h: GameHere): Promise<GameView> {
  const calls = await leagueCalls({ state: h.state, couchId: h.game.couchId, seasonId, playerId: h.playerId, userId: user.id, mark: h.mark, userOf: h.userOf }).catch((e) => {
    console.error(`[season-games] calls ${h.game.leagueId}:`, e);
    return null;
  });
  return gameView(h.ref, h.state, h.playerId, h.mark, h.userOf, calls ?? undefined);
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
  const weekly = these.filter((g) => g.gameType === "active-roster" || g.gameType === "pickem");
  if (!weekly.length) return out;
  const ids = weekly.map((g) => g.leagueId);
  const [{ mine: seats, users }, states] = await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]);
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
