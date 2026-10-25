import { formatDataFor, setLeagueFormat } from "@db/show-formats.js";
import { refreshShowRulebooks, rulebooksOn, syncLeagueRulebook } from "@db/rulebooks.js";
import { pool, withLeagueLock } from "@/lib/server/db";

/**
 * Re-caches show `slug`'s format in every league on it (settings.showFormat, plus showFormatData for a
 * stored format), so the game logic -- which can't read the database -- plays by the show's current
 * rules. Each league is updated under its own lock rather than in one UPDATE, so a league write in
 * flight can't overwrite the change with the state it read before it. Returns how many were updated.
 *
 * With the rulebooks flag on, the show's season rulebooks follow the format first, and each league's
 * settings.rulebook with them (db/rulebooks.js), since formatOf reads that ahead of showFormat.
 */
export async function pushShowFormat(slug: string): Promise<number> {
  const { rows: show } = await pool.query("SELECT format FROM shows WHERE slug=$1", [slug]);
  const id: string | null = show.length ? show[0].format : null;
  const data = await formatDataFor(pool, id);
  const on = await rulebooksOn(pool);
  if (on) await refreshShowRulebooks(pool, slug);
  const { rows: leagues } = await pool.query("SELECT id FROM leagues WHERE state->'settings'->>'showId' = $1", [slug]);
  for (const league of leagues) {
    await withLeagueLock(league.id, async (s, client) => {
      setLeagueFormat(s.settings, id, data);
      // With the flag off, the league's own season switch or its couch's own copy still decides (step 6b).
      await syncLeagueRulebook(client, league.id, s.settings, { on: on || undefined });
    });
  }
  return leagues.length;
}
