import { formatDataFor, setLeagueFormat } from "@db/show-formats.js";
import { pool, withLeagueLock } from "@/lib/server/db";

/**
 * Re-caches show `slug`'s format in every league on it (settings.showFormat, plus showFormatData for a
 * stored format), so the game logic -- which can't read the database -- plays by the show's current
 * rules. Each league is updated under its own lock rather than in one UPDATE, so a league write in
 * flight can't overwrite the change with the state it read before it. Returns how many were updated.
 */
export async function pushShowFormat(slug: string): Promise<number> {
  const { rows: show } = await pool.query("SELECT format FROM shows WHERE slug=$1", [slug]);
  const id: string | null = show.length ? show[0].format : null;
  const data = await formatDataFor(pool, id);
  const { rows: leagues } = await pool.query("SELECT id FROM leagues WHERE state->'settings'->>'showId' = $1", [slug]);
  for (const league of leagues) {
    await withLeagueLock(league.id, (s) => {
      setLeagueFormat(s.settings, id, data);
    });
  }
  return leagues.length;
}
