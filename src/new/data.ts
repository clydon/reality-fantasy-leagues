"use client";

import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { api, phoneTimeZone } from "@/lib/api";
import type { GameView, WeekProgress } from "@/lib/game/game-view";
import type { HowItWorks } from "@/lib/game/formats/rulebook-describe";
import type { SeasonEpisodes, SeasonReveal } from "@/lib/server/season-episodes";
import type { SeasonStats } from "@/lib/server/season-stats";
import type { ChatLine, CouchChat } from "@/lib/server/couch-chat";
import type { Backstage, Chosen, PasteResult } from "@/lib/server/backstage";
import type { EpisodeResults } from "@/lib/server/episode-results";
import type { CatalogSeason } from "@/lib/server/way-in";
import type { BotLevel, PoolInfo, PracticeGame, PracticeInfo, SoloSeason } from "@/lib/server/solo";
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
import type { ListingHit } from "@/lib/game/listing";
import type { AddedShow } from "@/lib/server/add-show";
import type { KeepUp } from "@/lib/server/keep-up";
import type { RecapState } from "@/lib/server/episode-recaps";
import type { Roster } from "@/lib/server/rosters";
import type { StepEpisode } from "@/lib/server/schedule";
import type { ListingSeason } from "@/lib/server/listings";
import type { MakeState } from "@/lib/server/make-game";
import type { Started, StartOptions } from "@/lib/server/start-game";
import type { DeletePreview, EndGame } from "@/lib/server/end-game";
import type { HiddenShow, WeekEpisode } from "@/lib/server/guide";
import type { WeekListing } from "@/lib/game/tv-listings";
import type { PlanAnswerOut, PlanHow, PlanOptions, WatchPlan } from "@/lib/server/watch-plans";
import type { EpisodeVerdict, ShowVerdict } from "@/lib/server/ratings";
import type { EpisodeCalls } from "@/lib/server/calls";
import type { Poll, SeasonPolls, ThisWeekShow } from "@/lib/server/polls";
import type { EpisodeBingo } from "@/lib/server/bingo";
import type { TriviaCard, TriviaRound } from "@/lib/server/trivia";
import type { OnNow, Reaction, SessionWrite, TogetherAnswer, WatchCard, WatchRead } from "@/lib/server/watch-along";
import type { GifHit } from "@/lib/server/gifs";
import type { Gif, TogetherChange, WatchMode } from "@/lib/game/watch-along";
import type { AiChoice, Profile } from "@/lib/server/profile";
import type { SharePreset, Sharing } from "@/lib/sharing";
import type { Note, ShowNotify } from "@/lib/server/notify-prefs";
import type { ChatMode, MomentId } from "@/lib/moments";
import type { Face as PersonFace } from "@/lib/people";
import type { Theme } from "@/lib/appearance";

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
export type { CallMove } from "@/lib/game/game-view";
export type { BotLevel, PoolInfo, PracticeGame, PracticeInfo, SoloSeason } from "@/lib/server/solo";
export type { MakeReview, MakeState } from "@/lib/server/make-game";
export type { StartChoice, Started, StartOptions } from "@/lib/server/start-game";
export type { DeletePreview, EndGame } from "@/lib/server/end-game";
export type { HiddenShow, WeekEpisode } from "@/lib/server/guide";
export type { PlanAnswer, PlanEpisode, PlanHow, PlanOptions, PlanPerson, WatchPlan } from "@/lib/server/watch-plans";
export type { EpisodeVerdict, EpisodeVerdictLine, RatingFace, ShowVerdict } from "@/lib/server/ratings";
export type { Taste, Twin } from "@/lib/game/ratings";
export type { CallPerson, CallSay, EpisodeCalls } from "@/lib/server/calls";
export type { CallOption, CallQuestion, Verdict } from "@/lib/game/calls";
export type { Poll, PollOption, SeasonPolls, ThisWeekShow } from "@/lib/server/polls";
export type { BingoDidIt, BingoMate, BingoPerson, EpisodeBingo } from "@/lib/server/bingo";
export type { BingoSquare, LineCount, Truth } from "@/lib/game/bingo";
export type { BingoMove } from "@/lib/game/game-view";
export type { TriviaCard, TriviaRound } from "@/lib/server/trivia";
export type { TriviaOption, TriviaQuestion } from "@/lib/game/trivia";
export type { OnNow, Reaction, SessionWrite, Together, TogetherAnswer, WatchCard, WatchFace, WatchRead, WatchStatus } from "@/lib/server/watch-along";
export type { GifHit } from "@/lib/server/gifs";
export type { Gif, ReactKind, ReactionKind, TogetherChange, Watcher, WatchMode } from "@/lib/game/watch-along";
export type { AiChoice, Profile } from "@/lib/server/profile";
export type { Face as PersonFace } from "@/lib/people";

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
  /** A game on no couch (step 9 part 3): a season's public pool, or your practice couch against computer players. */
  solo?: "public" | "practice" | null;
  /** Archived (step 10 part 2b): on the couch and the trophy shelf as it stood; nothing scores it. */
  archived?: boolean;
  /** A game over a span (step 6 of docs/PLAN-sports-data.md): its first and last episode; null or absent to the season's end. */
  span?: { from: number; to: number } | null;
  /** The episode it starts with: a game started after a span ended is its run back. */
  start?: number;
}

export interface SeasonHeader {
  seasonId: string;
  seasonNumber: number | null;
  seasonName: string | null;
  status: string | null;
  episodeCount: number | null;
  premiereDate: string | null;
  /** Weekly (or nightly), or a streaming drop (step 14). */
  release?: "weekly" | "nightly" | "binge";
  /** When a streaming season drops every episode (step 14), else null. */
  dropAt?: string | null;
  /** Set up as a game (step 10): false is "Not a game yet", a show someone added to follow. */
  ready?: boolean;
  show: {
    id: string;
    slug: string;
    name: string;
    kind: "competition" | "series" | "talk" | "sport";
    artUrl: string | null;
    /** A landscape image for the show bar (TMDB's backdrop), else null: the bar uses the poster. */
    backdropUrl?: string | null;
    terms: { castaway: string | null; tribe: string | null };
    /** Its TV listing (step 10), so the guide knows the same show in the listings (step 11). */
    tvmazeId?: number | null;
    /** Where it airs, from its listing: the network, else the streaming service (step 14). */
    network?: string | null;
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
  /** How where you are keeps up as episodes air (keep-up.ts): off, Live ("ask") or by itself ("auto"); off on one you play. */
  keepUp: KeepUp;
  /** Live's "Seen it?": the episode that's ended past where you are, when there's one to ask about. */
  seenIt: number | null;
  upNext: UpNext | null;
  latestAired: number;
  games: GameRef[];
  /** Who's set for the next episode, per game of yours here with a weekly move. */
  progress: (WeekProgress & { leagueId: string })[];
  /** Results in past where you are, or the final scores of an episode you revealed early (step 8). */
  results: ResultsDue;
  /** The hub's "you both watch" nudge was answered for this show (step 10). */
  nudgeOff?: boolean;
  /** Its episodes around this week, for the guide (step 11): when each starts, never a title. */
  week: WeekEpisode[];
}

export interface Couch {
  id: string;
  name: string;
  yourRole: "owner" | "member";
  /** Each person's face comes with them (step 15 part 1): the colour they chose and their picture's version. What they watch
   *  openly, and how far they are in each (`at`, by season: step 15 part 3), only from someone who shares Where I am. */
  members: {
    userId: string;
    name: string;
    role: "owner" | "member";
    joinedAt: string;
    colour: string | null;
    picture: number | null;
    watching: string[];
    at?: Record<string, number>;
  }[];
  games: GameRef[];
  /** The seasons its games are on, newest first ("Survivor 51"), for its line in the switcher. */
  seasons: { seasonId: string; label: string; status: string | null }[];
}

export interface CouchShow extends SeasonHeader {
  upNext: UpNext | null;
  latestAired: number;
  week: WeekEpisode[];
}

export interface Home {
  /** You: your face, and your Appearance (step 15 part 4). */
  user: { id: string; name: string; colour: string | null; picture: number | null; theme: Theme };
  couches: Couch[];
  shows: HomeShow[];
  /** The couches' shows you don't follow (step 10: The couch is watching); who watches each is in the couches' members. */
  couchShows: CouchShow[];
  unscheduled: GameRef[];
  moves: Move[];
  backstage: { leagueId: string; leagueName: string; text: string }[];
  /** What you've hidden from the guide (step 11); your own shows always show. */
  guideHidden: HiddenShow[];
  /** Your couches' planned nights still to come (step 11 part 3): the guide, a show's Tonight. */
  plans: WatchPlan[];
  /** The bell (step 15 part 2): how many notices are new since you last looked. */
  notes?: { unread: number };
}

export interface Space extends SeasonHeader {
  couchId: string | null;
  you: { following: boolean; private: boolean; seenThrough: number | null; plays?: boolean; keepUp?: KeepUp; seenIt?: number | null };
  schedule: { release: string; dropAt: string | null; airTz: string; upNext: UpNext | null; latestAired: number } | null;
  games: GameRef[];
  /** `seen`: how far they are, where they share it (step 15 part 3's Where I am); never yours here (that's `you`). */
  people: { userId: string; name: string; role: "owner" | "member"; watching: boolean; seen?: number | null; playing: string[] }[] | null;
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

/** The home read, saying the time zone this phone is in (kept so a push says your time: step 15 part 2). */
const homeUrl = () => `/api/me/home?tz=${encodeURIComponent(phoneTimeZone())}`;

export function useHome() {
  return useQuery({ queryKey: HOME_KEY, queryFn: () => get<Home>(homeUrl()), staleTime: 60_000 });
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
/** The open chat, polled. `since` (step 15 part 4): once you've read back (Earlier messages), everything from the message the
 *  first window started at, so it never slides away under what you've read; its time goes too, for when it's been deleted. */
export function useCouchChat(seasonId: string, couchId: string | null, unfold: number | null, since: Pick<ChatLine, "id" | "at"> | null = null) {
  const client = useQueryClient();
  const key = ["new-design", "chat", seasonId, couchId, unfold, since?.id ?? null] as const;
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<ChatRead> => {
      const have = client.getQueryData<ChatRead>(key);
      const v = have && "v" in have ? have.v : null;
      const query: Record<string, string> = {};
      if (unfold) query.unfold = String(unfold);
      if (since) Object.assign(query, { since: since.id, at: since.at });
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

/** Earlier messages (step 15 part 4): the 100 before a message, folded as the rest are; read on a tap, never polled. */
export function chatEarlier(seasonId: string, couchId: string, before: Pick<ChatLine, "id" | "at">, unfold: number | null) {
  return get<{ messages: ChatLine[]; more: boolean } | { out: true }>(
    chatUrl(seasonId, couchId, "", { before: before.id, at: before.at, ...(unfold ? { unfold: String(unfold) } : {}) })
  );
}

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
  /** A rulebook someone made (step 10 part 3): your couch can say it looks right, or has. */
  check?: "can" | "done" | null;
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

/** "Looks right to us" (step 10 part 3): someone on another couch checks a rulebook someone made with Make it a game. */
export const checkRulebook = (seasonId: string, couchId: string) => post<{ ok: true }>(seasonUrl(seasonId, "/rulebook/check", { couch: couchId }), {});

// ---- Waivers (step 6a): your week in each game here, saved a spot at a time through the league routes; and Backstage
// II's pages for whoever runs a game. Read when a page opens and after each write; nothing polls. ----

/** Your waiver week in each game here (GET /api/seasons/[id]/waivers), as far as you've seen. */
export function useSeasonWaivers(seasonId: string, couchId: string | null, enabled = true) {
  const query = couchId ? `?couch=${encodeURIComponent(couchId)}` : "";
  return useQuery({
    queryKey: ["new-design", "waivers", seasonId, couchId],
    queryFn: () => get<{ games: WaiverWeek[]; seen: string[] }>(`/api/seasons/${seasonId}/waivers${query}`),
    staleTime: 30_000,
    enabled,
  });
}

export const waivers = {
  /** You've watched a game's run: its plate goes on every phone of yours (step 15 part 2). */
  seen: (seasonId: string, leagueId: string, periodId: string) => post<{ ok: true }>(`/api/seasons/${seasonId}/waivers`, { seen: { leagueId, periodId } }),
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
  /** Lock it down (step 15 part 4): competitive mode for every game you run here, one batch. */
  lockDown: (seasonId: string, couchId: string, on: boolean) =>
    sendJson<{ batch: string | null; games: number }>(seasonUrl(seasonId, "/backstage/settings", { couch: couchId }), "PATCH", { lockDown: on }),
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
  /** Whoever started a couch renames it or hands it on (step 15 part 1). */
  rename: (couchId: string, name: string) => post<{ name: string }>(`/api/couches/${couchId}`, { action: "rename", name }),
  handOn: (couchId: string, to: string) => post<{ owner: string }>(`/api/couches/${couchId}`, { action: "handOn", to }),
  /** A new invite code: yours is retired and stops working. */
  newCode: (couchId: string) => post<{ code: string }>(`/api/couches/${couchId}/invite`),
};

// ---- your profile and settings (step 15 part 1; profile.ts). Read when Settings, the profile sheet or an Ask an AI sheet
// first opens; nothing polls. A face is a person's colour and picture, which come with the home read (usePerson). ----

const PROFILE_KEY = ["new-design", "profile"] as const;

export function useProfile(enabled = true) {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => get<Profile>("/api/me/profile"), enabled, staleTime: 5 * 60_000 });
}

/** Your AI for results (Settings): what an Ask an AI sheet opens. ChatGPT until the profile's read. */
export function useAiChoice(): AiChoice {
  return useProfile().data?.ai ?? "chatgpt";
}

/** A face as the home read has it: you, or someone on one of your couches. Only watches the home that's been read. */
export function usePerson(userId: string): PersonFace | null {
  const { data } = useQuery({ queryKey: HOME_KEY, queryFn: () => get<Home>(homeUrl()), enabled: false, select: (h: Home) => faceIn(h, userId) });
  return data ?? null;
}

function faceIn(h: Home, userId: string): PersonFace | null {
  if (h.user.id === userId) return { userId, name: h.user.name, colour: h.user.colour ?? null, picture: h.user.picture ?? null };
  for (const c of h.couches) {
    const m = c.members.find((x) => x.userId === userId);
    if (m) return { userId, name: m.name, colour: m.colour ?? null, picture: m.picture ?? null };
  }
  return null;
}

/** Your Appearance as the home read last said it, without reading it (ThemeSync: a second device catches up). */
export function useHomeTheme(): Theme | null {
  const { data } = useQuery({ queryKey: HOME_KEY, queryFn: () => get<Home>(homeUrl()), enabled: false, select: (h: Home) => h.user.theme ?? null });
  return data ?? null;
}

/** After saving your Appearance: the profile as answered and the home's copy, so nothing reads it back as it was. */
export function useAfterTheme() {
  const qc = useQueryClient();
  return useCallback(
    (profile: Profile) => {
      qc.setQueryData(PROFILE_KEY, profile);
      qc.setQueryData<Home>(HOME_KEY, (h) => (h ? { ...h, user: { ...h.user, theme: profile.theme } } : h));
    },
    [qc]
  );
}

export const profileApi = {
  /** Any of your name, colour, AI, spoiler setting, a notification moment, What your couch sees or Appearance; answers the profile
   *  as it now is. */
  save: (body: {
    name?: string;
    colour?: string | null;
    ai?: AiChoice;
    hideScores?: boolean;
    notify?: { moment: MomentId; on: boolean } | { chat: ChatMode };
    sharing?: { preset: SharePreset } | Partial<Sharing>;
    theme?: Theme;
  }) => sendJson<Profile>("/api/me/profile", "PUT", body),
  /** Your picture, already made small (256 by 256). Answers its version. */
  picture: async (image: Blob): Promise<{ picture: number }> => {
    const res = await fetch("/api/me/picture", { method: "PUT", headers: { "content-type": image.type }, body: image });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't save (${res.status})`), { status: res.status });
    return out;
  },
  removePicture: async (): Promise<void> => {
    const res = await fetch("/api/me/picture", { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't remove it. Try again.");
  },
};

/**
 * After a profile change: the profile as answered, and everything else read again in the background (your face and name on the
 * home; your seats' names everywhere; with Hide scores, what the guard lets out). Not waited on: the toast says it's saved at once.
 */
export function useAfterProfile() {
  const qc = useQueryClient();
  return useCallback(
    async (profile?: Profile) => {
      if (profile) qc.setQueryData(PROFILE_KEY, profile);
      void qc.invalidateQueries({ queryKey: ["new-design"], predicate: (q) => !(profile && q.queryKey[1] === "profile") });
    },
    [qc]
  );
}

/** After joining or leaving a couch or a game: everything the new design reads moves on. */
export const useAfterCouch = useAfterReveal;

// ---- notifications (step 15 part 2; notify-prefs.ts): the bell, read when it opens (its count rides on the home read, never
// polled), and a show's own switches, read when its sheet opens ----

export type { Note, ShowNotify } from "@/lib/server/notify-prefs";

export function useNotes(enabled: boolean) {
  return useQuery({ queryKey: ["new-design", "notes"], queryFn: () => get<{ notes: Note[]; readAt: string | null }>("/api/me/notifications"), enabled, staleTime: 0 });
}

export function useShowNotify(seasonId: string, enabled: boolean) {
  return useQuery({ queryKey: ["new-design", "show-notify", seasonId], queryFn: () => get<ShowNotify>(`/api/seasons/${seasonId}/notifications`), enabled, staleTime: 30_000 });
}

export const notesApi = {
  /** You've looked: the bell's count starts again. */
  read: () => post<{ ok: true }>("/api/me/notifications", { read: true }),
  /** One of a show's moments on or off for that show alone. */
  show: (seasonId: string, moment: MomentId, on: boolean) => sendJson<ShowNotify>(`/api/seasons/${seasonId}/notifications`, "PUT", { moment, on }),
};

/** After opening the bell: its count on the home read goes (the home reads again in the background). */
export function useAfterNotesRead() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.setQueryData<Home>(HOME_KEY, (h) => (h ? { ...h, notes: { unread: 0 } } : h));
  }, [qc]);
}

// ---- the way in (step 9 part 2; way-in.ts): first run's catalog, open signed out, and saving its shows ----

export type { CatalogSeason } from "@/lib/server/way-in";

/** Every season first run can pick: on now or coming up first (the wall), then the rest (found by searching). */
/** `enabled`: false until it's needed (Add a show reads it only once it opens: step 11, from Noticed). */
export function useCatalog(enabled = true) {
  return useQuery({ queryKey: ["new-design", "catalog"], queryFn: () => get<{ seasons: CatalogSeason[] }>("/api/catalog"), staleTime: 300_000, enabled });
}

/** First run's shows for the account just made (or signed into), and the new design as the one it opens on. A show from the
 *  TV listings, or one added by name (step 10), is made if it has to be. */
export const saveFirstRun = (follows: FirstRunFollow[]) => post<{ saved: number }>("/api/me/first-run", { follows, ui: "new" });
export type FirstRunFollow = ({ seasonId: string } | { listing: number } | { name: string }) & { seenThrough: number };

// ---- watching (step 10 part 1; add-show.ts, listings.ts, follows.ts): Add a show, where you are, watch privately. Read when
// a sheet opens; nothing polls. ----

export type { ListingHit } from "@/lib/game/listing";
export type { AddedShow } from "@/lib/server/add-show";
export type { ListingSeason } from "@/lib/server/listings";

/** Shows in the TV listings whose names match (TVmaze, through our edge-cached proxy). */
export function useListingSearch(q: string) {
  const t = q.trim();
  return useQuery({
    queryKey: ["new-design", "listings", t.toLowerCase()],
    queryFn: () => get<{ hits: ListingHit[]; unavailable?: boolean }>(`/api/listings/search?q=${encodeURIComponent(t)}`),
    enabled: t.length >= 2,
    staleTime: 3600_000,
    placeholderData: keepPreviousData,
  });
}

/** One listing's season: what adding it would follow, and how much of it has aired (for where you are). */
export function useListingSeason(tvmazeId: number | null) {
  return useQuery({
    queryKey: ["new-design", "listing", tvmazeId],
    queryFn: () => get<ListingSeason>(`/api/listings/${tvmazeId}`),
    enabled: tvmazeId != null,
    staleTime: 3600_000,
  });
}

export const watching = {
  /** Add a show from its listing or by name, at where you are. */
  add: (body: ({ listing: number } | { name: string }) & { seenThrough?: number; live?: boolean }) => post<AddedShow>("/api/me/shows", body),
  /** Follow (or stop following) a season here, watch it privately, say where you are, answer the nudge, or how it keeps up. */
  follow: (seasonId: string, change: { following?: boolean; private?: boolean; seenThrough?: number; nudgeOff?: boolean; keepUp?: KeepUp; notYet?: number }) =>
    sendJson<{ seenThrough: number; following: boolean; private: boolean; keepUp: KeepUp; notYet: number | null }>(`/api/me/follows/${seasonId}`, "PUT", change),
};

export type { KeepUp } from "@/lib/server/keep-up";
export type { RecapState } from "@/lib/server/episode-recaps";

/** Fill in what happened (episode-recaps.ts): which aired episodes have no recap, and our bot's ask, read while it's going. */
export function useRecaps(seasonId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "recaps", seasonId],
    queryFn: () => get<RecapState>(`/api/seasons/${seasonId}/recaps`),
    enabled: enabled && seasonId != null,
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.asking ? 4000 : false),
  });
}

export type { Roster, RosterGroup, StatItem } from "@/lib/server/rosters";

/** A sport's Players tab (rosters.ts): who's playing by team, their stats, and our bot's ask or the stats fill, read while going. */
export function useRoster(seasonId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "roster", seasonId],
    queryFn: () => get<Roster>(`/api/seasons/${seasonId}/roster`),
    enabled: enabled && seasonId != null,
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.asking || q.state.data?.stats.asking ? 4000 : false),
  });
}

export const roster = {
  ask: (seasonId: string) => post<Roster>(`/api/seasons/${seasonId}/roster`, { action: "ask" }),
  paste: (seasonId: string, answer: string) => post<Roster & { filled: number }>(`/api/seasons/${seasonId}/roster`, { answer }),
  prompt: (seasonId: string) => get<{ prompt: string }>(`/api/seasons/${seasonId}/roster?prompt=1`),
};

export const recaps = {
  ask: (seasonId: string) => post<RecapState>(`/api/seasons/${seasonId}/recaps`, { action: "ask" }),
  paste: (seasonId: string, answer: string) => post<RecapState & { filled: number }>(`/api/seasons/${seasonId}/recaps`, { answer }),
  prompt: (seasonId: string) => get<{ prompt: string }>(`/api/seasons/${seasonId}/recaps?prompt=1`),
};
export type { StepEpisode } from "@/lib/server/schedule";

/** A season's aired episodes for the where stepper (when each aired; titles as far as you've seen, a sport's always). */
export function useAiredEpisodes(seasonId: string | null) {
  return useQuery({
    queryKey: ["new-design", "aired", seasonId],
    queryFn: () => get<{ episodes: StepEpisode[] }>(`/api/seasons/${seasonId}/aired`),
    enabled: seasonId != null,
    staleTime: 300_000,
  });
}

/** After adding, following or moving where you are: everything moves on (the hub, the show, what you can see). */
export const useAfterWatching = useAfterReveal;

// ---- the TV guide (step 11; guide.ts): Hide from guide. The guide itself comes with the home read; nothing polls. ----

export type { WeekListing } from "@/lib/game/tv-listings";

/** The week on TV for the guide's Also on (step 11 part 2): the same for everyone, kept at the edge an hour, read once a visit. */
export function useListingsWeek() {
  return useQuery({ queryKey: ["new-design", "listings-week"], queryFn: () => get<{ listings: WeekListing[] }>("/api/listings/week"), staleTime: 3600_000 });
}

export const guide = {
  /** Hide a show here (by one of its seasons, or itself) from your guide, or bring it back. Answers what's hidden now. */
  hide: (show: { seasonId: string } | { showId: string }, hidden: boolean) => post<{ hidden: HiddenShow[] }>("/api/me/guide/hidden", { ...show, hidden }),
  /** The same for a TV listing nobody has made a show of (part 2's Also on). */
  hideListing: (tvmazeId: number, name: string, hidden: boolean) => post<{ hidden: HiddenShow[] }>("/api/me/guide/hidden", { tvmazeId, name, hidden }),
};

/** After Hide from guide: the home's hidden list, put in place without reading the home again. */
export function useSetGuideHidden() {
  const client = useQueryClient();
  return useCallback((hidden: HiddenShow[]) => client.setQueryData<Home>(HOME_KEY, (h) => (h ? { ...h, guideHidden: hidden } : h)), [client]);
}

// ---- playing solo (step 9 part 3; solo.ts): a season's public pool and your practice couch. Read when the hub, a show's
// Games tab or the pool's page opens; nothing polls. The pool's pick goes through `moves.pick`, as every Survival Pool's. ----

/** Each of your shows' pool and practice couch (the solo hub's Play on your own). */
export function useSolo(enabled = true) {
  return useQuery({ queryKey: ["new-design", "solo"], queryFn: () => get<{ seasons: SoloSeason[] }>("/api/me/solo"), staleTime: 60_000, enabled });
}

/** A season's public pool for you: can you join, how many are in, and yours (the top ten and you). */
export function usePool(seasonId: string, enabled = true) {
  return useQuery({ queryKey: ["new-design", "pool", seasonId], queryFn: () => get<PoolInfo>(`/api/seasons/${seasonId}/pool`), staleTime: 30_000, enabled });
}

/** Your practice couch on a season, or whether you can start one. */
export function usePractice(seasonId: string, enabled = true) {
  return useQuery({ queryKey: ["new-design", "practice", seasonId], queryFn: () => get<PracticeInfo>(`/api/seasons/${seasonId}/practice`), staleTime: 30_000, enabled });
}

async function remove<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't save (${res.status})`), { status: res.status });
  return out as T;
}

export const solo = {
  join: (seasonId: string) => post<{ leagueId: string; start: number }>(`/api/seasons/${seasonId}/pool`, { action: "join" }),
  leave: (seasonId: string) => post<{ left: true }>(`/api/seasons/${seasonId}/pool`, { action: "leave" }),
  /** Who goes home? for the open episode; null takes it back. */
  call: (seasonId: string, castawayId: string | null) => post<{ call: string | null }>(`/api/seasons/${seasonId}/pool`, { action: "call", castawayId }),
  startPractice: (seasonId: string, game: PracticeGame, level: BotLevel) => post<{ leagueId: string }>(`/api/seasons/${seasonId}/practice`, { game, level }),
  endPractice: (seasonId: string) => remove<{ ended: true }>(`/api/seasons/${seasonId}/practice`),
};

/** After joining or leaving a pool, a call, or starting or ending a practice couch: everything moves on (the moves, the games). */
export const useAfterSolo = useAfterReveal;

// ---- Make it a game (step 10 part 2a; make-game.ts): a show that isn't a game yet, set up from ChatGPT's answers. Read
// when the page opens; while our bot asks, only a version is polled (every 3 s), and the page reads it whole when it moves. ----

/** Make it a game for this season: who's at it, what's been found, the review. */
export function useMake(seasonId: string, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "make", seasonId, couchId],
    queryFn: () => get<MakeState>(seasonUrl(seasonId, "/make", couchId ? { couch: couchId } : {})),
    enabled,
    staleTime: 0,
  });
}

/** While our bot asks: the version (one small row), every 3 s, so the page knows when to read it again. */
export function useMakePoll(seasonId: string, on: boolean) {
  return useQuery({
    queryKey: ["new-design", "make-poll", seasonId],
    queryFn: () => get<{ v: string; asking: boolean; stage: string | null }>(seasonUrl(seasonId, "/make", { poll: "1" })),
    enabled: on,
    refetchInterval: on ? 3000 : false,
    staleTime: 0,
  });
}

const makeUrl = (seasonId: string, couchId: string | null) => seasonUrl(seasonId, "/make", couchId ? { couch: couchId } : {});

export const make = {
  /** Ask ChatGPT for me (`again`: ask how it works, or who's in it, over); continue: the cast, when the first ask ran out of time. */
  ask: (seasonId: string, couchId: string | null, again?: "rules" | "cast") => post<MakeState>(makeUrl(seasonId, couchId), { action: "ask", again }),
  carryOn: (seasonId: string, couchId: string | null) => post<MakeState>(makeUrl(seasonId, couchId), { action: "continue" }),
  paste: (seasonId: string, couchId: string | null, part: "rules" | "cast", answer: string) => post<MakeState>(makeUrl(seasonId, couchId), { action: "paste", part, answer }),
  kind: (seasonId: string, couchId: string | null, kind: string, start: string | null) => post<MakeState>(makeUrl(seasonId, couchId), { action: "kind", kind, start }),
  restart: (seasonId: string, couchId: string | null, part: "all" | "cast") => post<MakeState>(makeUrl(seasonId, couchId), { action: "restart", part }),
  confirm: (seasonId: string, couchId: string | null) => post<MakeState>(makeUrl(seasonId, couchId), { action: "confirm" }),
  /** The desk's: start from a library rulebook (step 10 part 3). */
  template: (seasonId: string, couchId: string | null, template: string) => post<MakeState>(makeUrl(seasonId, couchId), { action: "template", template }),
  /** A question to copy into your own chat. */
  prompt: (seasonId: string, part: "rules" | "cast") => get<{ prompt: string; task: string }>(seasonUrl(seasonId, "/make", { prompt: part })),
};

// ---- Start a game that fits (step 10 part 2b; start-game.ts) and archive or delete one (end-game.ts). Read when the sheet
// or Game settings opens; nothing polls. ----

/** What can start on a season for a couch: the season games and whether each fits, why the rest don't, Run it back's game. */
export function useStartOptions(seasonId: string | null, couchId: string | null, again: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "start", seasonId, couchId, again],
    queryFn: () => get<StartOptions>(seasonUrl(seasonId!, "/start", { couch: couchId!, ...(again ? { again } : {}) })),
    enabled: enabled && !!seasonId && !!couchId,
    staleTime: 0,
  });
}

/** The games here a Commissioner can archive or delete (archived ones too). */
export function useEndGames(seasonId: string, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "end-games", seasonId, couchId],
    queryFn: () => get<{ games: EndGame[] }>(seasonUrl(seasonId, "/backstage/end", { couch: couchId! })),
    enabled: enabled && !!couchId,
  });
}

export const gamesApi = {
  /** `to`: the last episode it plays (a span, step 6 of docs/PLAN-sports-data.md); null to the season's end. */
  start: (seasonId: string, couchId: string, body: { game: string; tell: boolean; again?: string | null; to?: number | null }) =>
    post<Started>(seasonUrl(seasonId, "/start", { couch: couchId }), body),
  archive: (seasonId: string, couchId: string, leagueId: string) => post<{ batch: string }>(seasonUrl(seasonId, "/backstage/end", { couch: couchId }), { action: "archive", leagueId }),
  unarchive: (seasonId: string, couchId: string, leagueId: string) => post<{ batch: string }>(seasonUrl(seasonId, "/backstage/end", { couch: couchId }), { action: "unarchive", leagueId }),
  deletePreview: (seasonId: string, couchId: string, leagueId: string) =>
    post<DeletePreview>(seasonUrl(seasonId, "/backstage/end", { couch: couchId }), { action: "delete", leagueId, preview: true }),
  delete: (seasonId: string, couchId: string, leagueId: string) => post<{ batch: string }>(seasonUrl(seasonId, "/backstage/end", { couch: couchId }), { action: "delete", leagueId }),
};

// ---- planned nights (step 11 part 3; watch-plans.ts): a couch's watch alongs planned ahead. The plans come with the home
// read; the plan sheet reads what can be planned when it opens. Nothing polls. ----

/** What can be planned on a season for a couch: the episodes, who's on the couch, its plans there. */
export function usePlanOptions(seasonId: string | null, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "plans", seasonId, couchId],
    queryFn: () => get<PlanOptions>(seasonUrl(seasonId!, "/plans", { couch: couchId! })),
    enabled: enabled && !!seasonId && !!couchId,
    staleTime: 30_000,
  });
}

export const plansApi = {
  plan: (seasonId: string, couchId: string, body: { episode: number; how: PlanHow; startsAt?: string; invite: string[] }) =>
    post<PlanAnswerOut & { told: number }>(seasonUrl(seasonId, "/plans", { couch: couchId }), body),
  answer: (planId: string, answer: "in" | "out") => post<PlanAnswerOut>(`/api/plans/${planId}`, { answer }),
  cancel: (planId: string, cancel: boolean) => post<PlanAnswerOut>(`/api/plans/${planId}`, { cancel }),
};

/** After a plan, an answer or calling one off: the home's plans put in place (no second read of the home), and the plan sheet's
 *  read and the hub's feed read again. */
export function useSetPlans() {
  const client = useQueryClient();
  return useCallback(
    (plans: WatchPlan[]) => {
      client.setQueryData<Home>(HOME_KEY, (h) => (h ? { ...h, plans } : h));
      void client.invalidateQueries({ queryKey: ["new-design", "plans"] });
      void client.invalidateQueries({ queryKey: ["new-design", "couch-hub"] });
    },
    [client]
  );
}

// ---- Rate it (step 12 part 1; ratings.ts): one to five stars and a take for an episode you've seen, and the couch verdict.
// Each episode's verdict comes with the Episodes read; the rate sheet reads its episode when it opens, Couch verdicts its
// page when that opens. Nothing polls. ----

/** One episode's verdict, for the rate sheet (GET .../ratings/[n]). */
export function useEpisodeVerdict(seasonId: string | null, couchId: string | null, episode: number | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "verdict", seasonId, couchId, episode],
    queryFn: () => get<EpisodeVerdict>(seasonUrl(seasonId!, `/ratings/${episode}`, couchId ? { couch: couchId } : {})),
    enabled: enabled && !!seasonId && !!episode,
    staleTime: 30_000,
  });
}

/** Couch verdicts: the latest episode you've seen of each show you've started, and how the couch rated it. */
export function useCouchVerdicts(couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "verdicts", couchId],
    queryFn: () => get<{ shows: ShowVerdict[] }>(`/api/couches/${couchId}/verdicts`),
    enabled: enabled && !!couchId,
    staleTime: 30_000,
  });
}

export const ratingsApi = {
  rate: (seasonId: string, couchId: string | null, episode: number, body: { stars: number; take?: string }) =>
    post<EpisodeVerdict>(seasonUrl(seasonId, `/ratings/${episode}`, couchId ? { couch: couchId } : {}), body),
};

/** After a rating: the sheet's answer put in place, and what shows it read again (the episodes' verdicts, the hub's taste,
 *  Couch verdicts). */
export function useAfterRating() {
  const client = useQueryClient();
  return useCallback(
    (v: EpisodeVerdict, couchId: string | null) => {
      client.setQueryData(["new-design", "verdict", v.seasonId, couchId, v.episode], v);
      void client.invalidateQueries({ queryKey: ["new-design", "episodes", v.seasonId] });
      void client.invalidateQueries({ queryKey: ["new-design", "couch-hub"] });
      void client.invalidateQueries({ queryKey: ["new-design", "verdicts"] });
    },
    [client]
  );
}

// ---- Call it and the couch's polls (step 12 part 2; calls.ts, polls.ts). The call sheet reads its episode when it opens (and
// Tonight's row the next one's, for how many you've called); a show's polls with its Games tab and Tonight; Commercial break's
// This week only when it opens. Nothing polls. ----

const couchQuery = (couchId: string | null): Record<string, string> => (couchId ? { couch: couchId } : {});

/** One episode's calls: the questions, yours, how many have called it; after it's aired and you've seen it, how they did. */
export function useEpisodeCalls(seasonId: string | null, couchId: string | null, episode: number | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "calls", seasonId, couchId, episode],
    queryFn: () => get<EpisodeCalls>(seasonUrl(seasonId!, `/calls/${episode}`, couchQuery(couchId))),
    enabled: enabled && !!seasonId && !!episode,
    staleTime: 30_000,
    retry: (n, e) => n < 2 && ![403, 404, 409].includes((e as { status?: number }).status ?? 0),
  });
}

export const callsApi = {
  call: (seasonId: string, couchId: string | null, episode: number, calls: Record<string, string | null>) =>
    post<EpisodeCalls>(seasonUrl(seasonId, `/calls/${episode}`, couchQuery(couchId)), { calls }),
  say: (seasonId: string, couchId: string | null, episode: number, said: Record<string, "yes" | "no" | null>) =>
    post<EpisodeCalls>(seasonUrl(seasonId, `/calls/${episode}`, couchQuery(couchId)), { said }),
};

/** After calls or a say: the sheet's answer put in place, and what counts them read again (the games, the home's moves, the
 *  pool, Commercial break). */
export function useAfterCalls() {
  const client = useQueryClient();
  return useCallback(
    (c: EpisodeCalls, couchId: string | null) => {
      client.setQueryData(["new-design", "calls", c.seasonId, couchId, c.episode], c);
      void client.invalidateQueries({ queryKey: ["new-design", "games", c.seasonId] });
      void client.invalidateQueries({ queryKey: ["new-design", "pool", c.seasonId] });
      void client.invalidateQueries({ queryKey: ["new-design", "this-week"] });
      void client.invalidateQueries({ queryKey: ["new-design", "episodes", c.seasonId] });
      void client.invalidateQueries({ queryKey: HOME_KEY });
    },
    [client]
  );
}

/** The couch's polls on a season you may see, and whether you can start one. */
export function useSeasonPolls(seasonId: string | null, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "polls", seasonId, couchId],
    queryFn: () => get<SeasonPolls>(seasonUrl(seasonId!, "/polls", { couch: couchId! })),
    enabled: enabled && !!seasonId && !!couchId,
    staleTime: 30_000,
  });
}

/** Commercial break's This week only: your shows with an episode coming up (and your calls on each), the couch's polls. */
export function useCouchThisWeek(couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "this-week", couchId],
    queryFn: () => get<{ shows: ThisWeekShow[]; polls: Poll[] }>(`/api/couches/${couchId}/this-week`),
    enabled: enabled && !!couchId,
    staleTime: 30_000,
  });
}

export const pollsApi = {
  start: (seasonId: string, couchId: string, body: { question: string; cast: true } | { question: string; options: string[] }) =>
    post<SeasonPolls & { id: string }>(seasonUrl(seasonId, "/polls", { couch: couchId }), body),
  vote: (pollId: string, vote: string | null) => post<SeasonPolls>(`/api/polls/${pollId}`, { vote }),
  remove: (pollId: string) => post<SeasonPolls>(`/api/polls/${pollId}`, { remove: true }),
};

/** After a poll's started, voted in or taken down: the season's polls put in place, Commercial break's read again. */
export function useAfterPoll() {
  const client = useQueryClient();
  return useCallback(
    (seasonId: string, couchId: string, polls: SeasonPolls) => {
      client.setQueryData(["new-design", "polls", seasonId, couchId], polls);
      void client.invalidateQueries({ queryKey: ["new-design", "this-week"] });
    },
    [client]
  );
}

// ---- bingo and trivia (step 12 part 3; bingo.ts, trivia.ts). A card is read when its sheet or row opens, and answered by each
// tick; trivia when its sheet, row or Commercial break opens. Nothing polls. ----

/** One episode's bingo card: yours, what you've ticked; once you've seen it, how the squares went and the couch's cards. */
/** An episode's bingo card: yours, or with `of`, someone else's on the couch (step 3's "Look at their card", under your own key). */
export function useEpisodeBingo(seasonId: string | null, couchId: string | null, episode: number | null, enabled = true, of: string | null = null) {
  return useQuery({
    queryKey: of ? ["new-design", "bingo", seasonId, couchId, episode, of] : ["new-design", "bingo", seasonId, couchId, episode],
    queryFn: () => get<EpisodeBingo>(seasonUrl(seasonId!, `/bingo/${episode}`, { ...couchQuery(couchId), ...(of ? { of } : {}) })),
    enabled: enabled && !!seasonId && !!episode,
    staleTime: 30_000,
    retry: (n, e) => n < 2 && ![403, 404, 409].includes((e as { status?: number }).status ?? 0),
  });
}

export const bingoApi = {
  tick: (seasonId: string, couchId: string | null, episode: number, square: number, ticked: boolean) =>
    post<EpisodeBingo>(seasonUrl(seasonId, `/bingo/${episode}`, couchQuery(couchId)), { square, ticked }),
  /** A new card, until your first tick (at most two): the bingo bank's rerolls. */
  reroll: (seasonId: string, couchId: string | null, episode: number) => post<EpisodeBingo>(seasonUrl(seasonId, `/bingo/${episode}`, couchQuery(couchId)), { reroll: true }),
  /** Call BINGO on a line you've ticked all of (only a called line counts; the couch hears of it). */
  call: (seasonId: string, couchId: string | null, episode: number, line: number) => post<EpisodeBingo>(seasonUrl(seasonId, `/bingo/${episode}`, couchQuery(couchId)), { call: line }),
  /** "This square's unfair": flag a square on your card (on: false takes it back). */
  flag: (seasonId: string, couchId: string | null, episode: number, square: string, on: boolean) =>
    post<EpisodeBingo>(seasonUrl(seasonId, `/bingo/${episode}`, couchQuery(couchId)), { flag: square, on }),
  /** "Did it happen?": a say on squares in the couch's called lines, once you've seen it. */
  say: (seasonId: string, couchId: string | null, episode: number, said: Record<string, "yes" | "no" | null>) =>
    post<EpisodeBingo>(seasonUrl(seasonId, `/bingo/${episode}`, couchQuery(couchId)), { said }),
};

/** Someone watching together with you ticked a square (step 13 part 3): your card for that episode, read again. */
export function useRefreshBingo() {
  const client = useQueryClient();
  return useCallback(
    (seasonId: string, couchId: string | null, episode: number) => void client.invalidateQueries({ queryKey: ["new-design", "bingo", seasonId, couchId, episode] }),
    [client]
  );
}

/** After a tick: the card put in place, and what counts it read again (the games' tables, Commercial break; on a talk show a tick
 *  is a say, so the calls too). */
export function useAfterBingo() {
  const client = useQueryClient();
  return useCallback(
    (b: EpisodeBingo, couchId: string | null) => {
      client.setQueryData(["new-design", "bingo", b.seasonId, couchId, b.episode], b);
      void client.invalidateQueries({ queryKey: ["new-design", "games", b.seasonId] });
      void client.invalidateQueries({ queryKey: ["new-design", "this-week"] });
      if (b.by === "couch") void client.invalidateQueries({ queryKey: ["new-design", "calls", b.seasonId] });
    },
    [client]
  );
}

/** This week's trivia round on a season's show: its questions, your score once you've played, the couch's scores. */
export function useTrivia(seasonId: string | null, couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "trivia", seasonId, couchId],
    queryFn: () => get<TriviaRound>(seasonUrl(seasonId!, "/trivia", couchQuery(couchId))),
    enabled: enabled && !!seasonId,
    staleTime: 60_000,
  });
}

/** The trivia rounds on your shows this week (Commercial break, the solo hub). */
export function useMyTrivia(couchId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["new-design", "my-trivia", couchId],
    queryFn: () => get<{ rounds: TriviaCard[] }>(`/api/me/trivia${couchId ? `?couch=${couchId}` : ""}`),
    enabled,
    staleTime: 60_000,
  });
}

export const triviaApi = {
  play: (seasonId: string, couchId: string | null, answers: Record<string, string>) => post<TriviaRound>(seasonUrl(seasonId, "/trivia", couchQuery(couchId)), { answers }),
  /** An earlier season of the show seen to the end (Seen it all): answers the round again, which can now ask about it. */
  seenAll: (seasonId: string, couchId: string | null, seen: string) => post<TriviaRound>(seasonUrl(seasonId, "/trivia", couchQuery(couchId)), { seen }),
  /** "This question's wrong": a researched question, gone from your rounds (and everyone's at two flags). */
  flag: (seasonId: string, question: string) => post<{ ok: true }>(seasonUrl(seasonId, "/trivia", {}), { flag: question }),
};

/** After a round's played: the round put in place, the lists that show its score read again. */
export function useAfterTrivia() {
  const client = useQueryClient();
  return useCallback(
    (seasonId: string, couchId: string | null, round: TriviaRound) => {
      client.setQueryData(["new-design", "trivia", seasonId, couchId], round);
      void client.invalidateQueries({ queryKey: ["new-design", "my-trivia"] });
    },
    [client]
  );
}

// ---- Watch along (step 13 part 1; watch-along.ts). Tonight's card reads when the show opens; the watch along reads the reactions
// between two moments when it opens or its clock jumps, and polls the ones since while its clock runs (watch-along.tsx). Who's on
// now (part 2) rides on those reads; the clock is written when it starts, pauses or moves; the hub's On now reads once. Watching
// together (part 3): a planned night's session, one clock for everyone in it, its version asked every few seconds while it's open
// (with the reactions while it runs). ----

/** Tonight's Watch along card: the episode you'd watch along, and who on the couch left reactions on it (a count). */
export function useWatchCard(seasonId: string | null, couchId: string | null, enabled = true, fresh = false) {
  return useQuery({
    queryKey: ["new-design", "watch-card", seasonId, couchId],
    queryFn: () => get<WatchCard>(seasonUrl(seasonId!, "/watch", couchQuery(couchId))),
    enabled: enabled && !!seasonId,
    staleTime: 60_000,
    // The watch along's start reads it again as it opens: who's on now has moved since the show opened.
    ...(fresh ? { refetchOnMount: "always" as const } : {}),
  });
}

/** The hub's On now (step 13 part 2): who else on the couch is watching along right now. Read when the hub opens, never polled. */
export function useOnNow(couchId: string | null) {
  return useQuery({
    queryKey: ["new-design", "on-now", couchId],
    queryFn: () => get<{ now: OnNow[] }>(`/api/couches/${couchId}/now`),
    enabled: !!couchId,
    staleTime: 30_000,
  });
}

export const watchApi = {
  /** The reactions on an episode after `since` (ms; -1 from the start) through your clock's `at`; `open` adds pins and the count. */
  read: (seasonId: string, couchId: string | null, episode: number, at: number, since: number, open = false, beat = false, together: { id: string; version: number | null } | null = null) =>
    get<WatchRead>(
      seasonUrl(seasonId, `/watch/${episode}`, {
        ...couchQuery(couchId),
        at: String(Math.floor(at)),
        since: String(Math.floor(since)),
        ...(open ? { open: "1" } : {}),
        ...(beat ? { beat: "1" } : {}),
        ...(together ? { together: together.id, ...(together.version != null ? { sv: String(together.version) } : {}) } : {}),
      })
    ),
  /** Your watch along's clock for the couch (who's on now): when it starts, pauses or moves; a paused one's beat; closing it. */
  session: (seasonId: string, couchId: string | null, episode: number, body: { at: number; mode: WatchMode; running: boolean; ad: boolean } | { beat: true } | { at: number; leave: true }) =>
    post<SessionWrite>(seasonUrl(seasonId, `/watch/${episode}/session`, couchQuery(couchId)), "at" in body ? { ...body, at: Math.floor(body.at) } : body),
  /** Closing (or the page going away): sent even as the page unloads. */
  leave: (seasonId: string, couchId: string | null, episode: number, at: number) => {
    void fetch(seasonUrl(seasonId, `/watch/${episode}/session`, couchQuery(couchId)), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: Math.floor(at), leave: true }),
      keepalive: true,
    }).catch(() => {});
  },
  say: (seasonId: string, couchId: string | null, episode: number, body: { at: number; kind: string; text?: string; gif?: Gif }) =>
    post<{ reaction: Reaction }>(seasonUrl(seasonId, `/watch/${episode}`, couchQuery(couchId)), { ...body, at: Math.floor(body.at) }),
  unsay: async (seasonId: string, episode: number, id: string) => {
    const res = await fetch(`/api/seasons/${seasonId}/watch/${episode}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't take it back (${res.status})`), { status: res.status });
  },
  gifs: (q: string) => get<{ gifs: GifHit[] }>(`/api/gifs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
};

/** Watching together (step 13 part 3): a planned night's session, on its couch. */
export const togetherApi = {
  /** Its version alone while `v` is still it, else the session (null before anyone's opened it); `beat`: still here. */
  read: (seasonId: string, couchId: string, episode: number, planId: string, v: number | null, beat = false) =>
    get<TogetherAnswer>(seasonUrl(seasonId, `/watch/${episode}/together`, { couch: couchId, plan: planId, ...(v != null ? { v: String(v) } : {}), ...(beat ? { beat: "1" } : {}) })),
  join: (seasonId: string, couchId: string, episode: number, planId: string) =>
    post<TogetherAnswer>(seasonUrl(seasonId, `/watch/${episode}/together`, { couch: couchId }), { plan: planId, join: true }),
  /** Start ("3, 2, 1"), pause, resume, an ad break and back, or move it, for everyone in it. */
  move: (seasonId: string, couchId: string, episode: number, id: string, body: { change: TogetherChange; at: number; mode: WatchMode; running: boolean; ad: boolean }) =>
    post<TogetherAnswer>(seasonUrl(seasonId, `/watch/${episode}/together`, { couch: couchId }), { id, ...body, at: Math.floor(body.at) }),
  beat: (seasonId: string, couchId: string, episode: number, id: string) => post<TogetherAnswer>(seasonUrl(seasonId, `/watch/${episode}/together`, { couch: couchId }), { id, beat: true }),
  /** Closing (or the page going away): sent even as the page unloads. */
  leave: (seasonId: string, couchId: string, episode: number, id: string) => {
    void fetch(seasonUrl(seasonId, `/watch/${episode}/together`, { couch: couchId }), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, leave: true }),
      keepalive: true,
    }).catch(() => {});
  },
};
