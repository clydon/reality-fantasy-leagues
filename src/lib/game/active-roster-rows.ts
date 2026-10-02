import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

export interface PlayerEventRow {
  episode: number;
  postMerge: boolean;
  castawayName: string;
  label: string;
  points: number;
}

export interface CastawayEventStat {
  type: string;
  label: string;
  /** How many times this castaway has scored this event type, all season. */
  count: number;
  /** Points per occurrence, at the league's current settings. */
  points: number;
}

// A castaway's OWN scoring record -- every event attributed to them, all season, regardless of
// whether their owner actually had them active that episode (unlike playerEventRows below, which is
// an owner's EARNED points and excludes benched episodes). This is what the board grid's points badge
// and expanded stat breakdown show: the castaway's own performance, not any one player's cut of it.
export function castawayEventStats(state: LeagueState, castawayId: string): { total: number; byType: CastawayEventStat[] } {
  const events = StateLogic.formatOf(state).events;
  const counts: Record<string, number> = {};
  let total = 0;
  [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .forEach((ep) => {
      StateLogic.ActiveRosterLogic.episodeEvents(state, ep).forEach((sev) => {
        if (sev.castawayId !== castawayId) return;
        counts[sev.type] = (counts[sev.type] || 0) + 1;
        total = StateLogic.roundPoints(total + StateLogic.ActiveRosterLogic.pointsFor(state, sev.type));
      });
    });
  // Same order as the Active Roster Settings list (the format's own catalog order), filtered to only
  // what this castaway has actually done -- a long list of zeroes isn't "each category they've scored".
  const byType = events
    .filter((e) => counts[e.id] > 0)
    .map((e) => ({ type: e.id, label: e.label, count: counts[e.id], points: StateLogic.ActiveRosterLogic.pointsFor(state, e.id) }));
  return { total, byType };
}

// A player's full scoring-event history, oldest first, with the points each one actually paid them.
// Same shape and purpose as bet-rows.ts's playerBetRows: a Scoreboard disclosure, derived on read
// rather than stored.
//
// Only events whose castaway was in THAT episode's lineup for this player are included, which is the
// same rule ActiveRosterEventScoringStrategy.compute applies -- if that rule changes, this has to
// change with it. An event for a benched castaway is deliberately absent rather than listed at 0
// points: it never was this player's event to score.
export function playerEventRows(state: LeagueState, playerId: string): PlayerEventRow[] {
  const rows: PlayerEventRow[] = [];
  const events = StateLogic.formatOf(state).events;
  [...state.episodes]
    // Before the league's start episode nothing scores -- same rule the scoring strategy applies.
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .sort((a, b) => a.number - b.number)
    .forEach((ep) => {
      const lineup = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
      StateLogic.ActiveRosterLogic.episodeEvents(state, ep).forEach((sev) => {
        if (!lineup.includes(sev.castawayId)) return;
        const def = events.find((e) => e.id === sev.type);
        rows.push({
          episode: ep.number,
          postMerge: ep.postMerge,
          castawayName: StateLogic.getCastaway(state, sev.castawayId)?.name || "?",
          label: def?.label || sev.type,
          points: StateLogic.ActiveRosterLogic.pointsFor(state, sev.type),
        });
      });
    });
  return rows;
}

// Same shape as castawayEventStats, over a chosen set of scoring events.
function statsFrom(state: LeagueState, evs: { type: string }[]): { total: number; byType: CastawayEventStat[] } {
  const events = StateLogic.formatOf(state).events;
  const counts: Record<string, number> = {};
  let total = 0;
  for (const ev of evs) {
    counts[ev.type] = (counts[ev.type] || 0) + 1;
    total = StateLogic.roundPoints(total + StateLogic.ActiveRosterLogic.pointsFor(state, ev.type));
  }
  const byType = events
    .filter((e) => counts[e.id] > 0)
    .map((e) => ({ type: e.id, label: e.label, count: counts[e.id], points: StateLogic.ActiveRosterLogic.pointsFor(state, e.id) }));
  return { total, byType };
}

/** One castaway's events in one episode (exits included). */
export function castawayEpisodeStats(state: LeagueState, epId: string, castawayId: string) {
  const ep = state.episodes.find((e) => e.id === epId);
  return statsFrom(state, ep ? StateLogic.ActiveRosterLogic.episodeEvents(state, ep).filter((s) => s.castawayId === castawayId) : []);
}

/** What one castaway earned for one player all season: only episodes they were in that player's lineup. */
export function castawayEarnedStats(state: LeagueState, playerId: string, castawayId: string) {
  const evs = state.episodes
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .filter((ep) => StateLogic.activeRosterLineupFor(state, ep.id, playerId).includes(castawayId))
    .flatMap((ep) => StateLogic.ActiveRosterLogic.episodeEvents(state, ep).filter((s) => s.castawayId === castawayId));
  return statsFrom(state, evs);
}

/** Everyone a player has had this season: owned now, released since, or ever fielded. */
export function castawaysEverOwned(state: LeagueState, playerId: string) {
  const fielded = new Set(state.episodes.flatMap((ep) => StateLogic.activeRosterLineupFor(state, ep.id, playerId)));
  return state.castaways.filter((c) => c.ownerIds.includes(playerId) || c.formerOwnerId === playerId || fielded.has(c.id));
}

/**
 * Everything one castaway scored while on a player's roster, fielded or benched. Roster history isn't
 * stored per episode, so "on the roster" is: fielded that episode, or owned by them now (a released
 * castaway only counts for the weeks they were fielded).
 */
export function castawayRosterStats(state: LeagueState, playerId: string, castawayId: string) {
  const c = StateLogic.getCastaway(state, castawayId);
  const ownedNow = !!c && c.ownerIds.includes(playerId);
  // Picked up mid-season: only from the episode after the pickup.
  const pickedUpAfter = Math.max(
    0,
    ...(state.midSeason.log ?? [])
      .filter((m) => m.playerId === playerId && m.addedCastawayId === castawayId)
      .map((m) => m.episode ?? 0)
  );
  const evs = state.episodes
    .filter((ep) => StateLogic.inPlay(state, ep.number))
    .filter(
      (ep) =>
        (ownedNow && ep.number > pickedUpAfter) || StateLogic.activeRosterLineupFor(state, ep.id, playerId).includes(castawayId)
    )
    .flatMap((ep) => StateLogic.ActiveRosterLogic.episodeEvents(state, ep).filter((s) => s.castawayId === castawayId));
  return statsFrom(state, evs);
}

/**
 * Who was on a player's roster for one episode, started or benched. Roster history isn't stored per
 * episode, so it's rebuilt from the mid-season log: picked up after episode N means on the roster
 * from N+1, dropped after episode N means on it through N. Anyone they started that episode counts
 * regardless, and nobody who was already out of the game does.
 */
export function rosterAtEpisode(state: LeagueState, playerId: string, epId: string) {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep) return [];
  const started = new Set(StateLogic.activeRosterLineupFor(state, ep.id, playerId));
  const moves = (state.midSeason.log ?? []).filter((m) => m.playerId === playerId);
  return castawaysEverOwned(state, playerId).filter((c) => {
    if (started.has(c.id)) return true;
    if (c.status === "eliminated") {
      const exit = state.episodes.find((e) => e.id === c.exitEpisodeId);
      if (!exit || exit.number < ep.number) return false;
    }
    const addedAfter = Math.max(0, ...moves.filter((m) => m.addedCastawayId === c.id).map((m) => m.episode ?? 0));
    if (ep.number <= addedAfter) return false;
    const drops = moves.filter((m) => m.droppedCastawayId === c.id && (m.episode ?? 0) >= addedAfter).map((m) => m.episode ?? 0);
    if (drops.length > 0) return ep.number <= Math.min(...drops);
    return c.ownerIds.includes(playerId);
  });
}

/** Each player's points for one episode: events by castaways in their lineup for it. Highest first. */
export function episodePlayerPoints(state: LeagueState, epId: string) {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep || !StateLogic.inPlay(state, ep.number)) return [];
  const evs = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  return state.players
    .filter((p) => p.active !== false)
    .map((p) => {
      const lineup = StateLogic.activeRosterLineupFor(state, ep.id, p.id);
      const points = StateLogic.roundPoints(
        evs.filter((e) => lineup.includes(e.castawayId)).reduce((t, e) => t + StateLogic.ActiveRosterLogic.pointsFor(state, e.type), 0)
      );
      return { player: p, points };
    })
    .sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name));
}
