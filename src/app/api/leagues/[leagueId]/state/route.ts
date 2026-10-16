import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError, withLeagueLock } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import Bots from "@/lib/game/bot-logic.js";
import { notifyDraftTurn } from "@/lib/server/push-events";
import { resultsSeenThrough } from "@/lib/server/results-seen";
import { stampAirTimes } from "@/lib/server/air-times";

// Who's on the clock in the draft, to tell whether a bot's picks passed the turn on to someone (read
// on a copy: currentDraftTurn tidies draftOrder as it goes).
function draftTurn(state: LeagueState) {
  return StateLogic.currentDraftTurn(structuredClone(state))?.playerId;
}

// "How this league works" (docs/PLAN-league-explainer.md): false until this member has finished or
// skipped it once. A super-admin with no membership has nothing to be shown.
async function explainerSeen(userId: string, leagueId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT explainer_seen_at FROM league_memberships WHERE league_id=$1 AND user_id=$2", [
    leagueId,
    userId,
  ]);
  return !rows.length || rows[0].explainer_seen_at !== null;
}

// Port of SurvivorDraft's server/routes/leagueState.js GET / -- what AuthGate's loadFirstLeague
// and the league switcher both fetch on entering a league.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");

  const leagueRes = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!leagueRes.rows.length) throw new HttpError(404, "League not found");
  const league = leagueRes.rows[0];

  // A league that predates the always-a-next-episode rule (or hasn't been written to since) gets it
  // on load -- persisted, not just computed, since bets and picks key on the episode's id and an id
  // invented fresh on every read would never match. The check runs on a copy so the common case
  // (nothing to do) costs no write.
  //
  // Same for a computer player with a move waiting that no write has prompted -- typically a draft
  // whose scheduled start time just passed with a bot first on the clock. withLeagueLock runs the bots.
  // If that moved a turn on, whoever's up now hears about it as they would after a person's pick. Air
  // times are stamped first so a bot never sees a lineup as open when its episode is already airing.
  //
  // And a waiver week with a step due (opening, processing, closing: docs/PLAN-midseason-waivers.md),
  // so the week moves on when its time comes even if nobody has written to the league since.
  await stampAirTimes(pool, league.state);
  const waiverStepDue = !!StateLogic.WaiverLogic.due(league.state, Date.now());
  if (StateLogic.ensureNextEpisode(structuredClone(league.state)) || Bots.hasWork(league.state) || waiverStepDue) {
    const before = draftTurn(league.state);
    league.state = await withLeagueLock(leagueId, () => {});
    if (draftTurn(league.state) !== before) notifyDraftTurn(leagueId, league.state, null);
    await stampAirTimes(pool, league.state);
  }

  const accountsRes = await pool.query(
    `SELECT m.player_id, m.role, u.username FROM league_memberships m
     JOIN "user" u ON u.id = m.user_id WHERE m.league_id=$1`,
    [leagueId]
  );

  return NextResponse.json({
    league: { id: league.id, name: league.name },
    // Plus this member's spoiler-protection mark: results after it are held back on their screen.
    membership: {
      ...membership,
      resultsSeenThrough: await resultsSeenThrough(user.id, leagueId, league.state),
      explainerSeen: await explainerSeen(user.id, leagueId),
    },
    state: league.state,
    playerAccounts: accountsRes.rows,
  });
});
