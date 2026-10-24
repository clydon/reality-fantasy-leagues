import { actionItems, type ActionItem } from "@/lib/game/action-items.js";
import { commissionerItems, type CommissionerItem } from "@/lib/game/commissioner-items";
import { pool } from "./db";
import { stampAirTimes } from "./air-times";
import { showsResultsImmediately } from "./results-seen";
import { leagueStates } from "./league-states";

export type LeagueMove = ActionItem & { leagueId: string; leagueName: string };
export type LeagueJob = CommissionerItem & { leagueId: string; leagueName: string };

/**
 * What's waiting on someone across every league they're in (actionItems, one fan-out over league state), and
 * the to-dos of the leagues they run (commissionerItems). Read by the classic action bar (/api/me/actions,
 * polled every 30s) and the new design's home (/api/me/home), so both list exactly the same moves. Leagues
 * in My Leagues order (alphabetical); items within a league keep actionItems' urgency order.
 */
export async function dueMoves(userId: string): Promise<{ items: LeagueMove[]; commish: LeagueJob[] }> {
  const immediate = await showsResultsImmediately(userId);
  const { rows: memberships } = await pool.query(
    `SELECT l.id, l.name, m.player_id, m.role, m.results_seen_through FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id WHERE m.user_id=$1
     ORDER BY l.name`,
    [userId]
  );
  // Polled every 30s: states through league-states.ts, fetched again only when one has changed.
  const states = await leagueStates(memberships.map((r) => r.id));
  const rows = memberships.filter((r) => states.has(r.id)).map((r) => ({ ...r, state: states.get(r.id)! }));
  // One league's unreadable state costs that league's items, not the whole bar. Air times stamped
  // first, so a lineup or pick whose episode has started isn't still listed as due.
  const items: LeagueMove[] = [];
  const commish: LeagueJob[] = [];
  for (const r of rows) {
    if (!r.player_id) continue;
    try {
      await stampAirTimes(pool, r.state);
      // A late joiner who hasn't revealed anything yet is at the episode before their start (as in late-join.ts).
      // Anyone else goes by their mark (results-seen.ts), or sees everything if they've opted out of
      // spoiler protection; no mark yet counts as nothing revealed, so a waiver pickup (which says one of
      // theirs left) never shows before they've looked.
      const late = r.state.players?.find((p: { id: string }) => p.id === r.player_id)?.lateJoin;
      const seen = late
        ? (r.results_seen_through ?? (Number.isInteger(late.startEpisode) ? late.startEpisode - 1 : null))
        : immediate
          ? null
          : (r.results_seen_through ?? 0);
      items.push(...actionItems(r.state, r.player_id, seen, { commissioner: r.role === "commissioner" }).map((it) => ({ ...it, leagueId: r.id as string, leagueName: r.name as string })));
      // None of these says anything about results, so the full state is safe to read.
      if (r.role === "commissioner") commish.push(...commissionerItems(r.state).map((it) => ({ ...it, leagueId: r.id as string, leagueName: r.name as string })));
    } catch (e) {
      console.error(`[actions] league ${r.id}:`, e);
    }
  }
  return { items, commish };
}
