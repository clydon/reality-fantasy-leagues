import type { Castaway, Episode, LeagueState, Player } from "./types";
import StateLogic from "./state-logic.js";
import { formatInTz } from "./air-schedule.js";
import { castawayEpisodeStats } from "./active-roster-rows";
import { latestScoredEpisode } from "./episode-team-summary";

// What the Lineup page (src/components/lineup/), Overview's "Starting this week" and the tab bar's
// Lineup badge all read about Active Roster lineups, so they agree on what "set" means.

/**
 * A player's lineup for one episode: who's starting, who's on the bench, and whether it's "set" --
 * every slot they can fill is filled (late in a season someone may own fewer survivors than slots).
 */
export function lineupStatus(state: LeagueState, ep: Episode, playerId: string) {
  const activeSlots = StateLogic.ActiveRosterLogic.activeSlots(state);
  const lineupIds = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
  const starters = lineupIds.map((id) => StateLogic.getCastaway(state, id)).filter((c): c is Castaway => !!c);
  // Everyone still in the game on the roster who isn't starting.
  const bench = state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status !== "eliminated" && !lineupIds.includes(c.id));
  const need = Math.min(activeSlots, starters.length + bench.length);
  return {
    starters,
    bench,
    need,
    activeSlots,
    empty: Math.max(0, activeSlots - starters.length),
    set: starters.length >= need,
    /** Not set for this episode: the last one they chose is standing in (ActiveRosterLogic.lineupFor). */
    carried: StateLogic.ActiveRosterLogic.lineupIsCarried(state, ep.id, playerId),
  };
}

/** Whether your own lineup for this week still has a slot you could fill (the Lineup tab's badge). */
export function myLineupDue(state: LeagueState, playerId: string | null): boolean {
  if (!playerId || !StateLogic.piecesOf(state).hasActiveRoster) return false;
  const ep = StateLogic.currentEpisode(state);
  if (!ep || StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id)) return false;
  return !lineupStatus(state, ep, playerId).set;
}

/** "Locks Wed, Oct 14, 8:00 PM EDT · in 5 days", in the viewer's own zone. Null with no air time. */
export function lockLine(ep: Episode, now = Date.now()): string | null {
  if (!ep.airsAt) return null;
  const at = new Date(ep.airsAt);
  const days = Math.round((at.getTime() - now) / 86_400_000);
  const hours = Math.round((at.getTime() - now) / 3_600_000);
  const rel = hours < 1 ? "within the hour" : hours < 24 ? `in ${hours} hour${hours === 1 ? "" : "s"}` : `in ${days} day${days === 1 ? "" : "s"}`;
  return `Locks ${formatInTz(at, localTz())} · ${rel}`;
}

/** The viewer's own time zone, for lock times -- the schedule itself is in the show's. */
export function localTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * The best-scoring starters of the latest scored episode, whoever started them: each castaway once,
 * with the players who started them and what they did. Only starters -- a benched castaway's points
 * never counted for anyone.
 */
export function topStarters(state: LeagueState, limit = 3) {
  const ep = latestScoredEpisode(state);
  if (!ep) return { ep: null, rows: [] };
  const startedBy = new Map<string, Player[]>();
  for (const p of state.players) {
    for (const cid of StateLogic.activeRosterLineupFor(state, ep.id, p.id)) {
      startedBy.set(cid, [...(startedBy.get(cid) ?? []), p]);
    }
  }
  const rows = [...startedBy.entries()]
    .map(([cid, players]) => ({ castaway: StateLogic.getCastaway(state, cid), players, stats: castawayEpisodeStats(state, ep.id, cid) }))
    .filter((r): r is typeof r & { castaway: Castaway } => !!r.castaway && r.stats.total > 0)
    .sort((a, b) => b.stats.total - a.stats.total || a.castaway.name.localeCompare(b.castaway.name))
    .slice(0, limit);
  return { ep, rows };
}

/** "+2" / "-3" / "0" for a points value that can be negative. */
export function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
