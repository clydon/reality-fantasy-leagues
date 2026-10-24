import StateLogic from "@/lib/game/state-logic.js";
import { gameView, weekProgress, type GameView, type WeekProgress } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
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

export async function seasonGames(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ seenThrough: number | null; games: GameView[] }> {
  const here = (await games(user.id, couchId ? { couchIds: [couchId], seasonId } : { mine: true, seasonId })).filter((g) => g.yourRole);
  const seen = await seenThrough(user.id, seasonId);
  const out: GameView[] = [];
  if (here.length) {
    const ids = here.map((g) => g.leagueId);
    const [{ mine, users }, states] = await Promise.all([seatsIn(user.id, ids), leagueStates(ids)]);
    for (const g of here) {
      const seat = mine.get(g.leagueId);
      const state = states.get(g.leagueId);
      if (!seat || !state) continue;
      // One league's unreadable state costs that game, not the show space.
      try {
        const ready = await readyLeague(g.leagueId, state);
        out.push(gameView(refOf(g), ready, seat.playerId, markFor(ready, seat, seen), (p) => users.get(g.leagueId)?.get(p) ?? null));
      } catch (e) {
        console.error(`[season-games] league ${g.leagueId}:`, e);
      }
    }
  }
  return { seenThrough: Number.isFinite(seen) ? seen : null, games: out };
}

function refOf(g: Game) {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, yourRole: g.yourRole };
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
      const p = weekProgress(state, seats.get(g.leagueId)?.playerId ?? null, (id) => users.get(g.leagueId)?.get(id) ?? null);
      if (p) out.set(g.leagueId, p);
    } catch (e) {
      console.error(`[season-games] progress ${g.leagueId}:`, e);
    }
  }
  return out;
}
