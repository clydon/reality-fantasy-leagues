import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { approvedCastForLeague, tribesDue } from "@/lib/server/season-cast";
import { syncLeagueDecisions } from "@/lib/server/season-decisions";
import { groupLeagueIds } from "@/lib/server/league-groups";

// Catch-up mode's one moving part: reveal the next episode (StateLogic.RevealLogic).
//
// A league that started mid-season sits behind the season on purpose -- results may already be
// decided for the whole season, but this league only sees episodes 1..n. Revealing raises n by one
// and applies that episode's admin-accepted results (db/migrations/0019), all inside one lock. There
// is nothing for the commissioner to review: results are decided once per season, by an admin.
//
// One-way, like the pointer itself: there's no un-reveal route, because by the time anyone wants
// one the room has already seen the episode (and may have scored it).
// The reveal for one league, in one lock. `expectFrom` (linked leagues): only if that league was at
// the same episode as the one revealing.
async function revealNextIn(leagueId: string, userId: string, expectFrom?: number) {
  let revealed: number | null = null;
  let tribed: string[] = [];
  let applied = 0;
  let skipped: { name: string; why: string }[] = [];
  let seasonId: string | null = null;
  const state = await withLeagueLock(leagueId, async (s, client) => {
    // A linked league only follows when it was at the same episode: it reveals in step, never jumps.
    if (expectFrom !== undefined && StateLogic.RevealLogic.revealedThrough(s) !== expectFrom) {
      throw new HttpError(409, "Not in step with the league that revealed");
    }
    if (!StateLogic.RevealLogic.isCatchingUp(s)) {
      throw new HttpError(400, "This league isn't catching up — results arrive as soon as they're decided.");
    }
    if (StateLogic.RevealLogic.isComplete(s)) {
      throw new HttpError(400, StateLogic.seasonEnded(s) ? "The season is over — there's nothing left to reveal." : "This game is over — there's nothing left to reveal.");
    }
    revealed = StateLogic.RevealLogic.revealNext(s);

    // The starting tribes are themselves something an episode reveals, so the season can hold them
    // back (db/migrations/0013) until a catching-up league reaches the episode that shows the
    // division -- usually the premiere. Additive and idempotent, so a reveal past the due episode is
    // a no-op.
    const approved = await approvedCastForLeague(client, s);
    if (approved && tribesDue(s, approved.tribesFromEpisode)) {
      tribed = StateLogic.applyCastTribes(s, {
        castaways: approved.cast.map((c) => ({ id: c.id, name: c.name, tribeName: c.tribeName })),
      }).linked;
    }

    const out = await syncLeagueDecisions(client, leagueId, s);
    applied = out.applied;
    skipped = out.skipped;

    // A revealed episode always gets a card, even when nothing is decided for it yet.
    StateLogic.ensureEpisodeNumber(s, revealed as number, false);

    const { rows } = await client.query(
      `SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id
        WHERE sh.slug = $1 AND ss.season_number::text = $2`,
      [s.settings.showId, String(s.settings.wikiSeason)]
    );
    seasonId = rows.length ? rows[0].id : null;
  }, (_b, a) => ({ userId, kind: "results", tier: 2, text: `Revealed Episode ${StateLogic.RevealLogic.revealedThrough(a)} for the game` }));

  return { state, revealed: revealed as number | null, tribed, applied, skipped, seasonId: seasonId as string | null };
}

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const { state, revealed, tribed, applied, skipped, seasonId } = await revealNextIn(leagueId, user.id);

  // Linked leagues (league-groups.ts) reveal together: each one that was at the same episode
  // reveals this one too. One that isn't in step (or isn't catching up) is left as it is.
  if (revealed !== null) {
    for (const id of await groupLeagueIds(leagueId)) {
      if (id !== leagueId) await revealNextIn(id, user.id, revealed - 1).catch(() => {});
    }
  }

  // Results still awaiting the admin's review for this episode: they'll land on their own once
  // decided (an admin decision syncs every league on the season), and the panel should say so rather
  // than let "nothing happened" look final.
  let awaitingReview = 0;
  if (seasonId && revealed !== null) {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND status='pending'",
      [seasonId, revealed]
    );
    awaitingReview = rows[0].n;
  }

  return NextResponse.json({ state, revealedThroughEpisode: revealed, applied, skipped, awaitingReview, tribed });
});
