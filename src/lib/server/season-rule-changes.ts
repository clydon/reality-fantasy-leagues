import { seasonInfo, syncLeagueChanges } from "@db/season-rule-changes.js";
import { pool, withLeagueLock } from "@/lib/server/db";

/**
 * Re-caches season `seasonId`'s approved rule changes in every league on it (settings.seasonRuleChanges:
 * what each commissioner is offered). What a league ADOPTED is never touched here -- approving,
 * editing or withdrawing a change never rescores a league behind its commissioner's back
 * (docs/PLAN-season-rule-changes.md). Each league is updated under its own lock, like pushShowFormat.
 *
 * By the time this runs the change itself is already saved, so one league failing mustn't fail the
 * request (the admin would see an error for something that worked, and retry it). Failures are
 * reported instead; the sync is idempotent, so the next approve/edit/withdraw on the season -- or the
 * league picking its season again -- brings a league that missed this one up to date.
 */
export async function pushSeasonRuleChanges(seasonId: string): Promise<{ updated: number; failed: { leagueId: string; name: string; error: string }[] }> {
  const failed: { leagueId: string; name: string; error: string }[] = [];
  const info = await seasonInfo(pool, seasonId);
  if (!info) return { updated: 0, failed };
  const { rows: leagues } = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2",
    [info.slug, String(info.season_number)]
  );
  let updated = 0;
  for (const league of leagues) {
    try {
      await withLeagueLock(league.id, async (s, client) => {
        await syncLeagueChanges(client, s.settings);
      });
      updated++;
    } catch (e) {
      console.error(`[rule-changes] couldn't update league ${league.id} (${league.name}):`, e);
      failed.push({ leagueId: league.id, name: league.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { updated, failed };
}
