import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError, withLeagueLock } from "./db";
import { revealAcrossGroup } from "./late-join";
import { markResultsSeen } from "./results-seen";

// One member's "Reveal": they've now seen results through episode n in a league (StateLogic.SpoilerLogic). Forward
// only. Classic's results-seen route and the new design's reveal (season-episodes.ts: one reveal per episode for
// every game on the couch's season) both come through here, so the rules are the same:
//
// Linked leagues (league-groups.ts) play the same season, so one reveal is a reveal in all of them the member is
// in. And the conversation hears about it -- one "conor revealed episode 9" line in the shared chat -- so everyone
// knows who's caught up and what's safe to talk about.
//
// A late joiner catching up (StateLogic.GhostLogic) moves one episode per reveal -- the server holds that line too,
// so nothing (a stale tab, a double tap) can carry them past the week they've watched. `jump` is the one
// exception: their deliberate "jump to the latest episode". Their reveal says nothing in chat (the league can't see
// them). It does move their other linked leagues at the same mark: one catch-up per group (revealAcrossGroup,
// docs/PLAN-linked-late-join.md).
export async function markRevealed(user: SessionUser, leagueId: string, playerId: string | null, through: number, jump = false): Promise<void> {
  let n = through;
  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
  const before: number | null = rows[0]?.results_seen_through ?? null;

  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId]);
  const current = leagueRows[0]?.state as LeagueState | undefined;
  const late = current && playerId ? StateLogic.GhostLogic.lateJoinOf(current, playerId) : null;
  if (late && current && playerId) {
    if (late.startEpisode === null) throw new HttpError(400, "Choose where to start first");
    const latest = StateLogic.SpoilerLogic.latestWithResults(current);
    const seen = before ?? late.startEpisode - 1;
    if (late.catchingUp) {
      if (jump) n = latest;
      else if (n !== seen + 1) throw new HttpError(400, `You're on episode ${seen + 1}: reveal that one first`);
    }
    if (n <= seen) return;
    await markResultsSeen(user.id, leagueId, n);
    await withLeagueLock(leagueId, (s) => {
      StateLogic.GhostLogic.markCaughtUp(s, playerId, n);
      const lj = StateLogic.GhostLogic.lateJoinOf(s, playerId);
      if (lj) lj.seenThrough = n;
    });
    await revealAcrossGroup(user.id, leagueId, seen, n, late.catchingUp && jump);
    if (StateLogic.getPlayer(current, playerId)?.ghost) return;
  } else {
    await markResultsSeen(user.id, leagueId, n);
    // Their other linked leagues; one they're catching up in follows only when in step (late-join.ts).
    await revealAcrossGroup(user.id, leagueId, before, n, false);
  }

  if (before !== null && n > before) {
    const name = (user as { username?: string | null }).username || user.name;
    const what = n - before === 1 ? `episode ${n}` : `episodes ${before + 1}–${n}`;
    await pool.query("INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, $2, $3, 'reveal', $4)", [
      leagueId,
      user.id,
      name,
      `${name} revealed ${what}`,
    ]);
  }
}
