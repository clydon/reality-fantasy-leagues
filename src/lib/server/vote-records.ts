import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import * as Formats from "@/lib/game/formats/index.js";
import type { LeagueState } from "@/lib/game/types";

// A bounty (docs/PLAN-start-a-game-gpt.md step A14 part 3; game-spec schema.js's score.bounty): who voted for whom in each episode,
// as the season's stored research says it (its combined answer's castaways, each one's vote and the votes against them: the
// format's own rules say which answers those are, formats/votes.js), stamped on the league's episodes as their record
// (`episode.voteRecord`) with the air times (air-times.ts stampAirTimes), so the draft's walk reads it on the server and in the
// browser alike: on every read and every write, so research that lands, or a correction, is read at once. Only on an episode whose
// exits this league has (who voted for whom says who went home: never ahead of the league's own results, and the spoiler view
// takes it off with them), and only for a game with a bounty: one query for such a game, none for any other (a stale stamp is only
// taken off).
//
// Read with the caller's `db`, in a savepoint inside a write, as card-choices.ts is.

/** Stamps a league's episodes with their records of who voted for whom. A failure is logged and leaves the stamps it had. */
export async function stampVoteRecords(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  const episodes = state.episodes ?? [];
  const clear = () => episodes.forEach((ep) => delete ep.voteRecord);
  if (!StateLogic.BountyLogic.of(state)) return clear();
  const s = state.settings ?? {};
  if (!s.showId || s.wikiSeason == null || !Number.isFinite(Number(s.wikiSeason))) return clear();
  const format = StateLogic.formatOf(state);
  if (!Formats.votesOf(format).length) return clear();
  // Only the episodes this league has exits for.
  const numbers = episodes.filter((ep) => (ep.events ?? []).length).map((ep) => ep.number);
  if (!numbers.length) return clear();
  const inWrite = "release" in db && typeof db.release === "function";
  let said: Map<number, unknown>;
  try {
    if (inWrite) await db.query("SAVEPOINT vote_records");
    const { rows } = await db.query(
      `SELECT er.episode_number, er.payload->'castaways' AS castaways
         FROM episode_research er JOIN shows sh ON sh.id = er.show_id
        WHERE sh.slug = $1 AND er.season_number = $2 AND er.source = 'combined' AND er.episode_number = ANY($3::int[])`,
      [s.showId, Number(s.wikiSeason), numbers]
    );
    if (inWrite) await db.query("RELEASE SAVEPOINT vote_records");
    said = new Map(rows.map((r) => [Number(r.episode_number), r.castaways]));
  } catch (e) {
    if (inWrite) await db.query("ROLLBACK TO SAVEPOINT vote_records").catch(() => {});
    console.error("[vote-records] couldn't read the season's votes:", e);
    return;
  }
  // No query from here on: an answer the record can't be read from is logged and that episode left without one.
  const resolve = (name: string) => StateLogic.Core.findCastawayByName(state, name).castaway?.id ?? null;
  for (const ep of episodes) {
    const castaways = said.get(ep.number);
    let rec = null;
    try {
      rec = Array.isArray(castaways) ? Formats.voteRecordOf({ castaways }, format, resolve) : null;
    } catch (e) {
      console.error(`[vote-records] couldn't read Episode ${ep.number}'s votes:`, e);
    }
    if (rec) ep.voteRecord = rec;
    else delete ep.voteRecord;
  }
}
