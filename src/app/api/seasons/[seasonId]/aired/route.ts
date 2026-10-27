import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { seenThrough } from "@/lib/server/guard";
import { latestAired, seasonSchedules, stepEpisodes } from "@/lib/server/schedule";

// A season's aired episodes for the where stepper (watching/where.tsx): when each aired, so stepping says which one it is, and
// titles only as far as you've seen (a sport's always: its titles are the matchups, listed before each game). Open signed out
// (first run asks where you are before there's an account), where nobody has seen anything.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const [schedules, { rows }, seen] = await Promise.all([
    seasonSchedules([seasonId]),
    pool.query("SELECT s.kind FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]),
    session ? seenThrough(session.user.id, seasonId) : Promise.resolve(0),
  ]);
  const schedule = schedules.get(seasonId);
  if (!schedule || !rows.length) throw new HttpError(404, "Season not found");
  return NextResponse.json(
    { episodes: stepEpisodes(schedule.episodes, latestAired(schedule), seen, rows[0].kind ?? null) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
});
