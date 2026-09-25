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
    `SELECT ss.id, ss.season_number, ss.cast_approved_at, s.slug, s.castaway_term, s.tribe_term
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
    leagueCount: usage[0].n,
    castawayTerm: season.castaway_term,
    tribeTerm: season.tribe_term,
  });
});

// Review edits. Deliberately only what reviewing a cast needs, rather than a general row editor:
//
//   clearTribes -- strip every starting tribe. For a league catching up from episode 0 the tribe
//                  division is itself something the premiere reveals, so an ungrouped cast is the
//                  spoiler-free way to hand one over.
//   remove      -- drop one row the extraction shouldn't have produced (a host, a stray table row).
//
// Either edit un-approves the season: what leagues would receive is no longer what was approved.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  await loadSeason(id);

  const body = (await req.json().catch(() => ({}))) as { clearTribes?: boolean; remove?: string };

  if (body.clearTribes) {
    await pool.query("UPDATE season_cast SET tribe_name=NULL WHERE season_id=$1", [id]);
  } else if (body.remove) {
    if (!isUuid(body.remove)) throw new HttpError(400, "remove must be a cast row id");
    await pool.query("DELETE FROM season_cast WHERE id=$1 AND season_id=$2", [body.remove, id]);
  } else {
    throw new HttpError(400, "Nothing to change — pass clearTribes or remove");
  }

  await pool.query("UPDATE show_seasons SET cast_approved_at=NULL, cast_approved_by=NULL, updated_at=now() WHERE id=$1", [id]);
  return NextResponse.json({ cast: await seasonCastRows(id), approvedAt: null });
});
