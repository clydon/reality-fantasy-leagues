"use client";

import { useSyncExternalStore } from "react";
import type { Home, HomeShow, ListingSeason } from "../data";

// The shows the first-time tour's Add a show demo added (docs/PLAN-first-time-tour.md version 2: the user, 2026-11-01), on Home for
// a moment while the tour says where shows you add go: Your shows and the TV guide merge them in (hub/sections.tsx YourShows,
// hub/guide.tsx Guide); nothing else reads them, nothing saves them, and the tour clears them as it moves on.

const NONE: HomeShow[] = [];
let shows: HomeShow[] = NONE;
const listeners = new Set<() => void>();

export function setPracticeShows(next: HomeShow[]) {
  shows = next.length ? next : NONE;
  listeners.forEach((l) => l());
}

export function usePracticeShows(): HomeShow[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => shows,
    () => NONE
  );
}

// The reveal step's Home, as it is when results are waiting (the user, 2026-11-01: "this should simulate that top card as results
// waiting"): the show the tour's replay plays, its episode's final results in. screens/home.tsx draws Home with it while the step's
// on (Up next's Reveal plate, the top line), the tour clears it as it moves on, and nothing's read or written for it.
export type PracticeReveal = { seasonId: string; episode: number } | null;
let reveal: PracticeReveal = null;
const revealListeners = new Set<() => void>();

export function setPracticeReveal(next: PracticeReveal) {
  reveal = next;
  revealListeners.forEach((l) => l());
}

export function usePracticeReveal(): PracticeReveal {
  return useSyncExternalStore(
    (l) => {
      revealListeners.add(l);
      return () => revealListeners.delete(l);
    },
    () => reveal,
    () => null
  );
}

/** Home with that show's results waiting: its final results in for the episode the replay plays. */
export function withPracticeReveal(home: Home, r: NonNullable<PracticeReveal>): Home {
  return { ...home, shows: home.shows.map((s) => (s.seasonId === r.seasonId ? { ...s, results: { reveal: { episode: r.episode, stage: "final", finalAt: null }, final: null } } : s)) };
}

/** The guide's week: from a day and a bit back to eight days on (server/guide.ts weekOf). */
const WEEK_AHEAD_MS = 8 * 24 * 3600 * 1000;

/** A show the tour's practice added (yours, or the demo's), as Home would have it once added: its listing's season, followed,
 *  nothing seen yet; `ready`, a game already (yours is). Its ids say tour-. */
export function practiceShow(tvmazeId: number, l: ListingSeason, now = Date.now(), ready = false): HomeShow {
  const next = l.next;
  const id = `tour-${tvmazeId}`;
  return {
    seasonId: id,
    seasonNumber: l.season?.number ?? null,
    seasonName: l.season?.name ?? null,
    status: l.season?.status ?? "upcoming",
    episodeCount: l.season?.episodeCount ?? null,
    premiereDate: l.season?.premiere ?? null,
    release: "weekly",
    dropAt: null,
    ready,
    show: {
      id,
      slug: id,
      name: l.hit.name,
      kind: l.hit.kind,
      artUrl: l.hit.art,
      backdropUrl: null,
      terms: { castaway: null, tribe: null },
      tvmazeId,
      network: l.hit.network,
    },
    following: true,
    private: false,
    seenThrough: 0,
    keepUp: "off",
    seenIt: null,
    upNext: next ? { number: next.number, airAt: next.airAt, runtimeMin: next.runtimeMin, title: next.title, note: null, live: false } : null,
    latestAired: l.season?.aired ?? 0,
    games: [],
    progress: [],
    results: { reveal: null, final: null },
    nudgeOff: true,
    week: next && Date.parse(next.airAt) - now < WEEK_AHEAD_MS ? [{ number: next.number, airAt: next.airAt, runtimeMin: next.runtimeMin }] : [],
  };
}
