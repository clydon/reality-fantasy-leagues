// Types for db/league-rulesets.js (plain CommonJS so the bare-node connectors can use it).
import type { Pool, PoolClient } from "pg";
import type { FormatData } from "@/lib/game/formats/index";
import type { LeagueRuleset, SharedLeagueRuleset } from "@/lib/game/types";

/** A pool, or a client inside a transaction (withLeagueLock hands one in). */
type Db = Pool | PoolClient;
/** The part of a league's settings that caches its own ruleset. */
type RulesetSettings = { leagueRulesetData?: FormatData | null };
type ParentKind = "builtin" | "show_format" | "league_ruleset" | "none";

export function rulesetProblems(data: unknown): string[];
export function setLeagueRuleset(settings: RulesetSettings, data: FormatData | null): void;
export function getRuleset(db: Db, id: string): Promise<LeagueRuleset | null>;
export function getLeagueRuleset(db: Db, leagueId: string): Promise<LeagueRuleset | null>;
export function listShared(db: Db, opts?: { excludeLeagueId?: string | null }): Promise<SharedLeagueRuleset[]>;
export function sourceDataFor(
  db: Db,
  source: { kind: ParentKind; id: string }
): Promise<{ data: FormatData; parentVersion: number | null; defaultName: string }>;
export function insertRuleset(
  db: Db,
  opts: {
    leagueId: string;
    name: string;
    data: FormatData;
    parentKind: ParentKind;
    parentId: string | null;
    parentVersion: number | null;
    userId?: string | null;
  }
): Promise<LeagueRuleset>;
export function updateRulesetData(db: Db, id: string, data: FormatData, name: string): Promise<LeagueRuleset | null>;
export function setVisibility(db: Db, id: string, visibility: "private" | "shared"): Promise<LeagueRuleset | null>;
export function deleteIfUnreferenced(db: Db, id: string): Promise<boolean>;
