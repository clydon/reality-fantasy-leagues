import { seasonInfo, syncLeagueChanges } from "@db/season-rule-changes.js";
import { pool, withLeagueLock } from "@/lib/server/db";

/**
 * Re-caches season `seasonId`'s approved rule changes in every league on it (settings.seasonRuleChanges:
 * what each commissioner is offered). What a league ADOPTED is never touched here -- approving,
 * editing or withdrawing a change never rescores a league behind its commissioner's back
 * (docs/PLAN-season-rule-changes.md). Each league is updated under its own lock, like pushShowFormat.
 * Returns how many leagues were updated.
 */
export async function pushSeasonRuleChanges(seasonId: string): Promise<number> {
  const info = await seasonInfo(pool, seasonId);
  if (!info) return 0;
  const { rows: leagues } = await pool.query(
    "SELECT id FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2",
    [info.slug, String(info.season_number)]
  );
  for (const league of leagues) {
    await withLeagueLock(league.id, async (s, client) => {
      await syncLeagueChanges(client, s.settings);
    });
  }
  return leagues.length;
}
