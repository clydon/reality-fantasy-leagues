"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// The desk's reads and writes (docs/PLAN-new-design.md step 6b part 2): each page reads its /api/desk route when it
// opens (nothing polls), and after a write every desk read moves on.

export type { FoundItem, DeskSettings, DeskLine } from "@/lib/server/desk";
export type { Inbox, InboxItem, ComingUp } from "@/lib/server/desk-inbox";
export type { DeskReport, ReportRow, ReportsList, ReportFilter } from "@/lib/server/desk-reports";
export type { DeskFact, DeskSource } from "@/lib/server/desk-facts";
export type { DeskSeason, DeskCastaway } from "@/lib/server/desk-cast";
export type { CastFace, CastReviewChange, DeskCast } from "@/lib/server/desk-cast-page";
export type { CastChange, CastPicks } from "@/lib/desk-cast-diff";
export type { SeasonBot } from "@/lib/server/desk-bot";
export type { DeskSetup, SeasonDelete, SeasonGame } from "@/lib/server/desk-setup";
export type { DeskResearch, NowEpisode, RailRow, ResearchRun } from "@/lib/server/desk-research";
export type { DeskEpisode, EpisodeAnswer, EpisodeFact, MoveLine, TriviaQuestion } from "@/lib/server/desk-episode";
export type { BankSquare, DeskBingo, DeskBingoBank } from "@/lib/server/desk-bingo";
export type { CountPlan, ListingHitRow, WhenPlan } from "@/lib/server/desk-schedule";
export type { CouchFilter, CouchRow, CouchSort, CouchesList, DeskCouch } from "@/lib/server/desk-couches";
export type { DeskShow, ShowDelete, ShowFilter, ShowRow, ShowSort, ShowsList, ShowWords } from "@/lib/server/desk-shows";
export type { ArtFrameKey, DeskFrame } from "@/lib/server/show-art";
export type { DeskGame, GameFilter, GameOpen, GameRow, GameSort, GamesList } from "@/lib/server/desk-games";
export type { DeskPerson, DeskSeatGame, PeopleList, PersonRow, PeopleFilter, PeopleSort } from "@/lib/server/desk-people";
export type { HandOnCandidate, HandOnGame } from "@/lib/server/desk-seats";
export type { GameSeats, LinkCandidate, SeatEmpty, SeatIn, SeatOut, SeatPerson } from "@/lib/server/desk-seat-moves";
export type { DeskRulebook, DeskRulebookEdit } from "@/lib/server/desk-rulebooks";
export type { DeskLibrary, LibraryTemplateCard, ProposedShape, LibraryRow, MadeRow } from "@/lib/server/desk-library";

const KEY = ["new-design", "desk"] as const;

/** One desk read, outside a hook (a list read a page at a time). */
export const deskGet = <T>(path: string) => call<T>(path);

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/desk${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status });
  return body as T;
}

/** One desk read, e.g. useDesk<Inbox>("/inbox"). */
export function useDesk<T>(path: string | null) {
  return useQuery({
    queryKey: [...KEY, path],
    queryFn: () => call<T>(path!),
    enabled: !!path,
    staleTime: 15_000,
    retry: (n, e) => (e as { status?: number }).status !== 403 && (e as { status?: number }).status !== 404 && n < 2,
  });
}

/** A desk write; the answer is the page as it is now (or what the action says). */
export const deskSend = <T>(path: string, body: unknown, method: "POST" | "PUT" | "DELETE" = "POST") =>
  call<T>(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** After a desk write: every desk read, and anything the new design shows of what changed. */
export function useAfterDesk() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ["new-design"] }), [client]);
}
