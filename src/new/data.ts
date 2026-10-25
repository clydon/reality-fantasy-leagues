"use client";

import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { GameView, WeekProgress } from "@/lib/game/game-view";
import type { HowItWorks } from "@/lib/game/formats/rulebook-describe";
import type { SeasonEpisodes, SeasonReveal } from "@/lib/server/season-episodes";
import type { SeasonStats } from "@/lib/server/season-stats";

export type { CastFace, GameView, LineupMove, PickMove, PredictionMove, TableRow, WeekProgress } from "@/lib/game/game-view";
export type { EpisodeSeen, GameNight, Happened, OutFace, RevealGame, RevealTable, Scorer } from "@/lib/game/episode-view";
export type { EpisodeRow, SeasonEpisodes, SeasonReveal } from "@/lib/server/season-episodes";
export type { CastStat, Pattern, StatDef } from "@/lib/game/cast-stats";
export type { SeasonStats } from "@/lib/server/season-stats";

// The new design's reads (docs/PLAN-new-design.md steps 0b, 0c and 1): the home, a show space's frame, your games
// on a show, its How it works and its cast stats, all spoiler-safe on the server (guard.ts); and the moves' writes, through the
// league routes the classic app uses. Nothing here polls: a screen that polls should poll something smaller
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
  /** Who's set for the next episode, per game of yours here with a weekly move. */
  progress: (WeekProgress & { leagueId: string })[];
}

export interface Couch {
  id: string;
  name: string;
  yourRole: "owner" | "member";
  members: { userId: string; name: string; role: "owner" | "member"; joinedAt: string; watching: string[] }[];
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

/** Your games on a show (GET /api/seasons/[id]/games): moves, tables, rules and cast, as far as you've seen. */
export function useSeasonGames(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "games", seasonId, couchId],
    queryFn: () => get<{ seenThrough: number | null; games: GameView[] }>(`/api/seasons/${seasonId}/games${query}`),
    staleTime: 60_000,
    enabled,
  });
}

/** A show's episodes as far as you've seen, what's hidden until you reveal, what's waiting (GET .../episodes). */
export function useSeasonEpisodes(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "episodes", seasonId, couchId],
    queryFn: () => get<SeasonEpisodes>(`/api/seasons/${seasonId}/episodes${query}`),
    staleTime: 60_000,
    enabled,
  });
}

/** The one reveal: episode n in every game of yours on the show, at once; answers its beats (POST .../reveal). */
export async function revealEpisode(seasonId: string, couchId: string | null, episode: number): Promise<SeasonReveal> {
  const res = await fetch(`/api/seasons/${seasonId}/reveal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ episode, couch: couchId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Couldn't reveal (${res.status})`);
  return body as SeasonReveal;
}

/** Post to the couch's chat about this show (today a game's chat, shared by its linked games: step 4 makes it the couch's). */
export async function postToCouch(leagueId: string, text: string) {
  const res = await fetch(`/api/leagues/${leagueId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Couldn't post (${res.status})`);
  }
}

/** After a reveal: everything the new design reads moves on (where you are, the tables, the moves, the episodes). */
export function useAfterReveal() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ["new-design"] }), [client]);
}

export interface HowItWorksPage {
  how: HowItWorks;
  cast: { name: string; photo: string | null; colour: string | null }[];
}

/**
 * A show's cast stats, up to where you are (GET /api/seasons/[id]/stats), counted over Episodes `range` (null: all of
 * them). A new range keeps showing the last one's numbers until its own come back, so the slider never blanks the view.
 */
export function useSeasonStats(seasonId: string, couchId: string | null, range: [number, number] | null = null, enabled = true) {
  const query = new URLSearchParams();
  if (couchId) query.set("couch", couchId);
  if (range) {
    query.set("from", String(range[0]));
    query.set("to", String(range[1]));
  }
  return useQuery({
    queryKey: ["new-design", "stats", seasonId, couchId, range?.[0] ?? null, range?.[1] ?? null],
    queryFn: () => get<SeasonStats>(`/api/seasons/${seasonId}/stats${query.size ? `?${query}` : ""}`),
    staleTime: 5 * 60_000,
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Several shows' stats at once, over all you've seen of each (By the numbers): the same reads as useSeasonStats. */
export function useStatsFor(seasonIds: string[], couchId: string | null, enabled = true) {
  return useQueries({
    queries: seasonIds.map((id) => ({
      queryKey: ["new-design", "stats", id, couchId, null, null],
      queryFn: () => get<SeasonStats>(`/api/seasons/${id}/stats${couchId ? `?couch=${encodeURIComponent(couchId)}` : ""}`),
      staleTime: 5 * 60_000,
      enabled,
    })),
  });
}

/** How it works for a show, told from the couch's games there (GET /api/seasons/[id]/how-it-works). */
export function useHowItWorks(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "how", seasonId, couchId],
    queryFn: () => get<HowItWorksPage>(`/api/seasons/${seasonId}/how-it-works${query}`),
    staleTime: 5 * 60_000,
    enabled,
  });
}

// ---- the moves' writes: the league routes the classic app uses, asked for `?quiet` so the answer is { ok } rather
// than the league's whole state (which holds results you may not have revealed: guard.ts) ----

async function send(path: string, method: "PUT" | "POST" | "DELETE", body?: unknown) {
  const res = await fetch(`${path}?quiet`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Couldn't save (${res.status})`);
  }
}

const episode = (leagueId: string, epId: string) => `/api/leagues/${leagueId}/episodes/${encodeURIComponent(epId)}`;

export const moves = {
  lineup: (leagueId: string, epId: string, playerId: string, castawayIds: string[]) =>
    send(`${episode(leagueId, epId)}/lineups/${encodeURIComponent(playerId)}`, "PUT", { castawayIds }),
  pick: (leagueId: string, epId: string, playerId: string, castawayId: string) => send(`${episode(leagueId, epId)}/picks`, "PUT", { playerId, castawayId }),
  guess: (leagueId: string, epId: string, betId: string, playerId: string, guess: string) =>
    send(`${episode(leagueId, epId)}/bets/${encodeURIComponent(betId)}/predictions`, "POST", { playerId, guess }),
  unguess: (leagueId: string, epId: string, betId: string, predId: string) =>
    send(`${episode(leagueId, epId)}/bets/${encodeURIComponent(betId)}/predictions/${encodeURIComponent(predId)}`, "DELETE"),
};

/** After a save: the home (your moves due) and every show's games read again. */
export function useAfterSave() {
  const client = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        client.invalidateQueries({ queryKey: HOME_KEY }),
        client.invalidateQueries({ queryKey: ["new-design", "games"] }),
      ]),
    [client]
  );
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
