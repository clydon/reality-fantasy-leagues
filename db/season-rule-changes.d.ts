// Types for db/season-rule-changes.js (plain CommonJS so the bare-node connectors can use it).
import type { Pool, PoolClient } from "pg";
import type { GameFormat, SeasonChange } from "@/lib/game/formats/index";
import type { SeasonCheck, SeasonCheckReview } from "@/lib/game/formats/season-check";
import type { ReviewNote } from "@/lib/game/formats/proposal";

/** A pool, or a client inside a transaction (withLeagueLock hands one in). */
type Db = Pool | PoolClient;

export type SeasonRuleChangeStatus = "draft" | "approved" | "no_change" | "withdrawn";

export interface SeasonRuleChange {
  id: string;
  seasonId: string;
  status: SeasonRuleChangeStatus;
  effectiveEpisode: number | null;
  checkedThrough: number | null;
  summary: string | null;
  proposal: SeasonCheck;
  delta: SeasonChange["delta"] | null;
  baseFormat: string | null;
  baseVersion: number | null;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export type SeasonRuleChangeWithReview = SeasonRuleChange & { review: SeasonCheckReview };

/** The part of a league's settings these read and write. */
type ChangeSettings = { showId?: string | null; wikiSeason?: string | number | null; seasonRuleChanges?: SeasonChange[]; adoptedRuleChanges?: SeasonChange[] };

export function approvedChanges(db: Db, seasonId: string | null, opts?: { throughEpisode?: number | null; excludeId?: string | null }): Promise<SeasonChange[]>;
export function seasonInfo(db: Db, seasonId: string): Promise<{
  id: string; season_number: number; season_name: string | null; wiki_url: string | null; slug: string; show_name: string; format: string | null;
} | null>;
export function seasonIdFor(db: Db, showSlug: string | null | undefined, seasonNumber: string | number | null | undefined): Promise<string | null>;
export function seasonFormat(db: Db, seasonId: string, opts?: { formatId?: string | null; episode?: number | null; excludeId?: string | null }): Promise<GameFormat>;
export function checkPrompt(db: Db, seasonId: string): Promise<string | null>;
export function airedThrough(db: Db, seasonId: string): Promise<number | null>;
export function researchFlags(db: Db, seasonId: string): Promise<{ episode: number; note: string }[]>;
export function listChanges(db: Db, seasonId: string): Promise<SeasonRuleChange[]>;
export function getChange(db: Db, id: string): Promise<SeasonRuleChangeWithReview | null>;
export function recordCheck(db: Db, seasonId: string, answer: string, userId?: string | null): Promise<SeasonRuleChangeWithReview | null>;
export function saveChange(
  db: Db, id: string, proposal: SeasonCheck, opts?: { effectiveEpisode?: number | null }, userId?: string | null
): Promise<(Partial<SeasonRuleChangeWithReview> & { refused?: ReviewNote[]; refusedStatus?: SeasonRuleChangeStatus; pushSeason?: string | null }) | null>;
export function approveChange(
  db: Db, id: string, userId?: string | null
): Promise<(SeasonRuleChangeWithReview & { refused?: ReviewNote[]; refusedStatus?: SeasonRuleChangeStatus; alreadyApproved?: boolean; pushSeason?: string | null }) | null>;
export function withdrawChange(db: Db, id: string): Promise<{ withdrawn: boolean; pushSeason?: string }>;
export function deleteChange(db: Db, id: string): Promise<{ notFound?: true; refusedStatus?: SeasonRuleChangeStatus; deleted?: true }>;
export function syncLeagueChanges(db: Db, settings: ChangeSettings, opts?: { adoptAll?: boolean }): Promise<{ seasonId: string | null; offered: number }>;
