import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import type { LeagueState } from "@/lib/game/types";
import { resultsSeenThrough } from "@/lib/server/results-seen";
import { leagueState } from "@/lib/server/league-states";
import { readyLeague } from "@/lib/server/league-read";

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

  // Polled every 15s while a league is open: the state comes through league-states.ts, which only
  // fetches it again when it has changed.
  const leagueRes = await pool.query("SELECT id, name FROM leagues WHERE id=$1", [leagueId]);
  const state = await leagueState(leagueId);
  if (!leagueRes.rows.length || !state) throw new HttpError(404, "League not found");
  const league = { ...leagueRes.rows[0], state } as { id: string; name: string; state: LeagueState };

  // The next episode, any computer player's move and any waiver step that was waiting for a read (league-read.ts).
  league.state = await readyLeague(leagueId, league.state);

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
