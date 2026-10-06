import type { PoolClient } from "pg";
import type { FormatData } from "@/lib/game/formats/index";
import type { LeagueRuleset } from "@/lib/game/types";
import { withLeagueLock } from "@/lib/server/db";
import * as LR from "@db/league-rulesets.js";

export type ForkSource =
  | { from: "builtin" | "show_format" | "league_ruleset"; sourceId: string; name?: string }
  | { from: "scratch"; name?: string; data: FormatData };

export type ForkResult = { created: LeagueRuleset } | { refused: string[] };
export type EditResult = { updated: LeagueRuleset } | { refused: string[] } | { notFound: true };

/**
 * Forks a new league ruleset from a built-in, an approved show_format, another league's shared
 * ruleset, or from scratch, and points the league at it. Each write happens under the league's own
 * lock, with leagues.ruleset_id (a real column, outside `state`) updated via the lock's own
 * transaction client -- withLeagueLock's final UPDATE only ever touches `state` itself.
 */
export async function forkLeagueRuleset(leagueId: string, source: ForkSource, userId: string | null): Promise<ForkResult> {
  let result!: ForkResult;
  await withLeagueLock(leagueId, async (s, client: PoolClient) => {
    let data: FormatData;
    let parentKind: "builtin" | "show_format" | "league_ruleset" | "none";
    let parentId: string | null;
    let parentVersion: number | null;
    let defaultName: string | undefined;
    if (source.from === "scratch") {
      data = source.data;
      parentKind = "none";
      parentId = null;
      parentVersion = null;
    } else {
      let sourced;
      try {
        sourced = await LR.sourceDataFor(client, { kind: source.from, id: source.sourceId });
      } catch (e) {
        result = { refused: [(e as Error).message] };
        return;
      }
      data = sourced.data;
      defaultName = sourced.defaultName;
      parentVersion = sourced.parentVersion;
      parentKind = source.from;
      parentId = source.sourceId;
    }
    // Never alias the source object -- a built-in's data is the same live object formatFor returns
    // everywhere else, and show_format/league_ruleset data came straight off a shared row.
    data = JSON.parse(JSON.stringify(data));
    const problems = LR.rulesetProblems(data);
    if (problems.length) {
      result = { refused: problems };
      return;
    }
    const created = await LR.insertRuleset(client, {
      leagueId,
      name: source.name?.trim() || defaultName || data.name,
      data,
      parentKind,
      parentId,
      parentVersion,
      userId,
    });
    await client.query("UPDATE leagues SET ruleset_id=$1 WHERE id=$2", [created.id, leagueId]);
    LR.setLeagueRuleset(s.settings, data);
    result = { created };
  });
  return result;
}

/** Edits a league's own ruleset copy. 404-equivalent if it doesn't have one yet -- fork and edit are
 *  separate actions, so an edit never implicitly creates a copy. */
export async function editLeagueRuleset(leagueId: string, data: FormatData): Promise<EditResult> {
  let result!: EditResult;
  await withLeagueLock(leagueId, async (s, client: PoolClient) => {
    const current = await LR.getLeagueRuleset(client, leagueId);
    if (!current) {
      result = { notFound: true };
      return;
    }
    const problems = LR.rulesetProblems(data);
    if (problems.length) {
      result = { refused: problems };
      return;
    }
    const updated = await LR.updateRulesetData(client, current.id, data, data.name || current.name);
    LR.setLeagueRuleset(s.settings, data);
    result = { updated: updated! };
  });
  return result;
}

/**
 * Abandons a league's own ruleset copy: clears the pointer immediately (the league's show-format
 * cache was never touched, so formatOf falls straight back to it, already current -- no re-fetch
 * needed), then hard-deletes the row only if nothing else still forks from it.
 */
export async function abandonLeagueRuleset(leagueId: string): Promise<{ abandoned: boolean; deleted: boolean }> {
  let outcome!: { abandoned: boolean; deleted: boolean };
  await withLeagueLock(leagueId, async (s, client: PoolClient) => {
    const current = await LR.getLeagueRuleset(client, leagueId);
    if (!current) {
      outcome = { abandoned: false, deleted: false };
      return;
    }
    await client.query("UPDATE leagues SET ruleset_id=NULL WHERE id=$1", [leagueId]);
    LR.setLeagueRuleset(s.settings, null);
    outcome = { abandoned: true, deleted: await LR.deleteIfUnreferenced(client, current.id) };
  });
  return outcome;
}
