import type { Bet, Episode, LeagueState } from "./types";
import StateLogic from "./state-logic.js";

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

export function ordinal(n: number | undefined): string | number {
  if (n === undefined) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Port of formatScheduledTime() (public/app.js) -- used for both draft-scheduling display and
// chat message timestamps there, same here.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Resolves a castaway's stored photoUrl into something usable as an <img src> from ANY route.
//
// Stored values are root-relative-without-the-slash ("photos/s51/ana.jpg") because the live app is a
// single page served at "/", where a relative URL happens to resolve correctly. This app has real
// routes, so the same value on /draft would resolve to /draft/photos/... and 404. Anything that
// already carries a scheme (or a protocol-relative //) or a leading slash is passed through
// untouched -- the Photo URL field in League Settings accepts arbitrary external URLs, and those
// must not be mangled.
export function castawayPhotoSrc(photoUrl: string | undefined | null): string | null {
  const raw = (photoUrl || "").trim();
  if (!raw) return null;
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : "/" + raw;
}

const MEDAL_EMOJI: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
export { MEDAL_EMOJI };

// Port of computeMidseasonBadge() (public/app.js): "Your Turn" only when it's genuinely this
// player's own turn up next, never just because a viewer *can* act on it (commissioner powers
// aside) -- that principle is deliberate, see docs/HANDOFF.md. Everyone else sees a quieter
// "Active" badge. Replenish takes priority over Swap if somehow both are active, matching their
// listed order on the Mid-Season panel itself.
export function midseasonBadge(state: LeagueState, myPlayerId: string | null): { label: string; urgent: boolean } | null {
  const replenishTurn = state.midSeason.replenish ? StateLogic.currentReplenishTurn(state) : null;
  const trade = state.midSeason.trade;
  let turnPlayerId: string | undefined;
  if (replenishTurn && !replenishTurn.isComplete) turnPlayerId = replenishTurn.playerId;
  else if (trade && trade.index < trade.queue.length) turnPlayerId = trade.queue[trade.index].playerId;
  else return null;
  const isYourTurn = !!myPlayerId && turnPlayerId === myPlayerId;
  return isYourTurn ? { label: "Your Turn", urgent: true } : { label: "Active", urgent: false };
}

export function medalFor(state: LeagueState, placementOrder: number | undefined): "gold" | "silver" | "bronze" | null {
  const total = state.castaways.length; // == StateLogic.totalCastCount(state)
  if (typeof placementOrder !== "number") return null;
  if (placementOrder === total) return "gold";
  if (total >= 2 && placementOrder === total - 1) return "silver";
  if (total >= 3 && placementOrder === total - 2) return "bronze";
  return null;
}
