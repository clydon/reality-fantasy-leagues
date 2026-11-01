"use client";

import { useSyncExternalStore } from "react";
import type { HomeShow, ListingSeason } from "../data";

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

/** The guide's week: from a day and a bit back to eight days on (server/guide.ts weekOf). */
const WEEK_AHEAD_MS = 8 * 24 * 3600 * 1000;

/** A show the demo added, as Home would have it once added: its listing's season, followed, nothing seen yet. Its ids say tour-. */
export function practiceShow(tvmazeId: number, l: ListingSeason, now = Date.now()): HomeShow {
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
    ready: false,
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
