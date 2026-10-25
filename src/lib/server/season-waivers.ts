import StateLogic from "@/lib/game/state-logic.js";
import { factsOf, waiverWeek, type FactsOf, type WaiverWeek } from "@/lib/game/waiver-view";
import type { SessionUser } from "./auth-helpers";
import { pool } from "./db";
import { gamesHere } from "./season-games";
import { seasonFactsFor } from "./season-stats";
import { readOwnClaim } from "./waivers";

// Your waivers on a season (docs/PLAN-new-design.md step 6a; GET /api/seasons/[id]/waivers?couch=): the week running in
// each of your games that has waivers, as waiver-view.ts words it, from your copy at your mark. Your own claim comes from
// waiver_claims for you alone (src/lib/server/waivers.js readOwnClaim), and only once you've revealed the week's
// episode: a claim made for you would say one of yours left. The writes go through the league routes the classic app
// uses (/waivers/claims, /waivers/free-agency, asked `?quiet`). Not polled: read on opening the page and after a save.

export async function seasonWaivers(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ games: WaiverWeek[] }> {
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
  return { games: out };
}
