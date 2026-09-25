import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { fanOutCachedEpisodes } from "@db/wiki-sync.js";

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
  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.RevealLogic.isCatchingUp(s)) {
      throw new HttpError(400, "This league isn't catching up — results arrive as soon as the connector reads them.");
    }
    revealed = StateLogic.RevealLogic.revealNext(s);
  });

  // Outside the lock on purpose: the fan-out writes to wiki_proposal_items, not to league state, and
  // holding a league row lock across it would block every other mutation for the duration. The
  // pointer is already committed by here, so a failure below costs the filing, not the reveal --
  // the next sync (or the next reveal) files what this one didn't.
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  let filed: string | null = null;
  let note: string | null = null;
  try {
    const result = rows.length ? await fanOutCachedEpisodes(pool, rows[0]) : null;
    if (!result) {
      note = `Episode ${revealed} is revealed, but the connector hasn't read it from the wiki yet — results will appear after the next sync.`;
    } else {
      filed = result.summary;
    }
  } catch (e) {
    // A league with no cast imported yet is the common one, and it's a real answer, not a 500.
    note = e instanceof Error ? e.message : "The reveal worked, but filing its results didn't.";
  }

  return NextResponse.json({ state, revealedThroughEpisode: revealed, filed, note });
});
