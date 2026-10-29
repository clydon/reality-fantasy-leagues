import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { pool } from "@/lib/server/db";
import { couchMembers, healCouches } from "@/lib/server/couches";
import { weeklyCallMoves } from "@/lib/server/calls";
import { dueMoves } from "@/lib/server/due-moves";
import { seenThrough } from "@/lib/server/guard";
import { followsOf, games, seasonHeaders, type Game } from "@/lib/server/show-space";
import { latestAired, latestEnded, seasonSchedules, titledFor, upNext } from "@/lib/server/schedule";
import { seenItAsk, type KeepUp } from "@/lib/server/keep-up";
import { hiddenFor, weekOf } from "@/lib/server/guide";
import { plansFor } from "@/lib/server/watch-plans";
import { progressOf } from "@/lib/server/season-games";
import { leagueStates } from "@/lib/server/league-states";
import { resultsDue } from "@/lib/game/results-due";
import { keepTimeZone, unreadNotes } from "@/lib/server/notify-prefs";
import { isImpersonating, requireAuthSession } from "@/lib/server/auth-helpers";
import { withThemeCookie } from "@/lib/server/appearance";
import { DEFAULT_THEME, isTheme } from "@/lib/appearance";

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
// Others' follows are only those they share (a show watched privately isn't, nor anything of someone who doesn't share Where I am:
// step 15 part 3's What your couch sees), each with how far they are (`at`), which is what Where I am shares.
// Not polled yet: a screen that polls it should poll something smaller.
//
// Notifications (step 15 part 2): how many notices are new in the bell since you last looked (`notes`), and `?tz=` keeps the
// time zone your phone is in, so a push says your time (written only when it's changed).
//
// Appearance (step 15 part 4): your theme rides on your own face (`user.theme`), and this device's cookie is written when it
// differs (appearance.ts), so a second device catches up on its first visit.
export const GET = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const user = session.user;
  if (!isImpersonating(session)) await keepTimeZone(user.id, new URL(req.url).searchParams.get("tz"));
  await healCouches(user.id);

  const { rows: couchRows } = await pool.query(
    "SELECT c.id, c.name, cm.role FROM couch_members cm JOIN couches c ON c.id = cm.couch_id WHERE cm.user_id = $1 AND c.deleted_at IS NULL ORDER BY c.name, c.id",
    [user.id]
  );
  const couchIds = couchRows.map((c) => c.id as string);
  const [members, couchGames, myGames, face, notes] = await Promise.all([
    couchMembers(couchIds),
    games(user.id, { couchIds }),
    games(user.id, { mine: true }),
    // Your own face (step 15 part 1): your colour and picture, for your avatar wherever it shows; and your theme (part 4).
    pool.query(
      `SELECT s.colour, s.theme, (EXTRACT(EPOCH FROM p.updated_at) * 1000)::bigint AS picture
         FROM "user" u LEFT JOIN user_settings s ON s.user_id = u.id LEFT JOIN user_pictures p ON p.user_id = u.id WHERE u.id = $1`,
      [user.id]
    ),
    unreadNotes(user.id),
  ]);
  const people = [user.id, ...[...members.values()].flat().map((m) => m.userId)];
  const follows = await followsOf(user.id, people);
  const open = (userId: string) => follows.filter((f) => f.userId === userId && f.following && !f.private);
  const watching = (userId: string) => open(userId).map((f) => f.seasonId);
  // How far each is in what they watch openly (Where I am: followsOf has left out anyone who doesn't share it).
  const at = (userId: string) => Object.fromEntries(open(userId).map((f) => [f.seasonId, f.seen ?? 0]));

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
  // The couches' planned nights (step 11 part 3), with what's been read already; and Weekly Calls' moves (step 12 part 2), whose
  // calls aren't in a league's state for actionItems to see.
  const [plans, callMoves] = await Promise.all([plansFor(user.id, couchIds, new Date(), { members, schedules, headers }), weeklyCallMoves(user.id, myGames)]);
  // Who's set this week in your games with a weekly move, read after the moves so each state costs a hash; and each
  // game's state again (a hash each) for what its results ask of you.
  const [progress, states, early, seats, keeping] = await Promise.all([
    progressOf(user, myGames),
    leagueStates(myGames.filter((g) => g.seasonId).map((g) => g.leagueId)),
    pool.query(
      "SELECT season_id, early_seen, nudge_off_at IS NOT NULL AS nudge_off FROM show_follows WHERE user_id = $1 AND (early_seen IS NOT NULL OR nudge_off_at IS NOT NULL)",
      [user.id]
    ),
    pool.query("SELECT league_id, player_id FROM league_memberships WHERE user_id = $1", [user.id]),
    pool.query("SELECT season_id, keep_up, not_yet FROM show_follows WHERE user_id = $1 AND keep_up <> 'off'", [user.id]),
  ]);
  const KEEP_OFF = { keepUp: "off" as KeepUp, notYet: null };
  const keepUp = new Map(keeping.rows.map((r) => [r.season_id as string, { keepUp: r.keep_up as KeepUp, notYet: r.not_yet as number | null }]));
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
    // Off on a season you play: where you are moves with your games' reveals.
    const keeps = myGames.some((g) => g.seasonId === id) ? KEEP_OFF : (keepUp.get(id) ?? KEEP_OFF);
    const schedule = schedules.get(id);
    shows.push({
      ...header,
      following: follow?.following ?? false,
      private: follow?.private ?? false,
      // The hub's "you both watch" nudge was answered for this show (step 10).
      nudgeOff: nudged.has(id),
      // null: they see results straight away (spoiler protection off in Account settings).
      seenThrough: Number.isFinite(seen) ? seen : null,
      // How where you are keeps up (keep-up.ts), and Live's "Seen it?" episode when there's one to ask about.
      keepUp: keeps.keepUp,
      seenIt: Number.isFinite(seen) ? seenItAsk({ ...keeps, seen }, latestEnded(schedule, now)) : null,
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

  const theme = isTheme(face.rows[0]?.theme) ? face.rows[0].theme : DEFAULT_THEME;
  const res = NextResponse.json({
    user: {
      id: user.id,
      name: (user as { username?: string | null }).username || user.name,
      colour: (face.rows[0]?.colour as string | null) ?? null,
      picture: face.rows[0]?.picture == null ? null : Number(face.rows[0].picture),
      theme,
    },
    couches: couchRows.map((c) => ({
      id: c.id,
      name: c.name,
      yourRole: c.role,
      members: (members.get(c.id) ?? []).map((m) => ({
        userId: m.userId,
        name: m.name,
        role: m.role,
        joinedAt: m.joinedAt,
        colour: m.colour,
        picture: m.picture,
        watching: watching(m.userId),
        at: at(m.userId),
      })),
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
    moves: [...moves.items, ...callMoves],
    // The leagues you run's own to-dos: Backstage and the dot on a show's menu (step 5), never Tonight.
    backstage: moves.commish,
    // What you've hidden from the guide (step 11): shows here and TV listings; your own shows always show.
    guideHidden,
    // Your couches' planned nights still to come (step 11 part 3): the guide, a show's Tonight.
    plans,
    // The bell (step 15 part 2): how many notices are new since you last looked.
    notes: { unread: notes },
  });
  // An admin viewing as someone keeps their own device's theme.
  return isImpersonating(session) ? res : withThemeCookie(res, theme, req);
});

function gameOut(g: Game) {
  return { leagueId: g.leagueId, name: g.name, gameType: g.gameType, gameName: g.gameName, couchId: g.couchId, seasonId: g.seasonId, groupId: g.groupId, yourRole: g.yourRole, solo: g.solo, span: g.span, start: g.start };
}
