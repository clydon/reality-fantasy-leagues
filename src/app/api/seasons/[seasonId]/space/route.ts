import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { couchMembers, healCouches, requireCouch } from "@/lib/server/couches";
import { seenThrough } from "@/lib/server/guard";
import { followsOf, games, playersOf, seasonHeaders } from "@/lib/server/show-space";
import { latestAired, seasonSchedules, upNext } from "@/lib/server/schedule";

// A show space's frame (docs/PLAN-new-design.md step 0b; the screens are steps 0d and 1): the show bar's
// header, the schedule (Up next, the episodes and when they air), where you are, and the games on it, with
// `?couch=` that couch's games and people (who plays which, who watches it), else just your own games.
//
// Spoiler-safe through guard.ts: no results, only air times, titles and your own progress. Someone's follow
// shows only if they share it; nobody else's progress is sent.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  await healCouches(user.id);

  // A couch's games here, and your own solo games (a public pool, a practice couch: step 9 part 3) after them.
  const gamesHere = await games(user.id, couchId ? { couchIds: [couchId], seasonId, withSolo: true } : { mine: true, seasonId });
  const [schedules, seen, { rows: follow }] = await Promise.all([
    seasonSchedules([seasonId]),
    seenThrough(user.id, seasonId),
    pool.query("SELECT following, private FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]),
  ]);
  const schedule = schedules.get(seasonId);

  let people = null;
  if (couchId) {
    const members = (await couchMembers([couchId])).get(couchId) ?? [];
    const [follows, players] = await Promise.all([followsOf(user.id, members.map((m) => m.userId)), playersOf(gamesHere.map((g) => g.leagueId))]);
    people = members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: m.role,
      watching: follows.some((f) => f.userId === m.userId && f.seasonId === seasonId && f.following && (!f.private || m.userId === user.id)),
      playing: gamesHere.filter((g) => players.get(g.leagueId)?.includes(m.userId)).map((g) => g.leagueId),
    }));
  }

  const now = new Date();
  return NextResponse.json({
    ...header,
    couchId,
    you: {
      following: follow[0]?.following ?? false,
      private: follow[0]?.private ?? false,
      // null: they see results straight away (spoiler protection off in Account settings).
      seenThrough: Number.isFinite(seen) ? seen : null,
    },
    schedule: schedule
      ? { release: schedule.release, dropAt: schedule.dropAt, airTz: schedule.airTz, upNext: upNext(schedule, now), latestAired: latestAired(schedule, now), episodes: schedule.episodes }
      : null,
    games: gamesHere,
    people,
  });
});
