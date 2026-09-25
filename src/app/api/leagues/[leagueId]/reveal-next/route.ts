import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { fanOutCachedEpisodes } from "@db/wiki-sync.js";
import { approvedCastForLeague, tribesDue } from "@/lib/server/season-cast";

// Catch-up mode's one moving part: reveal the next episode (StateLogic.RevealLogic).
//
// A league that started mid-season sits behind the wiki on purpose -- the connector has already
// read the whole season, but this league may only see episodes 1..n. Revealing raises n by one and
// re-runs the league-scoped fan-out against the extraction already cached for that season, so the
// newly-visible episode's decisions appear on its episode card for the usual per-item review.
//
// Two things it deliberately does NOT do:
//   * touch the wiki. The expensive half of a sync (fetch + extract) is season-scoped and cached;
//     a reveal is string matching and an insert, the same cheap half a nightly run does per league.
//   * apply anything. Revealing makes the results reviewable, not true -- the commissioner still
//     accepts, corrects or rejects each decision exactly as they would in a live league.
//
// One-way, like the pointer itself: there's no un-reveal route, because by the time anyone wants
// one the room has already seen the episode (and may have scored it).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  let revealed: number | null = null;
  let tribed: string[] = [];
  const state = await withLeagueLock(leagueId, async (s, client) => {
    if (!StateLogic.RevealLogic.isCatchingUp(s)) {
      throw new HttpError(400, "This league isn't catching up — results arrive as soon as the connector reads them.");
    }
    revealed = StateLogic.RevealLogic.revealNext(s);

    // The starting tribes are themselves something an episode reveals, so the season can hold them
    // back (db/migrations/0013) until a catching-up league reaches the episode that shows the
    // division -- usually the premiere. This is the moment that becomes true, so hand them over
    // here, inside the same lock that moved the pointer. applyCastTribes links the castaways the
    // league already has; it's additive and idempotent, so a reveal past the due episode is a no-op
    // and a castaway a commissioner already sorted by hand keeps the tribe they gave them.
    const approved = await approvedCastForLeague(client, s);
    if (approved && tribesDue(s, approved.tribesFromEpisode)) {
      tribed = StateLogic.applyCastTribes(s, {
        castaways: approved.cast.map((c) => ({ name: c.name, tribeName: c.tribeName })),
      }).linked;
    }
  });

  // Outside the lock on purpose: the fan-out writes to wiki_proposal_items, not to league state, and
  // holding a league row lock across it would block every other mutation for the duration. The
  // pointer is already committed by here, so a failure below costs the filing, not the reveal --
  // the next sync (or the next reveal) files what this one didn't.
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  let filed: string | null = null;
  let written = 0;
  let unmatched: string[] = [];
  let dropped: { name: string; why: string }[] = [];
  let note: string | null = null;
  try {
    const result = rows.length ? await fanOutCachedEpisodes(pool, rows[0]) : null;
    if (!result) {
      note = `Episode ${revealed} is revealed, but the connector hasn't read it from the wiki yet — results will appear after the next sync.`;
    } else {
      filed = result.summary;
      written = result.written ?? 0;
      // Names the wiki used that this league's cast doesn't have. Reported separately rather than
      // left inside `summary`, so the panel can show it as the warning it is instead of burying it
      // in a success sentence.
      unmatched = result.unmatched ?? [];
      // Results the validation refused (a zero-votes-safe for someone voted out that episode, an
      // individual immunity before the merge, a duplicate). Each refusal is right on its own, but a
      // castaway whose only result was dropped would otherwise just be absent from the list with
      // nothing said about it.
      dropped = (result.dropped ?? []).filter((d) => d.episode === revealed).map((d) => ({ name: d.name, why: d.why }));
    }
  } catch (e) {
    // A league with no cast yet is the common one, and it's a real answer, not a 500.
    note = e instanceof Error ? e.message : "The reveal worked, but filing its results didn't.";
  }

  // A revealed episode ALWAYS gets a card, even when the reveal filed nothing.
  //
  // Nothing used to create it: the episode row appeared only when someone ACCEPTED one of the
  // filed decisions (the accept route's ensureEpisodeNumber) or opened it by hand. So a reveal that
  // filed no results -- the wiki not read that far yet, every name unmatched, or an older build
  // whose panel had no Open button -- left the league saying "played through episode 1" over an
  // empty Episodes tab, and the panel moved on to offering episode 2. "Revealed" and "there is a
  // card for it" have to mean the same thing.
  //
  // ensureEpisodeNumber fills any gap below it too, so this also repairs a league that got into
  // that state before this existed. postMerge comes from what was actually filed rather than
  // defaulting to false, so a post-merge episode isn't created marked pre-merge and left for
  // someone to notice; with nothing filed, false is the only answer available and the card carries
  // its own Post-merge checkbox.
  let finalState = state;
  if (revealed !== null) {
    const { rows: filedItems } = await pool.query(
      "SELECT bool_or(post_merge) AS post_merge FROM wiki_proposal_items WHERE league_id=$1 AND episode_number=$2",
      [leagueId, revealed]
    );
    const postMerge = !!(filedItems[0] && filedItems[0].post_merge);
    finalState = await withLeagueLock(leagueId, (s) => {
      StateLogic.ensureEpisodeNumber(s, revealed as number, postMerge);
    });
  }

  // Who the wiki said NOTHING about this episode. Normal for some (a castaway who attended Tribal
  // and received votes is neither immune nor zero-votes-safe, so there's nothing to report), but it
  // is also the only way to notice the case that matters: an extraction that quietly skipped
  // somebody, or a result dropped upstream. The commissioner can add anything real by hand from the
  // episode card; what they couldn't do before was see that a name was missing at all.
  let noResultFor: string[] = [];
  if (revealed !== null) {
    const { rows: named } = await pool.query(
      "SELECT DISTINCT castaway_name FROM wiki_proposal_items WHERE league_id=$1 AND episode_number=$2",
      [leagueId, revealed]
    );
    const heard = new Set(named.map((r) => String(r.castaway_name).trim().toLowerCase()));
    noResultFor = finalState.castaways
      .filter((c) => c.status !== "eliminated" && !heard.has(c.name.trim().toLowerCase()))
      .map((c) => c.name);
  }

  return NextResponse.json({
    state: finalState,
    revealedThroughEpisode: revealed,
    filed,
    written,
    unmatched,
    dropped,
    noResultFor,
    tribed,
    note,
  });
});
