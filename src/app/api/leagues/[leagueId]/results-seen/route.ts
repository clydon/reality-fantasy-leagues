import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError, withLeagueLock } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { markResultsSeen } from "@/lib/server/results-seen";
import { groupLeagueIds } from "@/lib/server/league-groups";
import { catchingUpIn } from "@/lib/server/late-join";

// "Results are in! -- Reveal": body { through: n } -- this member has now seen results through
// episode n (StateLogic.SpoilerLogic). Forward only.
//
// Linked leagues (league-groups.ts) play the same season, so one reveal is a reveal in all of them
// the member is in. And the conversation hears about it -- one "conor revealed episode 9" line in
// the shared chat -- so everyone knows who's caught up and what's safe to talk about.
//
// A late joiner catching up (StateLogic.GhostLogic) moves one episode per reveal -- the server holds
// that line too, so nothing (a stale tab, a double tap) can carry them past the week they've watched.
// `jump: true` is the one exception: their deliberate "jump to the latest episode". Their reveal stays
// in this league (their season is their own) and says nothing in chat (the league can't see them).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { through, jump } = (await req.json().catch(() => ({}))) as { through?: unknown; jump?: unknown };
  if (!Number.isInteger(through) || (through as number) < 0) throw new HttpError(400, "through must be an episode number");
  let n = through as number;

  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [
    leagueId,
    user.id,
  ]);
  const before: number | null = rows[0]?.results_seen_through ?? null;

  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId]);
  const current = leagueRows[0]?.state as LeagueState | undefined;
  const playerId = membership.playerId;
  const late = current && playerId ? StateLogic.GhostLogic.lateJoinOf(current, playerId) : null;
  if (late && current && playerId) {
    if (late.startEpisode === null) throw new HttpError(400, "Choose where to start first");
    const latest = StateLogic.SpoilerLogic.latestWithResults(current);
    const seen = before ?? late.startEpisode - 1;
    if (late.catchingUp) {
      if (jump === true) n = latest;
      else if (n !== seen + 1) throw new HttpError(400, `You're on episode ${seen + 1}: reveal that one first`);
    }
    if (n <= seen) return NextResponse.json({ ok: true });
    await markResultsSeen(user.id, leagueId, n);
    await withLeagueLock(leagueId, (s) => {
      StateLogic.GhostLogic.markCaughtUp(s, playerId, n);
      const lj = StateLogic.GhostLogic.lateJoinOf(s, playerId);
      if (lj) lj.seenThrough = n;
    });
    if (StateLogic.getPlayer(current, playerId)?.ghost) return NextResponse.json({ ok: true });
  } else {
    // A linked league where they're a late joiner still catching up keeps its own mark (late-join.ts).
    const ids = await groupLeagueIds(leagueId);
    const skip = await catchingUpIn(user.id, ids);
    for (const id of ids) if (!skip.has(id)) await markResultsSeen(user.id, id, n);
  }

  if (before !== null && n > before) {
    const name = (user as { username?: string | null }).username || user.name;
    const what = n - before === 1 ? `episode ${n}` : `episodes ${before + 1}–${n}`;
    await pool.query(
      "INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, $2, $3, 'reveal', $4)",
      [leagueId, user.id, name, `${name} revealed ${what}`]
    );
  }
  return NextResponse.json({ ok: true });
});
