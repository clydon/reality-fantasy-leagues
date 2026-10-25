"use client";

import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { GameView, WeekProgress } from "@/lib/game/game-view";
import type { HowItWorks } from "@/lib/game/formats/rulebook-describe";
import type { SeasonEpisodes, SeasonReveal } from "@/lib/server/season-episodes";
import type { SeasonStats } from "@/lib/server/season-stats";
import type { ChatLine, CouchChat } from "@/lib/server/couch-chat";
import type { Backstage, Chosen, PasteResult } from "@/lib/server/backstage";
import type { EpisodeResults } from "@/lib/server/episode-results";
import type { CatalogSeason } from "@/lib/server/way-in";
import type { ChangeLine } from "@/lib/server/league-changes";
import type { PreviewLine } from "@/lib/game/results-changes";
import type { WaiverWeek } from "@/lib/game/waiver-view";
import type { GameSettings, ScoringRules, WaiverAdminGame, WaiverAction } from "@/lib/server/backstage-games";
import type { CouchMoments } from "@/lib/server/couch-answers";
import type { ShowChange } from "@/lib/server/show-changes";
import type { Members, OutPreview } from "@/lib/server/backstage-members";
import type { AskRun, Ways } from "@/lib/server/results-ways";
import type { SeasonDraft } from "@/lib/server/season-draft";
import type { CouchHub } from "@/lib/server/couch-hub";
import type { ResultsDue } from "@/lib/game/results-due";
import type { CouchInvite, CouchSeason, JoinGame, JoinOptions, LeaveCouch } from "@/lib/server/couch-joins";
import type { CatchUpReveal } from "@/lib/server/season-episodes";

export type { CastFace, GameView, LineupMove, PickMove, PredictionMove, TableRow, WeekProgress } from "@/lib/game/game-view";
export type { EpisodeSeen, GameNight, Happened, OutFace, RevealGame, RevealTable, Scorer } from "@/lib/game/episode-view";
export type { EpisodeRow, SeasonEpisodes, SeasonReveal } from "@/lib/server/season-episodes";
export type { CastStat, Pattern, StatDef } from "@/lib/game/cast-stats";
export type { SeasonStats } from "@/lib/server/season-stats";
export type { ChatLine, CouchChat } from "@/lib/server/couch-chat";
export type { Backstage, BackstageEpisode, Chosen, Face, FillLine, Need, PasteResult, ResultRow, Shown } from "@/lib/server/backstage";
export type { EpisodeResult, EpisodeResults } from "@/lib/server/episode-results";
export type { Correction } from "@/lib/server/rulings";
export type { ChangeLine } from "@/lib/server/league-changes";
export type { PreviewLine } from "@/lib/game/results-changes";
export type { WaiverFace, WaiverMove, WaiverRunView, WaiverWeek } from "@/lib/game/waiver-view";
export type { GameRules, GameSettings, ScoringRules, WaiverAdminGame } from "@/lib/server/backstage-games";
export type { OurRules } from "@/lib/server/ours";
export type { CouchMoments } from "@/lib/server/couch-answers";
export type { ShowChange } from "@/lib/server/show-changes";
export type { Member, MemberGame, Members, OutPreview } from "@/lib/server/backstage-members";
export type { AskRun, Ways } from "@/lib/server/results-ways";
export type { DraftClock, DraftFace, DraftGame, DraftPick, DraftSeat } from "@/lib/game/draft-view";
export type { SeasonDraft } from "@/lib/server/season-draft";
export type { CouchHub, FeedItem, PlayingGame } from "@/lib/server/couch-hub";
export type { Accolade, CouchRecord, HeadToHead, Plaque, RankRow, Rankings, TrophyShelf, YourNumbers } from "@/lib/game/couch-standings";
export type { EarlyNight } from "@/lib/server/season-episodes";
export type { CouchInvite, CouchSeason, JoinGame, JoinOptions, LeaveCouch } from "@/lib/server/couch-joins";
export type { CatchUpReveal } from "@/lib/server/season-episodes";

// The new design's reads (docs/PLAN-new-design.md steps 0b, 0c and 1): the home, a show space's frame, your games
// on a show, its How it works and its cast stats, all spoiler-safe on the server (guard.ts); and the moves' writes, through the
// league routes the classic app uses. Only the couch chat polls (step 4), and it polls something small: the open chat
// a 32-character version every 5 s, the Chat tab's badge a count every 30 s (docs/HOSTING.md).

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
  /** Results in past where you are, or the final scores of an episode you revealed early (step 8). */
  results: ResultsDue;
}

export interface Couch {
  id: string;
  name: string;
  yourRole: "owner" | "member";
  members: { userId: string; name: string; role: "owner" | "member"; joinedAt: string; watching: string[] }[];
  games: GameRef[];
  /** The seasons its games are on, newest first ("Survivor 51"), for its line in the switcher. */
  seasons: { seasonId: string; label: string; status: string | null }[];
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

/** The hub's couch (step 8): power rankings, the trophy shelf, its games, accolades, your numbers and the feed. Read
 *  when the hub opens and kept for a minute; a reveal reads it again (useAfterReveal). */
export function useCouchHub(couchId: string | null) {
  return useQuery({
    queryKey: ["new-design", "couch-hub", couchId],
    queryFn: () => get<CouchHub>(`/api/couches/${couchId}/hub`),
    staleTime: 60_000,
    enabled: !!couchId,
  });
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

// ---- the couch's chat about a show (GET/POST /api/seasons/[id]/chat?couch=, couch-chat.ts) ----

const chatUrl = (seasonId: string, couchId: string, rest = "", query: Record<string, string> = {}) =>
  `/api/seasons/${seasonId}/chat${rest}?${new URLSearchParams({ couch: couchId, ...query })}`;

async function chatSend<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Couldn't send (${res.status})`);
  return out as T;
}

/** Post to the couch's chat about this show: Share this, the reveal's Post to the couch, and the composer. */
export async function postToCouch(seasonId: string, couchId: string, text: string): Promise<ChatLine> {
  return (await chatSend<{ message: ChatLine }>(chatUrl(seasonId, couchId), "POST", { text })).message;
}

export type ChatRead = CouchChat | { out: true };

/**
 * The couch's chat about this show, folded past where you are (unfolded through `unfold` once you've asked), polled
 * every 5 s while it's on screen. Each poll sends the version it has, and an unchanged chat keeps what's here.
 */
export function useCouchChat(seasonId: string, couchId: string | null, unfold: number | null) {
  const client = useQueryClient();
  const key = ["new-design", "chat", seasonId, couchId, unfold] as const;
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<ChatRead> => {
      const have = client.getQueryData<ChatRead>(key);
      const v = have && "v" in have ? have.v : null;
      const query: Record<string, string> = {};
      if (unfold) query.unfold = String(unfold);
      if (v) query.v = v;
      const body = await get<ChatRead | { unchanged: true; v: string }>(chatUrl(seasonId, couchId as string, "", query));
      return "unchanged" in body && have ? have : (body as ChatRead);
    },
    enabled: !!couchId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    // Show them asks again with `unfold`: the folded chat stays up until the unfolded one is back (this show's only).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === seasonId && prevQuery?.queryKey[3] === couchId ? prev : undefined),
  });
}

/**
 * The Chat tab's badge: how many messages you haven't read (a count, every 30 s where `poll`); with `reveal`, who the
 * chat's reveal lines say has revealed that episode. Shared by the frame and Tonight (one query, the frame polls it).
 */
export function useChatBadge(seasonId: string, couchId: string | null, reveal: number | null, poll = false) {
  const query: Record<string, string> = reveal ? { reveal: String(reveal) } : {};
  return useQuery({
    queryKey: ["new-design", "chat-badge", seasonId, couchId, reveal],
    queryFn: () => get<{ unread: number; revealed?: string[] }>(chatUrl(seasonId, couchId as string, "/unread", query)),
    enabled: !!couchId,
    staleTime: 20_000,
    refetchInterval: poll ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

/** The couch whose chat a show has: none when you're on your own there (no Chat tab). */
export const chatCouch = (show: { solo: boolean; couch: { id: string } | null }) => (show.solo ? null : (show.couch?.id ?? null));

/** What you can do in the couch's chat; each refreshes the open chat (and the badge, for a read). */
export function useChatActions(seasonId: string, couchId: string | null) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["new-design", "chat", seasonId, couchId] });
  const at = (id: string, rest = "") => chatUrl(seasonId, couchId as string, `/${encodeURIComponent(id)}${rest}`);
  return {
    async post(text: string) {
      const line = await postToCouch(seasonId, couchId as string, text);
      await refresh();
      return line;
    },
    react: (id: string, emoji: string) => chatSend(at(id, "/react"), "POST", { emoji }).then(refresh),
    edit: (id: string, text: string) => chatSend(at(id), "PATCH", { text }).then(refresh),
    remove: (id: string) => chatSend(at(id), "DELETE").then(refresh),
    async read(upTo: string) {
      await chatSend(chatUrl(seasonId, couchId as string, "/read"), "POST", { at: upTo });
      client.setQueriesData<{ unread: number; revealed?: string[] }>({ queryKey: ["new-design", "chat-badge", seasonId, couchId] }, (d) => (d ? { ...d, unread: 0 } : d));
    },
  };
}

/** After a reveal: everything the new design reads moves on (where you are, the tables, the moves, the episodes). */
export function useAfterReveal() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ["new-design"] }), [client]);
}

/** After results go in or come back out (Backstage, Recent changes): the same, everything moves on. */
export const useAfterResults = useAfterReveal;

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

// ---- Backstage (step 5): results for whoever runs a game here, and Recent changes for the couch. Read when a page opens
// and after each write; nothing polls. ----

const seasonUrl = (seasonId: string, rest: string, query: Record<string, string>) => `/api/seasons/${seasonId}${rest}?${new URLSearchParams(query)}`;

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't save (${res.status})`), { status: res.status });
  return out as T;
}

/** Backstage for this couch's season (GET .../backstage): the open episodes, what needs you, where results stand. `show`: Show me. */
export function useBackstage(seasonId: string, couchId: string | null, episode: number | null, opts: { show?: boolean; enabled?: boolean } = {}) {
  const query: Record<string, string> = { couch: couchId ?? "" };
  if (episode) query.episode = String(episode);
  if (opts.show) query.show = "1";
  return useQuery({
    queryKey: ["new-design", "backstage", seasonId, couchId, episode, !!opts.show],
    queryFn: () => get<Backstage>(seasonUrl(seasonId, "/backstage", query)),
    enabled: !!couchId && opts.enabled !== false,
    staleTime: 30_000,
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

/**
 * How results get in for this couch's season (GET .../backstage/ways, step 6c): One tap's unlock, Autopilot, whether our bot
 * is answering, and any One tap still running (polled while one is, so a card can say when it lands).
 */
export function useWays(seasonId: string, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "ways", seasonId, couchId],
    queryFn: () => get<Ways>(seasonUrl(seasonId, "/backstage/ways", { couch: couchId ?? "" })),
    enabled: !!couchId && enabled,
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.running.length ? 4000 : false),
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

/** One tap's run (GET .../backstage/ask?run=), polled every 2.5 s until it's done or failed. */
export function useAskRun(seasonId: string, couchId: string | null, runId: string | null) {
  return useQuery({
    queryKey: ["new-design", "ask-run", seasonId, couchId, runId],
    queryFn: () => get<AskRun>(seasonUrl(seasonId, "/backstage/ask", { couch: couchId ?? "", run: runId ?? "" })),
    enabled: !!couchId && !!runId,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "running" ? false : 2500),
  });
}

/** Recent changes to the couch's games here (GET .../changes), for everyone on the couch. */
export function useChanges(seasonId: string, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "changes", seasonId, couchId],
    queryFn: () => get<{ lines: ChangeLine[]; runs: boolean }>(seasonUrl(seasonId, "/changes", { couch: couchId ?? "" })),
    enabled: !!couchId && enabled,
    staleTime: 30_000,
  });
}

/** Backstage's writes. After each, everything the new design reads moves on (results reach the games, the tables, the log). */
export const backstage = {
  prompt: (seasonId: string, couchId: string, episode: number, kind: "quick" | "full") =>
    get<{ prompt: string | null; task: string }>(seasonUrl(seasonId, "/backstage/prompt", { couch: couchId, episode: String(episode), kind })),
  paste: (seasonId: string, couchId: string, body: { episode: number; kind: "quick" | "full"; answer: string; confirmed?: boolean }) =>
    post<PasteResult>(seasonUrl(seasonId, "/backstage/results", { couch: couchId }), body),
  preview: (seasonId: string, couchId: string, body: { episode: number; items: Chosen[]; quick?: boolean }) =>
    post<{ lines: PreviewLine[]; games: number }>(seasonUrl(seasonId, "/backstage/apply", { couch: couchId }), { ...body, preview: true }),
  apply: (seasonId: string, couchId: string, body: { episode: number; items: Chosen[]; quick?: boolean; wait?: { id: string; right: boolean } }) =>
    post<{ games: number; skipped: string[]; batch: string }>(seasonUrl(seasonId, "/backstage/apply", { couch: couchId }), body),
  undo: (seasonId: string, couchId: string, batch: string) =>
    post<{ undone: number; text: string }>(seasonUrl(seasonId, `/changes/${encodeURIComponent(batch)}/undo`, { couch: couchId })),
  /** Parks a long question at /b/<code> for an Open in ChatGPT / Grok link (api/briefs). */
  brief: (text: string) => post<{ code: string }>("/api/briefs", { text }),
  /** Keeps a corrected result's old version in your games (a house ruling); `preview` says what changes first. */
  keep: (seasonId: string, couchId: string, decisionId: string) => post<{ games: number; batch: string }>(seasonUrl(seasonId, "/backstage/rulings", { couch: couchId }), { decisionId }),
  keepPreview: (seasonId: string, couchId: string, decisionId: string) =>
    post<{ lines: PreviewLine[]; games: number }>(seasonUrl(seasonId, "/backstage/rulings", { couch: couchId }), { decisionId, preview: true }),
  drop: async (seasonId: string, couchId: string, decisionId: string) => {
    const res = await fetch(seasonUrl(seasonId, "/backstage/rulings", { couch: couchId, decision: decisionId }), { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't save (${res.status})`), { status: res.status });
    return out as { games: number };
  },
  /** One tap: our bot asks this episode's question for the couch (a run to poll; a run already going is joined). */
  ask: (seasonId: string, couchId: string, episode: number, kind: "quick" | "full") => post<AskRun>(seasonUrl(seasonId, "/backstage/ask", { couch: couchId }), { episode, kind }),
  /** Unlocks One tap for the whole couch on this season (free during beta). */
  unlock: (seasonId: string, couchId: string) => post<Ways>(seasonUrl(seasonId, "/backstage/ways", { couch: couchId }), { unlock: "tap" }),
  /** Who can fill in results on the couch: anyone on it, or only people who run games. */
  setFill: (seasonId: string, couchId: string, anyone: boolean) => sendJson<{ anyone: boolean }>(seasonUrl(seasonId, "/backstage/fill", { couch: couchId }), "PUT", { anyone }),
};

// ---- Results from everyone (step 6b): an episode's shared results with how sure the shared check is, and "Something
// wrong?". Read when an episode page or its dispute sheet opens; nothing polls. ----

/** One episode's shared results (GET /api/seasons/[id]/results/[n]): its people and results, corrections, house rulings. */
export function useEpisodeResults(seasonId: string, couchId: string | null, episode: number | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "results", seasonId, couchId, episode],
    queryFn: () => get<EpisodeResults>(seasonUrl(seasonId, `/results/${episode}`, { couch: couchId ?? "" })),
    enabled: !!couchId && !!episode && enabled,
    staleTime: 30_000,
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

/** Flags a result (or something missing): it goes to the shared check, and nothing changes until it's settled. */
export const flagResult = (
  seasonId: string,
  couchId: string,
  body: { episode: number; decisionId?: string; reason: "didnt-happen" | "wrong-person" | "wrong-episode" | "other" | "missing"; note?: string; link?: string }
) => post<{ others: number; status: string | null }>(seasonUrl(seasonId, "/disputes", { couch: couchId }), body);

/** "Something off? Suggest a fix" from How it works (step 6b part 2): it goes to the admin's Inbox; nothing changes until they fix the rulebook. */
export const suggestRulebookFix = (seasonId: string, couchId: string | null, body: { about: "segment" | "wayOut" | "scores" | "other"; note: string }) =>
  post<{ ok: true }>(seasonUrl(seasonId, "/rulebook/suggest", { couch: couchId ?? "" }), body);

// ---- Waivers (step 6a): your week in each game here, saved a spot at a time through the league routes; and Backstage
// II's pages for whoever runs a game. Read when a page opens and after each write; nothing polls. ----

/** Your waiver week in each game here (GET /api/seasons/[id]/waivers), as far as you've seen. */
export function useSeasonWaivers(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "waivers", seasonId, couchId],
    queryFn: () => get<{ games: WaiverWeek[] }>(`/api/seasons/${seasonId}/waivers${query}`),
    staleTime: 30_000,
    enabled,
  });
}

export const waivers = {
  /** One spot's picks, first choice first (empty clears it): the rest of your claim stays. */
  pick: (leagueId: string, dropId: string, addIds: string[]) => send(`/api/leagues/${leagueId}/waivers/claims`, "PUT", { spot: { dropId, addIds } }),
  /** Free agency: instant, first come, first served. */
  freeAgency: (leagueId: string, addId: string, dropId: string) => send(`/api/leagues/${leagueId}/waivers/free-agency`, "POST", { addId, dropId }),
};

// ---- the drafts (step 7): the draft room and the blind draft ----

/** How often the open draft room asks again: every 4 s while a turn-based draft is live, 15 s while one waits to start
 *  or people lock in, never once every draft here is done (docs/HOSTING.md). */
export function draftPoll(d: SeasonDraft | undefined): number | false {
  if (!d) return false;
  if (d.games.some((g) => g.kind === "snake" && g.phase === "live")) return 4_000;
  return d.games.some((g) => g.phase !== "done") ? 15_000 : false;
}

/**
 * The drafts on a show (GET /api/seasons/[id]/draft): each game of yours with a draft, as far as you've seen. `poll`: the
 * open room asks again (draftPoll) with the version it has, and an unchanged draft keeps what's here.
 */
export function useSeasonDraft(seasonId: string, couchId: string | null, opts: { poll?: boolean; enabled?: boolean } = {}) {
  const client = useQueryClient();
  const key = ["new-design", "draft", seasonId, couchId] as const;
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<SeasonDraft> => {
      const have = client.getQueryData<SeasonDraft>(key);
      const q = new URLSearchParams();
      if (couchId) q.set("couch", couchId);
      if (have && opts.poll) q.set("v", have.v);
      const body = await get<SeasonDraft | { unchanged: true; v: string }>(`/api/seasons/${seasonId}/draft${q.size ? `?${q}` : ""}`);
      return "unchanged" in body && have ? have : (body as SeasonDraft);
    },
    enabled: opts.enabled ?? true,
    staleTime: 3_000,
    refetchInterval: opts.poll ? (q) => draftPoll(q.state.data) : false,
    refetchIntervalInBackground: false,
  });
}

export type DraftAction =
  | { action: "pick"; castawayId: string; n: number }
  | { action: "lock"; playerId: string; castawayIds: string[] }
  | { action: "unlock"; playerId: string }
  | { action: "queue"; castawayIds: string[] }
  | { action: "start" }
  | { action: "order"; order: string[] }
  | { action: "settings"; timer?: number; away?: "wait" | "queue"; scheduledAt?: string | null }
  | { action: "undoLast" }
  | { action: "nudge"; n: number }
  | { action: "expire"; n: number };

/** A draft write (POST .../draft): answers its line's batch in Recent changes when it made one (the toast's Undo). */
export const draftAct = (seasonId: string, leagueId: string, body: DraftAction) =>
  post<{ ok: true; batch?: string | null; pushed?: boolean; picked?: boolean; queue?: string[] }>(`/api/seasons/${seasonId}/draft`, { leagueId, ...body });

const bsKey = (page: string, seasonId: string, couchId: string | null) => ["new-design", "bs2", page, seasonId, couchId] as const;

function useBs<T>(page: string, seasonId: string, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: bsKey(page, seasonId, couchId),
    queryFn: () => get<T>(seasonUrl(seasonId, `/backstage/${page}`, { couch: couchId ?? "" })),
    enabled: !!couchId && enabled,
    staleTime: 30_000,
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

export const useWaiversAdmin = (seasonId: string, couchId: string | null) => useBs<{ games: WaiverAdminGame[] }>("waivers", seasonId, couchId);
export const useGameSettings = (seasonId: string, couchId: string | null) => useBs<{ games: GameSettings[] }>("settings", seasonId, couchId);
export const useScoringRules = (seasonId: string, couchId: string | null) => useBs<ScoringRules>("rules", seasonId, couchId);
export const useMembers = (seasonId: string, couchId: string | null) => useBs<Members>("members", seasonId, couchId);

async function sendJson<T>(url: string, method: "PUT" | "PATCH" | "POST", body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't save (${res.status})`), { status: res.status });
  return out as T;
}

/** Backstage II's writes: each answers its batch in Recent changes, for the toast's Undo (null: nothing changed). */
export const gameAdmin = {
  waivers: <T = { batch: string | null }>(seasonId: string, couchId: string, leagueId: string, body: WaiverAction) =>
    sendJson<T>(seasonUrl(seasonId, "/backstage/waivers", { couch: couchId }), "POST", { leagueId, ...body }),
  settings: (seasonId: string, couchId: string, leagueId: string, body: { set?: Record<string, unknown>; reset?: "lineup" | "team" | "joining"; text?: string }) =>
    sendJson<{ batch: string | null }>(seasonUrl(seasonId, "/backstage/settings", { couch: couchId }), "PATCH", { leagueId, ...body }),
  role: (seasonId: string, couchId: string, userId: string, role: LeagueRole, leagueIds?: string[]) =>
    sendJson<{ batch: string; games: number }>(seasonUrl(seasonId, `/backstage/members/${encodeURIComponent(userId)}`, { couch: couchId }), "PUT", { role, leagueIds }),
  remove: (seasonId: string, couchId: string, userId: string, preview = false) =>
    sendJson<OutPreview & { batch: string | null }>(seasonUrl(seasonId, `/backstage/members/${encodeURIComponent(userId)}/remove`, { couch: couchId }), "POST", { preview }),
  leave: (seasonId: string, couchId: string, preview = false) => sendJson<OutPreview & { batch: string | null }>(seasonUrl(seasonId, "/leave", { couch: couchId }), "POST", { preview }),
};

// ---- Make it ours (step 6b part 3): Scoring rules' writes, each a Commissioner's, `preview` first where standings can move ----

const rulesUrl = (seasonId: string, couchId: string) => seasonUrl(seasonId, "/backstage/rules", { couch: couchId });
type Moved = { lines: PreviewLine[] };
type Batch = { batch: string | null };
export const ourRules = {
  make: (seasonId: string, couchId: string) => post<{ batch: string; games: number }>(rulesUrl(seasonId, couchId), { action: "ours" }),
  followPreview: (seasonId: string, couchId: string) => post<Moved & { off: number; own: number }>(rulesUrl(seasonId, couchId), { action: "follow", preview: true }),
  follow: (seasonId: string, couchId: string) => post<Batch>(rulesUrl(seasonId, couchId), { action: "follow" }),
  counts: (seasonId: string, couchId: string, off: string[], preview = false) => post<Moved & Batch>(rulesUrl(seasonId, couchId), { action: "counts", off, preview }),
  add: (seasonId: string, couchId: string, add: { label: string; counted: "yesNo" | "eachTime"; points: number }) => post<Batch>(rulesUrl(seasonId, couchId), { action: "moment", add }),
  remove: (seasonId: string, couchId: string, id: string, preview = false) => post<Moved & Batch>(rulesUrl(seasonId, couchId), { action: "moment", remove: id, preview }),
  update: (seasonId: string, couchId: string, edit: string, take: boolean, preview = false) => post<Moved & Batch>(rulesUrl(seasonId, couchId), { action: "update", edit, take, preview }),
  points: (seasonId: string, couchId: string, leagueId: string, points: Record<string, number>, preview = false) =>
    post<Moved & Batch>(rulesUrl(seasonId, couchId), { action: "points", leagueId, points, preview }),
};

/** The couch's own moments in an episode you've seen, with your answer and what's settled (none: the couch has none). */
export function useCouchMoments(seasonId: string, couchId: string | null, episode: number, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "couch-moments", seasonId, couchId, episode],
    queryFn: () => get<CouchMoments>(seasonUrl(seasonId, `/couch-moments/${episode}`, { couch: couchId ?? "" })),
    enabled: !!couchId && enabled,
    staleTime: 30_000,
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

export const answerCouchMoment = (seasonId: string, couchId: string, episode: number, moment: string, picks: { name: string; times?: number }[]) =>
  post<CouchMoments>(seasonUrl(seasonId, `/couch-moments/${episode}`, { couch: couchId }), { moment, picks });

// ---- something the rulebook doesn't have (step 6c part 2): on an episode's page, once you've seen it ----

/** Polls (every 4 s) only while our bot is working out what to add: the card says when it's in. */
export function useShowChange(seasonId: string, couchId: string | null, episode: number) {
  return useQuery({
    queryKey: ["new-design", "show-change", seasonId, couchId, episode],
    queryFn: () => get<{ change: ShowChange | null }>(seasonUrl(seasonId, `/show-changes/${episode}`, { couch: couchId ?? "" })),
    enabled: !!couchId,
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.change?.status === "checking" ? 4000 : false),
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 2,
  });
}

export const answerShowChange = (seasonId: string, couchId: string, episode: number, isNew: boolean) =>
  post<{ change: ShowChange | null }>(seasonUrl(seasonId, `/show-changes/${episode}`, { couch: couchId }), { isNew });

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

// ---- couches and joining their games (step 9; couch-joins.ts). Read when a sheet or page opens; nothing polls. ----

const couchKey = (couchId: string | null, ...rest: unknown[]) => ["new-design", "couch", couchId, ...rest];

/** Your invite code for a couch (made the first time). */
export function useInviteCode(couchId: string | null, enabled = true) {
  return useQuery({ queryKey: couchKey(couchId, "invite"), queryFn: () => get<{ code: string }>(`/api/couches/${couchId}/invite`), enabled: !!couchId && enabled, staleTime: Infinity });
}

/** What an invite code opens on: the couch, then its games and who may join each. Signed out too. */
export function useCouchInvite(code: string) {
  return useQuery({ queryKey: ["new-design", "invite", code], queryFn: () => get<CouchInvite>(`/api/couches/invite/${encodeURIComponent(code)}`), retry: false });
}

/** Every game on a couch and who may join it. */
export function useCouchGames(couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: couchKey(couchId, "games"),
    queryFn: () => get<{ seasons: CouchSeason[]; games: JoinGame[] }>(`/api/couches/${couchId}/games`),
    enabled: !!couchId && enabled,
    staleTime: 60_000,
  });
}

/** Before joining an underway game: where you can start, and (once a start's chosen) the castaways for your team. */
export function useJoinOptions(couchId: string | null, leagueId: string | null, start: number | null) {
  return useQuery({
    queryKey: couchKey(couchId, "join", leagueId, start),
    queryFn: () => get<JoinOptions>(`/api/couches/${couchId}/games/${leagueId}${start ? `?start=${start}` : ""}`),
    enabled: !!couchId && !!leagueId,
    placeholderData: keepPreviousData,
  });
}

export const couches = {
  start: (name: string) => post<{ id: string; name: string; code: string }>("/api/couches", { name }),
  join: (code: string) => post<{ couchId: string; name: string; already: boolean }>("/api/couches/join", { code }),
  leave: (couchId: string, preview = false) => post<LeaveCouch>(`/api/couches/${couchId}/leave`, { preview }),
  joinGame: (couchId: string, leagueId: string, body: { start?: number | null; team?: string[] }) =>
    post<{ leagueId: string; seasonId: string | null; start: number | null; catchingUp: boolean }>(`/api/couches/${couchId}/games/${leagueId}`, { action: "join", ...body }),
  ask: (couchId: string, leagueId: string) => post<{ asked: true }>(`/api/couches/${couchId}/games/${leagueId}`, { action: "ask" }),
  withdraw: (couchId: string, leagueId: string) => post<{ asked: false }>(`/api/couches/${couchId}/games/${leagueId}`, { action: "withdraw" }),
  answer: (couchId: string, requestId: string, letIn: boolean) => post<{ ok: true }>(`/api/couches/${couchId}/requests/${requestId}`, { letIn }),
  /** Catching up: reveal the next episode of your own season in a game you joined late. */
  catchUp: (seasonId: string, couchId: string | null, leagueId: string) => post<CatchUpReveal>(`/api/seasons/${seasonId}/catchup`, { leagueId, couch: couchId }),
};

/** After joining or leaving a couch or a game: everything the new design reads moves on. */
export const useAfterCouch = useAfterReveal;

// ---- the way in (step 9 part 2; way-in.ts): first run's catalog, open signed out, and saving its shows ----

export type { CatalogSeason } from "@/lib/server/way-in";

/** Every season first run can pick: on now or coming up first (the wall), then the rest (found by searching). */
export function useCatalog() {
  return useQuery({ queryKey: ["new-design", "catalog"], queryFn: () => get<{ seasons: CatalogSeason[] }>("/api/catalog"), staleTime: 300_000 });
}

/** First run's shows for the account just made (or signed into), and the new design as the one it opens on. */
export const saveFirstRun = (follows: { seasonId: string; seenThrough: number }[]) => post<{ saved: number }>("/api/me/first-run", { follows, ui: "new" });
