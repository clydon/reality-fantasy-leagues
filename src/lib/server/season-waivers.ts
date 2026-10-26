import StateLogic from "@/lib/game/state-logic.js";
import { factsOf, waiverWeek, type FactsOf, type WaiverWeek } from "@/lib/game/waiver-view";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool } from "./db";
import { gamesHere } from "./season-games";
import { seasonFactsFor } from "./season-stats";
import { readOwnClaim } from "./waivers";

// Your waivers on a season (docs/PLAN-new-design.md step 6a; GET /api/seasons/[id]/waivers?couch=): the week running in
// each of your games that has waivers, as waiver-view.ts words it, from your copy at your mark. Your own claim comes from
// waiver_claims for you alone (src/lib/server/waivers.js readOwnClaim), and only once you've revealed the week's
// episode: a claim made for you would say one of yours left. The writes go through the league routes the classic app
// uses (/waivers/claims, /waivers/free-agency, asked `?quiet`). Not polled: read on opening the page and after a save.
//
// `seen`: the runs you've watched (step 15 part 2: per account, so Tonight's "Waivers ran" plate goes on every phone once you've
// watched it on one; waiver_runs_seen), as "<leagueId>:<periodId>".

export async function seasonWaivers(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ games: WaiverWeek[]; seen: string[] }> {
  const { here } = await gamesHere(user, seasonId, couchId);
  const out: WaiverWeek[] = [];
  // Points and tags as the Cast tab counts them (the season's facts, through your mark), once for every game here.
  let scored: FactsOf | null = null;
  if (here.some((h) => StateLogic.WaiverLogic.supported(h.state))) {
    try {
      scored = factsOf((await seasonFactsFor(user, seasonId, couchId)).facts);
    } catch (e) {
      console.error(`[season-waivers] season ${seasonId} facts:`, e);
    }
  }
  for (const h of here) {
    try {
      const W = StateLogic.WaiverLogic;
      const current = W.supported(h.state) ? W.current(h.state) : null;
      const seen = h.mark === null || (current && h.mark >= current.episode);
      const claim = current && current.phase === "open" && seen ? await readOwnClaim(pool, h.game.leagueId, current.id, h.playerId, h.state) : null;
      const week = waiverWeek(h.ref, h.state, h.playerId, h.mark, h.userOf, claim?.pairs ?? null, scored);
      if (week) out.push(week);
    } catch (e) {
      console.error(`[season-waivers] league ${h.game.leagueId}:`, e);
    }
  }
  const runs = out.filter((w) => w.run).map((w) => w.leagueId);
  const { rows } = runs.length
    ? await pool.query("SELECT league_id, period_id FROM waiver_runs_seen WHERE user_id = $1 AND league_id = ANY($2::uuid[])", [user.id, runs])
    : { rows: [] as { league_id: string; period_id: string }[] };
  return { games: out, seen: rows.map((r) => `${r.league_id}:${r.period_id}`) };
}

/** You've watched a game's waiver run (POST /api/seasons/[id]/waivers { seen: { leagueId, periodId } }): a game of yours. */
export async function markRunSeen(user: SessionUser, seen: unknown): Promise<void> {
  const s = (seen ?? {}) as { leagueId?: unknown; periodId?: unknown };
  if (typeof s.leagueId !== "string" || !isUuid(s.leagueId) || typeof s.periodId !== "string" || !s.periodId || s.periodId.length > 100) {
    throw new HttpError(400, "seen: { leagueId, periodId }");
  }
  const { rowCount } = await pool.query(
    `INSERT INTO waiver_runs_seen (user_id, league_id, period_id)
     SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM league_memberships WHERE league_id = $2 AND user_id = $1)
     ON CONFLICT DO NOTHING`,
    [user.id, s.leagueId, s.periodId]
  );
  if (!rowCount) {
    const { rows } = await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [s.leagueId, user.id]);
    if (!rows.length) throw new HttpError(404, "Not a game of yours");
  }
}
