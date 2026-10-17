import type { Bet, Castaway, Episode, LeagueState } from "./types";
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

// Resolves a stored media URL (a castaway's photoUrl, a show's art_url, ...) into something usable
// as an <img src> from ANY route.
//
// Stored values are root-relative-without-the-slash ("photos/s51/ana.jpg") because the live app is a
// single page served at "/", where a relative URL happens to resolve correctly. This app has real
// routes, so the same value on /draft would resolve to /draft/photos/... and 404. Anything that
// already carries a scheme (or a protocol-relative //) or a leading slash is passed through
// untouched -- fields like League Settings' Photo URL accept arbitrary external URLs, and those must
// not be mangled.
export function publicMediaSrc(url: string | undefined | null): string | null {
  const raw = stripWikiRevisionSuffix((url || "").trim());
  if (!raw) return null;
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : "/" + raw;
}

// Alias kept for castaway call sites, which read better under the old name.
export const castawayPhotoSrc = publicMediaSrc;

// A Fandom image address copied off a wiki page carries a revision suffix:
//
//   .../images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427
//
// which doesn't load from another site, while the canonical path above it does. The connector cuts
// this at import (db/wiki-sync.js's normalizePhotoUrl); this second copy covers the other way such a
// URL gets in -- someone pasting one into League Settings' Photo URL field, which is the obvious
// thing to do when you have a wiki page open. Scoped to wikia's own hosts so it can't mangle an
// unrelated URL that happens to contain "/revision/".
function stripWikiRevisionSuffix(raw: string): string {
  if (!/(^|\.)(wikia\.nocookie\.net|fandom\.com)\//i.test(raw)) return raw;
  const cut = raw.indexOf("/revision/");
  return cut === -1 ? raw : raw.slice(0, cut);
}

const MEDAL_EMOJI: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
export { MEDAL_EMOJI };

// Waivers' tab mark (docs/PLAN-midseason-waivers.md): "needs you" only for someone you can replace -- the
// one claim that isn't optional -- while you have no claim in, or once waivers have processed and it's
// still unfilled. Read from the viewer's own copy, so a week they haven't revealed never flags.
export function waiversBadge(state: LeagueState, myPlayerId: string | null): { label: string; urgent: boolean } | null {
  const W = StateLogic.WaiverLogic;
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || p.hidden) return null;
  const owed = myPlayerId ? W.replacementsOwed(state, myPlayerId, p).count : 0;
  if (p.phase === "open") return owed && !p.claimsIn.includes(myPlayerId!) ? { label: "Replace", urgent: true } : { label: "Open", urgent: false };
  return owed && W.freeAgencyOn(state) ? { label: "Replace", urgent: true } : { label: "Free agency", urgent: false };
}

export function medalFor(state: LeagueState, placementOrder: number | undefined): "gold" | "silver" | "bronze" | null {
  const total = state.castaways.length; // == StateLogic.totalCastCount(state)
  if (typeof placementOrder !== "number") return null;
  if (placementOrder === total) return "gold";
  if (total >= 2 && placementOrder === total - 1) return "silver";
  if (total >= 3 && placementOrder === total - 2) return "bronze";
  return null;
}

/** Knocked out of the game: eliminated, but not by reaching the end. A finalist or winner has an exit
 *  too (it's how placement is recorded), but showing them faded as "out" reads as a loss. */
export function isKnockedOut(state: LeagueState, c: Castaway): boolean {
  return c.status === "eliminated" && !StateLogic.formatOf(state).endgameExitMethods.includes(c.exitMethod ?? "");
}
