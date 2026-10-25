import type { Castaway, Episode, LeagueState } from "./types";
import StateLogic from "./state-logic.js";

// What the Pick page (src/components/pick/), Overview's pick section, the episode page and the tab
// bar's Pick badge all read about Eliminator Pool picks, so they agree on when a pick is open and
// what each one did.

/** The episode picks are for, and whether you can still pick for it (not aired, no results yet). */
export function pickWindow(state: LeagueState) {
  const ep = StateLogic.pickEmUpcomingEpisode(state);
  const decided = StateLogic.pickEmDecided(ep);
  const open = !!ep && !decided && !StateLogic.hasAired(ep);
  return { ep, open };
}

/** Whether you still owe a pick for this week (the Pick tab's badge; the alert strip's same check). */
export function myPickDue(state: LeagueState, playerId: string | null): boolean {
  if (!playerId || !StateLogic.getLeagueType(state).hasWeeklyPicks) return false;
  const { ep, open } = pickWindow(state);
  if (!ep || !open || StateLogic.pickEmPickFor(state, ep.id, playerId)) return false;
  return StateLogic.pickEmEligibility(state, ep.id, playerId).available.length > 0;
}

export interface PickSlot {
  episode: number;
  castaway: Castaway | null;
  /** True survived, false went home (or no pick), null not decided yet. */
  correct: boolean | null;
  /** Their streak after this episode. */
  streak: number;
}

/** A player's picks, oldest first: every episode that's happened, plus any pick still waiting. */
export function pickSlots(state: LeagueState, playerId: string): PickSlot[] {
  return StateLogic.pickEmHistory(state, playerId).rows.map((r) => ({
    episode: r.episode,
    castaway: r.castawayId ? (StateLogic.getCastaway(state, r.castawayId) ?? null) : null,
    correct: r.correct,
    streak: r.streak,
  }));
}

/**
 * Everyone's pick for one decided episode, with how it went: safe or out (or no pick), and the
 * streak it left them on -- or the one it ended.
 */
export function episodePicks(state: LeagueState, ep: Episode) {
  return state.players
    .filter((p) => p.active !== false)
    .map((player) => {
      const rows = StateLogic.pickEmHistory(state, player.id).rows;
      const i = rows.findIndex((r) => r.episode === ep.number);
      const row = i >= 0 ? rows[i] : null;
      const before = rows.slice(0, Math.max(i, 0)).filter((r) => r.correct !== null).slice(-1)[0]?.streak ?? 0;
      const castaway = row?.castawayId ? (StateLogic.getCastaway(state, row.castawayId) ?? null) : null;
      return { player, castaway, correct: row?.correct ?? false, streak: row?.streak ?? 0, ended: before };
    });
}

/** "Brady", "Brady and Danny", "Brady, Danny and Maggie". */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
