import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { seasonCastRows } from "@/lib/server/season-cast";

// The season's staged cast, as Admin > Shows & Seasons reviews it before approving (db/migrations/
// 0011). GET reads it; PATCH is the small set of edits that review actually needs.
type RouteParams = { id: string };

async function loadSeason(id: string) {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.cast_approved_at, ss.tribes_from_episode,
            s.slug, s.castaway_term, s.tribe_term
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const season = await loadSeason(id);

  // How many leagues an approval would reach, so the admin knows what the button is about to do.
  const { rows: usage } = await pool.query(
    `SELECT count(*)::int AS n FROM leagues
      WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2`,
    [season.slug, String(season.season_number)]
  );

  return NextResponse.json({
    cast: await seasonCastRows(id),
    approvedAt: season.cast_approved_at,
    tribesFromEpisode: season.tribes_from_episode,
    leagueCount: usage[0].n,
    castawayTerm: season.castaway_term,
    tribeTerm: season.tribe_term,
  });
});

// Review edits. Deliberately only what reviewing a cast needs, rather than a general row editor:
//
//   tribesFromEpisode -- HOLD the starting tribes until a catching-up league has revealed that
//                        episode (1 = the premiere), or null to send them with the cast. This
//                        replaced a "clear all tribes" button that deleted them outright: the
//                        intent was always "don't show the division before the premiere does", and
//                        deleting meant the tribes never arrived for anyone, however far a league
//                        progressed. See db/migrations/0013 and tribesDue.
//   remove            -- drop one row the extraction shouldn't have produced (a host, a stray row).
//
// Either edit un-approves the season: what leagues would receive is no longer what was approved.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  await loadSeason(id);

  const body = (await req.json().catch(() => ({}))) as { tribesFromEpisode?: number | null; remove?: string };

  if ("tribesFromEpisode" in body) {
    const hold = body.tribesFromEpisode;
    if (hold !== null && (!Number.isInteger(hold) || (hold as number) < 1)) {
      throw new HttpError(400, "tribesFromEpisode must be a positive whole number, or null to send tribes with the cast");
    }
    await pool.query("UPDATE show_seasons SET tribes_from_episode=$2, updated_at=now() WHERE id=$1", [id, hold]);
  } else if (body.remove) {
    if (!isUuid(body.remove)) throw new HttpError(400, "remove must be a cast row id");
    await pool.query("DELETE FROM season_cast WHERE id=$1 AND season_id=$2", [body.remove, id]);
  } else {
    throw new HttpError(400, "Nothing to change — pass tribesFromEpisode or remove");
  }

  await pool.query("UPDATE show_seasons SET cast_approved_at=NULL, cast_approved_by=NULL, updated_at=now() WHERE id=$1", [id]);
  const { rows: after } = await pool.query("SELECT tribes_from_episode FROM show_seasons WHERE id=$1", [id]);
  return NextResponse.json({
    cast: await seasonCastRows(id),
    approvedAt: null,
    tribesFromEpisode: after[0].tribes_from_episode,
  });
});
