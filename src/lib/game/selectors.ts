import type { Bet, Episode, LeagueState } from "./types";

// Small pure helpers ported from public/app.js. These are view-layer derivations, not part of
// state-logic.js itself (they don't mutate state and aren't shared with the server), so they stay
// here rather than in the copied file -- matches the live app's own split between app.js helpers
// and shared/state-logic.js.

export function isBetSettled(bet: Bet): boolean {
  const preds = bet.predictions || [];
  return preds.length > 0 && preds.every((p) => p.correct !== null);
}

export function getActiveBets(state: LeagueState): { ep: Episode; bet: Bet }[] {
  const rows: { ep: Episode; bet: Bet }[] = [];
  state.episodes.forEach((ep) => {
    (ep.bets || []).forEach((bet) => {
      if (!isBetSettled(bet)) rows.push({ ep, bet });
    });
  });
  return rows;
}

export function getUpcomingEpisode(state: LeagueState): Episode {
  return [...state.episodes].sort((a, b) => b.number - a.number)[0];
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const MEDAL_EMOJI: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
export { MEDAL_EMOJI };

export function medalFor(state: LeagueState, placementOrder: number | undefined): "gold" | "silver" | "bronze" | null {
  const total = state.castaways.length; // == StateLogic.totalCastCount(state)
  if (typeof placementOrder !== "number") return null;
  if (placementOrder === total) return "gold";
  if (total >= 2 && placementOrder === total - 1) return "silver";
  if (total >= 3 && placementOrder === total - 2) return "bronze";
  return null;
}
