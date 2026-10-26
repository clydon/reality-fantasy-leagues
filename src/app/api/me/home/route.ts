import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { couchMembers, healCouches } from "@/lib/server/couches";
import { dueMoves } from "@/lib/server/due-moves";
import { seenThrough } from "@/lib/server/guard";
import { followsOf, games, seasonHeaders, type Game } from "@/lib/server/show-space";
import { latestAired, seasonSchedules, titledFor, upNext } from "@/lib/server/schedule";
import { hiddenFor, weekOf } from "@/lib/server/guide";
import { plansFor } from "@/lib/server/watch-plans";
import { progressOf } from "@/lib/server/season-games";
import { leagueStates } from "@/lib/server/league-states";
import { resultsDue } from "@/lib/game/results-due";

// The new design's home (docs/PLAN-new-design.md step 0b; the hub, step 8): your couches with their people and
// games, the shows you follow or play with where you are in each and what's on next (and who's set for it, step 1),
// and the moves due across your leagues (due-moves.ts, the same items as the classic action bar), and per show what
// its results ask of you (step 8: results in to reveal, or the morning update's final scores; results-due.ts), and the
// couches' shows you don't follow (step 10: The couch is watching). The guide (step 11): each show's episodes around this
// week (when each starts, never a title) and what you've hidden from it; and your couches' planned nights still to come (part
// 3, watch-plans.ts: when, which episode and who's in).
//
// Spoiler-safe through guard.ts: it says nothing about results beyond that they're in (and at which stage), only when
// episodes air and how far you are.
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
  // The couches' seasons too, for each couch's line in the switcher ("Survivor 51 · Traitors 5 · 4 people").
  const couchSeasonIds = couchGames.map((g) => g.seasonId).filter((id): id is string => !!id);
  // What the couches' people watch openly that you don't follow (step 10: The couch is watching, Add to my shows).
  const theirs = [...new Set(follows.filter((f) => f.userId !== user.id && f.following && !f.private).map((f) => f.seasonId))].filter(
    (id) => !seasonIds.includes(id)
  );
  const [headers, schedules, moves, guideHidden] = await Promise.all([
    seasonHeaders([...seasonIds, ...couchSeasonIds, ...theirs]),
    seasonSchedules([...seasonIds, ...theirs]),
    dueMoves(user.id),
    hiddenFor(user.id),
  ]);
  // The couches' planned nights (step 11 part 3), with what's been read already.
  const plans = await plansFor(user.id, couchIds, new Date(), { members, schedules, headers });
  // Who's set this week in your games with a weekly move, read after the moves so each state costs a hash; and each
  // game's state again (a hash each) for what its results ask of you.
  const [progress, states, early, seats] = await Promise.all([
    progressOf(user, myGames),
    leagueStates(myGames.filter((g) => g.seasonId).map((g) => g.leagueId)),
    pool.query(
      "SELECT season_id, early_seen, nudge_off_at IS NOT NULL AS nudge_off FROM show_follows WHERE user_id = $1 AND (early_seen IS NOT NULL OR nudge_off_at IS NOT NULL)",
      [user.id]
    ),
    pool.query("SELECT league_id, player_id FROM league_memberships WHERE user_id = $1", [user.id]),
  ]);
  // A game you're catching up in (step 9) reveals from its own strip, not the hub's "Results are in".
  const seatIn = new Map(seats.rows.map((r) => [r.league_id as string, r.player_id as string | null]));
  const live = (g: Game) => {
    const st = states.get(g.leagueId);
    return !!st && !StateLogic.GhostLogic.isCatchingUp(st, seatIn.get(g.leagueId) ?? null);
  };
  const earlySeen = new Map(early.rows.filter((r) => r.early_seen != null).map((r) => [r.season_id as string, r.early_seen as number]));
  const nudged = new Set(early.rows.filter((r) => r.nudge_off).map((r) => r.season_id as string));
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
      // The hub's "you both watch" nudge was answered for this show (step 10).
      nudgeOff: nudged.has(id),
      // null: they see results straight away (spoiler protection off in Account settings).
      seenThrough: Number.isFinite(seen) ? seen : null,
      upNext: ((u) => (u ? titledFor(u, seen) : null))(upNext(schedule, now)),
      latestAired: latestAired(schedule, now),
      // The guide's episodes (step 11): when each airs around this week, no titles.
      week: weekOf(schedule, now),
      games: myGames.filter((g) => g.seasonId === id).map(gameOut),
      // Who's set for the next episode, per game with a weekly move (Up next shows the current couch's).
      progress: myGames.filter((g) => g.seasonId === id && progress.has(g.leagueId)).map((g) => ({ leagueId: g.leagueId, ...progress.get(g.leagueId)! })),
      // Results in past where you are (the hub leads with them), or the final scores of one you revealed early.
      results: resultsDue(
        myGames.filter((g) => g.seasonId === id && live(g)).map((g) => states.get(g.leagueId)).filter((st) => !!st),
        seen,
        earlySeen.get(id)
      ),
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
      seasons: [...new Set(couchGames.filter((g) => g.couchId === c.id && g.seasonId).map((g) => g.seasonId as string))]
        .map((id) => headers.get(id))
        .filter((h) => !!h)
        .sort((a, b) => (b.premiereDate ?? "").localeCompare(a.premiereDate ?? ""))
        .map((h) => ({ seasonId: h.seasonId, label: `${h.show.name.replace(/^The /, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`, status: h.status })),
    })),
    shows,
    // The couches' shows you don't follow (step 10's The couch is watching): who watches each is in the couch's members.
    couchShows: theirs
      .map((id) => headers.get(id))
      .filter((h) => !!h)
      // Not yours: nothing seen, so no episode's title.
      .map((h) => ({
        ...h,
        upNext: ((u) => (u ? titledFor(u, 0) : null))(upNext(schedules.get(h.seasonId), now)),
        latestAired: latestAired(schedules.get(h.seasonId), now),
        week: weekOf(schedules.get(h.seasonId), now),
      })),
    // Leagues with no season in the catalog (a league still being set up), so they're not lost.
    unscheduled: myGames.filter((g) => !g.seasonId).map(gameOut),
    moves: moves.items,
    // The leagues you run's own to-dos: Backstage and the dot on a show's menu (step 5), never Tonight.
    backstage: moves.commish,
    // What you've hidden from the guide (step 11): shows here and TV listings; your own shows always show.
    guideHidden,
    // Your couches' planned nights still to come (step 11 part 3): the guide, a show's Tonight.
    plans,
  });
});

function gameOut(g: Game) {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, couchId: g.couchId, seasonId: g.seasonId, groupId: g.groupId, yourRole: g.yourRole, solo: g.solo };
}
