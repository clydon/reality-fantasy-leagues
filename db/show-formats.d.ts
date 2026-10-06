// Types for db/show-formats.js (plain CommonJS so the bare-node connectors can use it).
import type { Pool, PoolClient } from "pg";
import type { FormatData, GameFormat } from "@/lib/game/formats/index";
import type { FormatOption, Proposal, ReviewNote, StoredFormat, StoredFormatSummary } from "@/lib/game/types";

/** A pool, or a client inside a transaction (withLeagueLock hands one in). */
type Db = Pool | PoolClient;
/** The part of a league's settings that caches its format. */
type FormatSettings = { showFormat?: string | null; showFormatData?: FormatData | null };

export function formatDataFor(db: Db, id: string | null | undefined): Promise<FormatData | null>;
export function resolveFormat(db: Db, id: string | null | undefined): Promise<GameFormat>;
export function isPlayableFormat(db: Db, id: unknown): Promise<boolean>;
export function formatOptions(db: Db): Promise<FormatOption[]>;
export function setLeagueFormat(settings: FormatSettings, id: string | null, data: FormatData | null): void;
export function syncLeagueFormat(db: Db, settings: FormatSettings, slug: string | null | undefined): Promise<void>;
export function listFormats(db: Db): Promise<StoredFormatSummary[]>;
export function getFormat(db: Db, id: string): Promise<StoredFormat | null>;
export function createDraft(db: Db, answer: string, userId?: string | null): Promise<StoredFormat>;
export function saveProposal(db: Db, id: string, proposal: Proposal, userId?: string | null): Promise<(StoredFormat & { refused?: ReviewNote[]; leagueSlugs?: string[] }) | null>;
export function approveFormat(db: Db, id: string, userId?: string | null): Promise<(StoredFormat & { refused?: ReviewNote[]; alreadyApproved?: boolean }) | null>;
export function deleteFormat(db: Db, id: string): Promise<{ notFound?: true; inUse?: string[]; deleted?: true }>;
export function showSlugsUsing(db: Db, id: string): Promise<string[]>;
