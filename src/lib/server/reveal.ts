import StateLogic from "@/lib/game/state-logic.js";
import Bots from "@/lib/game/bot-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError, withLeagueLock } from "./db";
import { switchOn } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { revealAcrossGroup } from "./late-join";
import { markResultsSeen } from "./results-seen";
import { seatMark } from "./shared-seats";

// One member's "Reveal": they've now seen results through episode n in a league (StateLogic.SpoilerLogic). Forward
// only. Classic's results-seen route and the new design's reveal (season-episodes.ts: one reveal per episode for
// every game on the couch's season) both come through here, so the rules are the same:
//
// Linked leagues (league-groups.ts) play the same season, so one reveal is a reveal in all of them the member is
// in. And the conversation hears about it -- one "conor revealed episode 9" line in the shared chat -- so everyone
// knows who's caught up and what's safe to talk about; unless they don't share Where I am (step 15 part 3's What your
// couch sees: a reveal line says how far they are), when it says nothing.
//
// A late joiner catching up (StateLogic.GhostLogic) moves one episode per reveal -- the server holds that line too,
// so nothing (a stale tab, a double tap) can carry them past the week they've watched. `jump` is the one
// exception: their deliberate "jump to the latest episode". Their reveal says nothing in chat (the league can't see
// them). It does move their other linked leagues at the same mark: one catch-up per group (revealAcrossGroup,
// docs/PLAN-linked-late-join.md).
/** Where this person is on the league's season (their follow's mark), `unset` when they have none: read only for a seat with no
 *  mark of its own in a game at its own pace. */
async function showMark(userId: string, leagueId: string, unset: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT f.seen_through FROM leagues l ${LEAGUE_SEASON_JOIN} JOIN show_follows f ON f.season_id = ss.id AND f.user_id = $2 WHERE l.id = $1`,
    [leagueId, userId]
  );
  const mark = rows[0]?.seen_through;
  return Number.isInteger(mark) ? (mark as number) : unset;
}

export async function markRevealed(user: SessionUser, leagueId: string, playerId: string | null, through: number, jump = false): Promise<void> {
  let n = through;
  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
  const before: number | null = rows[0]?.results_seen_through ?? null;

  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId]);
  const current = leagueRows[0]?.state as LeagueState | undefined;
  const late = current && playerId ? StateLogic.GhostLogic.lateJoinOf(current, playerId) : null;
  if (late && current && playerId) {
    if (late.startEpisode === null) throw new HttpError(400, "Choose where to start first");
    // A game at your own pace with teams: your team first (part 3a), or your first episode would score nobody.
    if (StateLogic.GhostLogic.needsTeam(current, playerId)) throw new HttpError(400, "Pick your team first");
    if (StateLogic.GhostLogic.draftsTogether(current) && !StateLogic.GhostLogic.draftDone(current)) throw new HttpError(400, "Draft together first");
    const latest = StateLogic.SpoilerLogic.latestWithResults(current);
    // Their mark here, else the episode before their start. A game at its own pace made before it aired gives nobody a mark of
    // their own (it's made as a live game; GhostLogic.settlePace makes its seats late joiners at its first results), so someone
    // behind its start on the show is where the show has them: the episodes before the game's start are theirs to reveal first.
    const seen = before ?? Math.min(late.startEpisode - 1, StateLogic.GhostLogic.ownPace(current) ? await showMark(user.id, leagueId, late.startEpisode - 1) : late.startEpisode - 1);
    if (late.catchingUp) {
      if (jump) n = latest;
      // One at a time. An episode they've already passed here (a stale tab, a double tap) changes nothing, below.
      else if (n > seen + 1) throw new HttpError(400, `You're on episode ${seen + 1}: reveal that one first`);
    }
    if (n <= seen) return;
    await markResultsSeen(user.id, leagueId, n);
    // The seat's own state follows the lowest mark on it (a team two people share, step A10 part 4b: shared-seats.ts), so
    // one of them revealing never carries the other past what they've seen.
    const seat = (await seatMark(pool, leagueId, playerId, late.startEpisode - 1)) ?? n;
    await withLeagueLock(leagueId, (s) => {
      StateLogic.GhostLogic.markCaughtUp(s, playerId, seat);
      const lj = StateLogic.GhostLogic.lateJoinOf(s, playerId);
      // Forward only: someone behind on the team never takes it back.
      if (lj && !((lj.seenThrough ?? -1) >= seat)) lj.seenThrough = seat;
      // A game at your own pace (docs/PLAN-own-pace-games.md): its computer players play each week up to this one on their own
      // copies, the moment the first person reveals it, so they're never ahead of or behind anyone.
      if (StateLogic.GhostLogic.ownPace(s)) Bots.catchUpTo(s, n);
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
    await pool.query(
      `INSERT INTO chat_messages (league_id, user_id, author_name, type, text) SELECT $1::uuid, $2::text, $3::text, 'reveal', $4::text WHERE ${switchOn("where", "$2")}`,
      [leagueId, user.id, name, `${name} revealed ${what}`]
    );
  }
}
