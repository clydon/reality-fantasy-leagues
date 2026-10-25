// Types for db/rulebooks.js (plain CommonJS so the bare-node scripts can use it).
import type { Pool, PoolClient } from "pg";
import type { FormatData, GameFormat } from "@/lib/game/formats/index";
import type { BlocksProblem, RulebookAliases, RulebookBlocks, RulebookKind } from "@/lib/game/formats/rulebook-schema";
import type { LeagueRulebook } from "@/lib/game/types";

/** A pool, or a client inside a transaction (withLeagueLock hands one in). */
type Db = Pool | PoolClient;
/** The part of a league's settings its rules are cached in. */
type RuleSettings = {
  showId?: string | null;
  wikiSeason?: number | string | null;
  showFormat?: string | null;
  showFormatData?: FormatData | null;
  leagueRulesetData?: FormatData | null;
  rulebook?: LeagueRulebook;
};

export type RulebookReader = "survivor" | "traitors" | "challenge" | "research" | "league";

export interface Rulebook {
  id: string;
  name: string;
  kind: RulebookKind;
  ownerKind: "library" | "season" | "league";
  seasonId: string | null;
  leagueId: string | null;
  isTemplate: boolean;
  status: "draft" | "in_force" | "archived";
  parentKind: "none" | "rulebook" | "builtin" | "show_format" | "league_ruleset" | "library";
  parentId: string | null;
  parentVersion: number | null;
  reader: RulebookReader;
  blocks: RulebookBlocks;
  compiled: FormatData | null;
  compiledSource: "blocks" | "legacy";
  base: FormatData | null;
  aliases: RulebookAliases;
  phaseStarts: Record<string, number>;
  provenance: { from?: string; id?: string | null; version?: number; editedAt?: string; [k: string]: unknown };
  version: number;
  visibility: "private" | "shared";
  reviewStatus: "unreviewed" | "approved";
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RulebookSummary = Pick<
  Rulebook,
  "id" | "name" | "kind" | "isTemplate" | "status" | "parentKind" | "parentId" | "reader" | "version" | "reviewStatus" | "compiledSource" | "updatedAt"
>;
export type RulebookFields = Partial<Omit<Rulebook, "id" | "version" | "createdAt" | "updatedAt">>;
export type LeagueRef = { id: string; name: string; slug: string };
export type Refused = { refused: BlocksProblem[] };
export type Ensured = { row: Rulebook; change: "created" | "updated" | "unchanged" };
export type RulebookSource = { kind: "builtin" | "show_format"; id: string; data: FormatData; version: number | null; fellBack: boolean };
export type SyncResult = {
  written: boolean;
  removed?: boolean;
  id?: string;
  version?: number;
  source?: "own" | "season";
  reason?: string;
  mismatch?: string;
};

export function rulebooksOn(db: Db): Promise<boolean>;
/** The flag, or the season's own switch (show_seasons.rulebook_live). */
export function seasonLive(db: Db, seasonId: string | null): Promise<boolean>;

export interface RulebookEdit {
  id: string;
  kind: "show_changed" | "fix" | "league";
  fromEpisode: number;
  ops: import("@/lib/game/formats/rulebook-patch").RulebookOp[];
  summary: string | null;
  source: string;
  createdBy: string | null;
  at: string;
}
/** In-force show-changed edits, by the episode they start. */
export function inForceEdits(db: Db, id: string): Promise<RulebookEdit[]>;
export function compileChain(row: Rulebook, blocks: RulebookBlocks, edits: RulebookEdit[], phaseStarts: Record<string, number>): { data: FormatData | null; problems: string[]; warnings: string[] };
/** Saves the base blocks (and phase starts), compiling with every in-force edit; the version moves on. */
export function saveChain(db: Db, id: string, opts?: { blocks?: RulebookBlocks; phaseStarts?: Record<string, number>; userId?: string | null }): Promise<{ rulebook: Rulebook; warnings: string[] } | Refused | null>;
export function setRulebooksOn(db: Db, on: boolean): Promise<void>;
export function sameData(a: unknown, b: unknown): boolean;
export function legacyBase(settings: RuleSettings | null | undefined): { data: FormatData; reader: RulebookReader };
export function readerOf(format: GameFormat): RulebookReader;

export function getRulebook(db: Db, id: string): Promise<Rulebook | null>;
export function listLibrary(db: Db, opts?: { templatesOnly?: boolean }): Promise<RulebookSummary[]>;
export function seasonRulebook(db: Db, seasonId: string): Promise<Rulebook | null>;
export function seasonIdOf(db: Db, settings: RuleSettings | null | undefined): Promise<string | null>;
export function rulebookForLeague(db: Db, opts: { leagueId?: string | null; settings: RuleSettings }): Promise<Rulebook | null>;
export function createRulebook(db: Db, fields: RulebookFields & Pick<Rulebook, "name" | "ownerKind" | "blocks">): Promise<Rulebook>;
export function copyRulebook(
  db: Db,
  fromId: string,
  opts: { ownerKind: Rulebook["ownerKind"]; seasonId?: string | null; leagueId?: string | null; userId?: string | null; name?: string; status?: Rulebook["status"] }
): Promise<Rulebook | null>;
export function saveBlocks(db: Db, id: string, blocks: RulebookBlocks, userId?: string | null): Promise<{ rulebook: Rulebook; warnings: string[] } | Refused | null>;
export function setPhaseStart(db: Db, id: string, phaseId: string, episode: number | null): Promise<{ rulebook: Rulebook } | Refused | null>;
export function leaguesUsing(db: Db, id: string): Promise<{ following: LeagueRef[]; ownCopies: LeagueRef[] } | null>;
export function lineage(
  db: Db,
  id: string
): Promise<{
  parents: { id: string; name: string; ownerKind: Rulebook["ownerKind"]; version: number }[];
  origin: { kind: string; id: string | null } | null;
  seasons: number;
  ownCopies: number;
  following: number;
} | null>;
export function compiledFor(db: Db, id: string): Promise<{ id: string; version: number; data: FormatData; reader: RulebookReader } | null>;
export function seasonRulebookFormat(db: Db, seasonId: string | null, opts?: { formatId?: string | null; on?: boolean }): Promise<GameFormat | null>;

export function sourceFor(db: Db, formatId: string | null | undefined): Promise<RulebookSource>;
export function ensureTemplate(db: Db, source: RulebookSource): Promise<Ensured>;
export function ensureLibraryEntry(db: Db, entry: { id: string; show: string; blocks: RulebookBlocks; compiled: FormatData; researched?: unknown; leftOut?: string[] }): Promise<Ensured>;
export function knownPhaseStarts(db: Db, seasonId: string, blocks: RulebookBlocks): Promise<Record<string, number>>;
export function ensureSeasonRulebook(db: Db, seasonId: string): Promise<(Ensured & { source: RulebookSource }) | null>;
export function ensureLeagueRulebook(
  db: Db,
  leagueId: string,
  settings: RuleSettings,
  opts?: { parent?: Rulebook | null }
): Promise<{ row: Rulebook | null; change: "created" | "updated" | "unchanged" | "archived" }>;
export function syncLeagueRulebook(db: Db, leagueId: string, settings: RuleSettings, opts?: { on?: boolean }): Promise<SyncResult>;
export function syncLeagueRow(pool: Pool, leagueId: string, opts?: { on?: boolean }): Promise<(SyncResult & { saved: boolean }) | null>;
export function refreshShowRulebooks(db: Db, slug: string): Promise<number>;
/** The couch's own copy (Make it ours) this league plays by, or null. */
export function oursOf(db: Db, leagueId: string): Promise<Rulebook | null>;
