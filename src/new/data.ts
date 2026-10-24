"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";

// The new design's reads (docs/PLAN-new-design.md steps 0b and 0c): the home and a show space's frame, both
// spoiler-safe on the server (guard.ts). Nothing here polls: a screen that polls should poll something smaller
// (docs/HOSTING.md).

export type LeagueRole = "commissioner" | "admin" | "member";

export interface GameRef {
  leagueId: string;
  name: string;
  /** settings.leagueTypeId, unchanged ("active-roster"). */
  gameType: string;
  /** Its name in the new design ("Weekly Lineup"). */
  gameName: string;
  couchId: string | null;
  seasonId: string | null;
  groupId: string | null;
  yourRole: LeagueRole | null;
}

export interface SeasonHeader {
  seasonId: string;
  seasonNumber: number | null;
  seasonName: string | null;
  status: string | null;
  episodeCount: number | null;
  premiereDate: string | null;
  show: {
    id: string;
    slug: string;
    name: string;
    kind: "competition" | "series" | "talk" | "sport";
    artUrl: string | null;
    terms: { castaway: string | null; tribe: string | null };
  };
}

export interface UpNext {
  number: number;
  airAt: string | null;
  runtimeMin: number | null;
  title: string | null;
  note: string | null;
  live: boolean;
}

export interface Move {
  kind: string;
  text: string;
  href: string;
  leagueId: string;
  leagueName: string;
  episode?: number;
  deadline?: string | null;
}

export interface HomeShow extends SeasonHeader {
  following: boolean;
  private: boolean;
  /** Null: they see results straight away (spoiler protection off). */
  seenThrough: number | null;
  upNext: UpNext | null;
  latestAired: number;
  games: GameRef[];
}

export interface Couch {
  id: string;
  name: string;
  yourRole: "owner" | "member";
  members: { userId: string; name: string; role: "owner" | "member"; watching: string[] }[];
  games: GameRef[];
}

export interface Home {
  user: { id: string; name: string };
  couches: Couch[];
  shows: HomeShow[];
  unscheduled: GameRef[];
  moves: Move[];
  backstage: { leagueId: string; leagueName: string; text: string }[];
}

export interface Space extends SeasonHeader {
  couchId: string | null;
  you: { following: boolean; private: boolean; seenThrough: number | null };
  schedule: { release: string; dropAt: string | null; airTz: string; upNext: UpNext | null; latestAired: number } | null;
  games: GameRef[];
  people: { userId: string; name: string; role: "owner" | "member"; watching: boolean; playing: string[] }[] | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status });
  }
  return res.json();
}

const HOME_KEY = ["new-design", "home"] as const;

export function useHome() {
  return useQuery({ queryKey: HOME_KEY, queryFn: () => get<Home>("/api/me/home"), staleTime: 60_000 });
}

/** `enabled`: false until you know which couch to ask about (the home has to come back first). */
export function useSpace(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "space", seasonId, couchId],
    queryFn: () => get<Space>(`/api/seasons/${seasonId}/space${query}`),
    staleTime: 60_000,
    enabled,
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 2,
  });
}

// ---- which couch you're looking at: one hub shows one couch at a time (site-mock-decisions) ----
// Per device for now (step 9 brings the couch switcher); a stale id just falls back to the first couch.

const COUCH_KEY = "gys.couch";
const couchListeners = new Set<() => void>();

function readCouch(): string | null {
  try {
    return localStorage.getItem(COUCH_KEY);
  } catch {
    return null;
  }
}

export function setCouch(id: string) {
  try {
    localStorage.setItem(COUCH_KEY, id);
  } catch {
    /* not remembered: the first couch it is */
  }
  couchListeners.forEach((l) => l());
}

function useStoredCouch(): string | null {
  return useSyncExternalStore(
    (l) => {
      couchListeners.add(l);
      return () => couchListeners.delete(l);
    },
    readCouch,
    () => null
  );
}

/** The couch with the most going on: the most games, then the most people. */
function busiest(couches: Couch[]): Couch | null {
  return [...couches].sort((a, b) => b.games.length - a.games.length || b.members.length - a.members.length)[0] ?? null;
}

/** The couch the hub shows: the one you picked on this device, else the busiest. */
export function useCurrentCouch(home: Home | undefined): Couch | null {
  const stored = useStoredCouch();
  if (!home?.couches.length) return null;
  return home.couches.find((c) => c.id === stored) ?? busiest(home.couches);
}

/** The couch a show space opens with: the current couch if it plays this show, else one that does. */
export function useCouchForSeason(home: Home | undefined, seasonId: string): Couch | null {
  const current = useCurrentCouch(home);
  if (!home) return null;
  const playing = home.couches.filter((c) => c.games.some((g) => g.seasonId === seasonId));
  if (current && playing.includes(current)) return current;
  return busiest(playing) ?? current;
}

/** Which design this account opens on; switching designs is a full page load, so each shell starts clean. */
export async function switchDesign(ui: "classic" | "new") {
  await api.setMySettings({ ui });
  // A full load, on purpose: each design has its own shell.
  window.location.assign(ui === "new" ? "/home" : "/");
}
