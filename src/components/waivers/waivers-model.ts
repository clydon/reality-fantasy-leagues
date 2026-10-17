"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Castaway, LeagueState, MidSeasonLogEntry, Player, WaiverClaim, WaiverPair, WaiverPass, WaiverPeriod, WaiverResult } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { mockClaim, setMockClaim } from "@/lib/mock-claims";
import { shortNames } from "@/components/draft/draft-ui";
import { waiversHref } from "@/lib/game/action-items.js";

// What the Waivers screens read (docs/PLAN-midseason-waivers.md; the "Mid-Season Moves" canvas). One
// place that says where the viewer's week stands, so every board, picker and plate agrees. Everything
// here reads the viewer's own copy of the league (`state`): a week opened by an episode they haven't
// revealed comes back `hidden`, with nothing in it that would say who left.

export const WAIVERS_ON = (state: LeagueState) => StateLogic.WaiverLogic.enabled(state);

/**
 * Shared ownership (Active Roster's default): nobody's taken off the board, so no claim can lose to
 * another. The rules are the same; what changes is what's worth showing -- no waiver order, no ranked
 * backups, just who you want.
 */
export function isShared(state: LeagueState): boolean {
  return state.settings.ownershipMode === "shared";
}

/** Where this league's waiver pages live: Active Roster folds them into Research (the tab bar is full). */
export function waiversBase(state: LeagueState): "/waivers" {
  return waiversHref(state);
}

export function useWaiversBase() {
  return waiversBase(useLeagueStore((s) => s.state));
}

/** Everyone in waivers: active seats, not late joiners still catching up (inLeagueRotation). */
export function rotation(state: LeagueState): Player[] {
  return state.players.filter((p) => !p.disabled && p.active !== false && !p.ghost);
}

/** The waiver order as it stands now (rolling, or standings), first to last. */
export function waiverOrder(state: LeagueState): string[] {
  return StateLogic.MidSeasonLogic.order(
    state,
    rotation(state).map((p) => p.id),
  );
}

export type WeekStage = "none" | "hidden" | "open" | "processed";

/**
 * The viewer's week: the one still running, else the last one (closed), and what's theirs to do in it --
 * the castaways they may replace (owed), the swaps the week allows and they have left, and whether their
 * claim is in. Nothing to do in a week they haven't revealed: that would say who left.
 */
export function viewerWeek(state: LeagueState, me: string | null) {
  const W = StateLogic.WaiverLogic;
  const period = W.current(state);
  const periods = W.periods(state);
  const last = periods[periods.length - 1] ?? null;
  const stage: WeekStage = !period ? "none" : period.hidden ? "hidden" : period.phase === "open" ? "open" : "processed";
  const inRotation = !!me && rotation(state).some((p) => p.id === me);
  const live = !!me && inRotation && stage !== "hidden" && !!period;
  const owed = live ? W.replacementsOwed(state, me!, period) : { count: 0, lossIds: [] as string[], outIds: [] as string[] };
  const swapsAllowed = live ? W.swapsAllowed(period) : 0;
  const swapsLeft = live ? W.swapsLeft(state, period, me!) : 0;
  const claimIn = !!period && !!me && period.claimsIn.includes(me);
  return { period, last, stage, inRotation, owed, swapsAllowed, swapsLeft, claimIn, todo: owed.count > 0 || swapsLeft > 0 };
}

/** The last week that processed and that the viewer may see, for "All of Episode 3's waivers". */
export function lastRun(state: LeagueState): WaiverPeriod | null {
  const ps = StateLogic.WaiverLogic.periods(state).filter((p) => p.run && !p.hidden);
  return ps[ps.length - 1] ?? null;
}

/** The week opened by episode `n`'s results, if the viewer may see it. */
export function periodFor(state: LeagueState, n: number): WaiverPeriod | null {
  return StateLogic.WaiverLogic.periods(state).find((p) => p.episode === n && !p.hidden) ?? null;
}

/** "3, 6, 9 and 12". */
export function andList(items: (string | number)[]): string {
  const s = items.map(String);
  return s.length <= 1 ? (s[0] ?? "") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}

/** "Rob, then Maggie, then Patt". */
export function thenList(items: string[]): string {
  return items.join(", then ");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---- Names ----

/** First names (with a last initial where two share one), across the whole cast. */
export function useCastNames(state: LeagueState) {
  const names = shortNames(state.castaways);
  return (id: string | null | undefined) => (id ? names.get(id) ?? StateLogic.getCastaway(state, id)?.name ?? "?" : "?");
}

export function playerName(state: LeagueState, id: string | undefined, me: string | null, you = "you"): string {
  if (!id) return "someone";
  if (id === me) return you;
  return StateLogic.getPlayer(state, id)?.name ?? "someone";
}

// ---- Times ----

/** Re-renders every half minute, so countdowns and "Now" move on their own. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const DAY = 86_400_000;

/** "Tue 8:00 PM" within the week either side, else "Oct 21, 8:00 PM". `short`: "Tue 8 PM". */
export function when(iso: string | null | undefined, now: number, short = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: short && d.getMinutes() === 0 ? undefined : "2-digit" });
  if (Math.abs(d.getTime() - now) < 6 * DAY) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

/** "Thu": the day of a moment (or the date, if it's more than a week off). */
export function dayOf(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Math.abs(d.getTime() - now) < 6 * DAY) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "1 day 6 hours left", "5 hours left", "40 minutes left"; "" once it's passed. */
export function timeLeft(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - now;
  if (!(ms > 0)) return "";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (days > 0) return `${plural(days, "day")}${hours ? ` ${plural(hours, "hour")}` : ""} left`;
  if (hours > 0) return `${plural(hours, "hour")} left`;
  return `${plural(Math.max(1, mins), "minute")} left`;
}

/** What the episode after a week is called when it airs: "Episode 4 airs". */
export function nextEpisodeAirs(state: LeagueState, period: WaiverPeriod): { n: number; airsAt: string | null } {
  const n = period.episode + 1;
  return { n, airsAt: state.episodes.find((e) => e.number === n)?.airsAt ?? null };
}

/** "until Episode 4 airs, Wed 8:00 PM" / "until Episode 4's results" when there's no air time. */
export function freeAgencyUntil(state: LeagueState, period: WaiverPeriod, now: number, short = false): string {
  const { n } = nextEpisodeAirs(state, period);
  return period.closesAt ? `until Episode ${n} airs, ${when(period.closesAt, now, short)}` : `until Episode ${n}'s results`;
}

// ---- Your claim (private; GET /waivers) ----

const EMPTY: WaiverClaim = { pairs: [], pickupIds: [], dropId: null, addIds: [] };

/**
 * The viewer's own claim for the open week. Claims never enter league state, so this is its own
 * request, refetched when "who has claims in" changes. `save({ pairs })` replaces the whole claim (the
 * viewer knows it); `save({ spot })` sets one spot's ranked choices and keeps the rest, which is what the
 * commissioner's Claim for sends (`playerId`: whose claim, never read here). A league with no server (the
 * guided tour) keeps them in memory instead.
 */
export function useMyClaim(period: WaiverPeriod | null) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const setState = useLeagueStore((s) => s.setState);
  const qc = useQueryClient();
  const live = mode === "live" && !!leagueId && !!period && period.phase === "open" && !period.hidden;
  const key = ["waiver-claim", leagueId, period?.id ?? null];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.getWaiverClaim(leagueId!),
    enabled: live,
    staleTime: 15_000,
  });
  const mock = mode === "mock" && !!period && period.phase === "open" && !period.hidden && !!me;
  const claim = mock
    ? (mockClaim(period!.id, me!) ?? EMPTY)
    : live && q.data && q.data.periodId === period?.id
      ? (q.data.claim ?? EMPTY)
      : EMPTY;

  async function save(input: ClaimSave, playerId?: string): Promise<string | null> {
    if (mode === "mock") return saveMock(input, playerId ?? me);
    if (!leagueId) return "No league loaded";
    try {
      const next = await api.saveWaiverClaim(leagueId, input, playerId);
      setState(next);
      // Ours: what we saved is what the server holds now (checked, in processing order).
      if (!playerId && "pairs" in input) {
        const p = StateLogic.WaiverLogic.current(next);
        const pairs = p ? StateLogic.WaiverLogic.groupPairs(next, p, me!, input.pairs) : input.pairs;
        qc.setQueryData(key, { periodId: period?.id ?? null, claim: StateLogic.WaiverLogic.claimOf(next, pairs), hidden: false });
      } else if (!playerId) qc.invalidateQueries({ queryKey: key });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Saving didn't work.";
    }
  }
  // The server's saveClaim, on the league as it really is (not the viewer's copy): checked, a spot
  // merged into what's saved, and "who has claims in" updated.
  function saveMock(input: ClaimSave, playerId: string | null): string | null {
    const W = StateLogic.WaiverLogic;
    const full = useLeagueStore.getState().fullState;
    const p = W.current(full);
    if (!p || p.id !== period?.id || !playerId) return "Claims are closed for this week";
    const saved = mockClaim(p.id, playerId)?.pairs ?? [];
    const pairs = "spot" in input ? W.setSpot(full, p, playerId, saved, input.spot.dropId, input.spot.addIds) : W.groupPairs(full, p, playerId, input.pairs);
    const checked = W.checkClaim(full, p, playerId, { pairs });
    if (checked.error !== undefined) return checked.error;
    const empty = W.isEmptyClaim(checked.claim);
    setMockClaim(p.id, playerId, empty ? null : checked.claim);
    W.setClaimsIn(full, p, [...p.claimsIn.filter((id) => id !== playerId), ...(empty ? [] : [playerId])]);
    setState(full);
    return null;
  }
  return { claim, loading: live && q.isPending, save };
}

export type ClaimSave = { pairs: WaiverPair[] } | { spot: { dropId: string; addIds: string[] } };

/** A claim's pairs as the claim screen shows them: a group per replacement (oldest loss first), then the swaps. */
export function claimGroups(state: LeagueState, period: WaiverPeriod, me: string, pairs: WaiverPair[]) {
  const W = StateLogic.WaiverLogic;
  const ordered = W.groupPairs(state, period, me, pairs);
  const isOut = (id: string) => StateLogic.getCastaway(state, id)?.status !== "active";
  const reps = ordered.filter((x) => isOut(x.dropId));
  const drops = [...new Set(reps.map((x) => x.dropId))];
  return {
    replacements: drops.map((dropId) => ({ dropId, adds: reps.filter((x) => x.dropId === dropId).map((x) => x.addId) })),
    swaps: ordered.filter((x) => !isOut(x.dropId)),
    pairs: ordered,
  };
}

/** "you're 3rd in line": the viewer's place in the waiver order, 1-based (0: not in it). */
export function placeInLine(state: LeagueState, me: string | null): number {
  return me ? waiverOrder(state).indexOf(me) + 1 : 0;
}

// ---- Outcomes, in words ----

/** Why someone's choice didn't go: "Josie got Maggie first", "Maggie was already gone". */
export function passLine(state: LeagueState, p: WaiverPass, me: string | null, name: (id: string) => string): string {
  if (p.reason === "ahead") return `${capFirst(playerName(state, p.byPlayerId, me, "you"))} got ${name(p.castawayId)} first`;
  if (p.reason === "yours" || p.reason === "pickupFirst") return `${name(p.castawayId)} came in for another spot`;
  return `${name(p.castawayId)} was already gone`;
}

/**
 * One result as a sentence (the results list, the processed plate's line): "Sharonda for Patt, 2nd
 * choice. Josie got Rob first." / "Josie got Maggie first, so Lewis stays." / "No claim in."
 */
export function resultWhy(state: LeagueState, r: WaiverResult, me: string | null, name: (id: string) => string): string {
  if (r.outcome === "noClaim") return r.kind === "pickup" ? "No claim in" : "No swap";
  if (r.outcome === "skipped") return "No swap";
  if (r.dropGone) return "Their drop had already left the team";
  const why = r.passed[0] ? `${passLine(state, r.passed[0], me, name)}.` : "";
  if (r.outcome === "got" && r.castawayId) {
    const pair = r.droppedCastawayId ? `${name(r.castawayId)} for ${name(r.droppedCastawayId)}` : name(r.castawayId);
    // Shared: nothing could be lost to anyone, so which choice it was says nothing.
    if (isShared(state) || (r.choice ?? 1) === 1) return pair;
    return `${pair}, ${ordinal(r.choice ?? 1)} choice. ${why}`.trim();
  }
  // Missed: a swap's drop stays; a replacement is still owed.
  const stays = r.kind === "addDrop" && r.droppedCastawayId ? `, so ${name(r.droppedCastawayId)} stays` : "";
  if (why) return `${why.slice(0, -1)}${stays}.`;
  return r.kind === "addDrop" ? "None of them were free" : "Nobody on the list was free";
}

const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The moves (replacements and swaps) the viewer may see, newest first. */
export function transactions(state: LeagueState): MidSeasonLogEntry[] {
  return [...(state.midSeason.log ?? [])].reverse();
}

export function txLabel(tx: MidSeasonLogEntry): string {
  const what = tx.type === "trade" ? "Swap" : "Replaced";
  const via = tx.via === "freeAgency" ? " · free agency" : tx.via === "auto" ? " · auto-filled" : "";
  return typeof tx.episode === "number" ? `${what} after Episode ${tx.episode}${via}` : `${what}${via}`;
}

/** Castaways by id, skipping any that aren't in the cast. */
export function lossesOf(state: LeagueState, ids: string[]): Castaway[] {
  return ids.map((id) => StateLogic.getCastaway(state, id)).filter((c): c is Castaway => !!c);
}

/** The episode a castaway left in, if they have. */
export function exitEpisode(state: LeagueState, castawayId: string): number | null {
  const ep = state.episodes.find((e) => e.events.some((x) => x.castawayId === castawayId));
  return ep ? ep.number : null;
}

/**
 * What applying episode `n`'s results does to waivers, for the line above the results page's Apply
 * (the canvas's board 10): "Standings update. Claims are due Tue 8:00 PM, then free agency until
 * Episode 4 airs." Null when it doesn't open a week (waivers off, a week already open for it, an
 * episode that opens neither replacements nor a window, or the season over).
 */
export function applyOpensWaivers(state: LeagueState, n: number, now: number): string | null {
  const W = StateLogic.WaiverLogic;
  if (!W.enabled(state) || StateLogic.MidSeasonLogic.seasonOver(state)) return null;
  const ps = W.periods(state);
  const last = ps[ps.length - 1];
  if (last && last.episode >= n) return null;
  if (!W.weekly(state) && !W.isWindowEpisode(state, n)) return null;
  const s = W.schedule(state, { episode: n, openedAt: new Date(now).toISOString() } as WaiverPeriod);
  const fa = W.freeAgencyOn(state)
    ? `, then free agency ${s.closesAt ? `until Episode ${n + 1} airs` : `until Episode ${n + 1}'s results`}`
    : "";
  return `Standings update. Claims are due ${when(s.processAt, now)}${fa}. Players still reveal when they're ready.`;
}
