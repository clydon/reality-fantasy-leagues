import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { couchMembers, healCouches } from "@/lib/server/couches";
import { dueMoves } from "@/lib/server/due-moves";
import { seenThrough } from "@/lib/server/guard";
import { followsOf, games, seasonHeaders, type Game } from "@/lib/server/show-space";
import { latestAired, seasonSchedules, upNext } from "@/lib/server/schedule";
import { progressOf } from "@/lib/server/season-games";

// The new design's home (docs/PLAN-new-design.md step 0b; the hub, step 8): your couches with their people and
// games, the shows you follow or play with where you are in each and what's on next (and who's set for it, step 1),
// and the moves due across your leagues (due-moves.ts, the same items as the classic action bar).
//
// Spoiler-safe through guard.ts: it says nothing about results, only when episodes air and how far you are.
// Others' follows are only those they share (a show watched privately isn't), and never how far they are.
// Not polled yet: a screen that polls it should poll something smaller.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  await healCouches(user.id);

  const { rows: couchRows } = await pool.query(
    "SELECT c.id, c.name, cm.role FROM couch_members cm JOIN couches c ON c.id = cm.couch_id WHERE cm.user_id = $1 ORDER BY c.name, c.id",
    [user.id]
  );
  const couchIds = couchRows.map((c) => c.id as string);
  const [members, couchGames, myGames] = await Promise.all([couchMembers(couchIds), games(user.id, { couchIds }), games(user.id, { mine: true })]);
  const people = [user.id, ...[...members.values()].flat().map((m) => m.userId)];
  const follows = await followsOf(user.id, people);
  const watching = (userId: string) => follows.filter((f) => f.userId === userId && f.following && !f.private).map((f) => f.seasonId);

  // Your shows: the seasons you follow, and those you play whether or not you follow them.
  const mine = follows.filter((f) => f.userId === user.id);
  const seasonIds = [...new Set([...mine.filter((f) => f.following).map((f) => f.seasonId), ...myGames.map((g) => g.seasonId).filter((id): id is string => !!id)])];
  const [headers, schedules, moves] = await Promise.all([seasonHeaders(seasonIds), seasonSchedules(seasonIds), dueMoves(user.id)]);
  // Who's set this week in your games with a weekly move, read after the moves so each state costs a hash.
  const progress = await progressOf(user, myGames);
  const now = new Date();
  const shows = [];
  for (const id of seasonIds) {
    const header = headers.get(id);
    if (!header) continue;
    const follow = mine.find((f) => f.seasonId === id);
    const seen = await seenThrough(user.id, id);
    const schedule = schedules.get(id);
    shows.push({
      ...header,
      following: follow?.following ?? false,
      private: follow?.private ?? false,
      // null: they see results straight away (spoiler protection off in Account settings).
      seenThrough: Number.isFinite(seen) ? seen : null,
      upNext: upNext(schedule, now),
      latestAired: latestAired(schedule, now),
      games: myGames.filter((g) => g.seasonId === id).map(gameOut),
      // Who's set for the next episode, per game with a weekly move (Up next shows the current couch's).
      progress: myGames.filter((g) => g.seasonId === id && progress.has(g.leagueId)).map((g) => ({ leagueId: g.leagueId, ...progress.get(g.leagueId)! })),
    });
  }

  return NextResponse.json({
    user: { id: user.id, name: (user as { username?: string | null }).username || user.name },
    couches: couchRows.map((c) => ({
      id: c.id,
      name: c.name,
      yourRole: c.role,
      members: (members.get(c.id) ?? []).map((m) => ({ userId: m.userId, name: m.name, role: m.role, joinedAt: m.joinedAt, watching: watching(m.userId) })),
      games: couchGames.filter((g) => g.couchId === c.id).map(gameOut),
    })),
    shows,
    // Leagues with no season in the catalog (a league still being set up), so they're not lost.
    unscheduled: myGames.filter((g) => !g.seasonId).map(gameOut),
    moves: moves.items,
    // The leagues you run's own to-dos: Backstage and the dot on a show's menu (step 5), never Tonight.
    backstage: moves.commish,
  });
});

function gameOut(g: Game) {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, couchId: g.couchId, seasonId: g.seasonId, groupId: g.groupId, yourRole: g.yourRole };
}
