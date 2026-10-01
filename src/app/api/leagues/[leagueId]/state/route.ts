import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError, withLeagueLock } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";
import { resultsSeenThrough } from "@/lib/server/results-seen";

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
  if (StateLogic.ensureNextEpisode(structuredClone(league.state))) {
    league.state = await withLeagueLock(leagueId, () => {});
  }

  const accountsRes = await pool.query(
    `SELECT m.player_id, m.role, u.username FROM league_memberships m
     JOIN "user" u ON u.id = m.user_id WHERE m.league_id=$1`,
    [leagueId]
  );

  return NextResponse.json({
    league: { id: league.id, name: league.name },
    // Plus this member's spoiler-protection mark: results after it are held back on their screen.
    membership: { ...membership, resultsSeenThrough: await resultsSeenThrough(user.id, leagueId, league.state) },
    state: league.state,
    playerAccounts: accountsRes.rows,
  });
});
