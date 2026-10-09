import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { seasonCastRows, applyApprovedCastToLeagues, renameInSeasonDecisions } from "@/lib/server/season-cast";

// The season's staged cast, as Admin > Shows & Seasons reviews it before approving (db/migrations/
// 0011). GET reads it; PATCH is the small set of edits that review actually needs.
type RouteParams = { id: string };

async function loadSeason(id: string) {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.cast_approved_at, ss.tribes_from_episode, ss.cast_locked_at,
            ss.cast_tribes_confirmed, ss.cast_created_by_league, l.name AS created_by_league_name,
            s.slug, s.castaway_term, s.tribe_term
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN leagues l ON l.id = ss.cast_created_by_league
      WHERE ss.id=$1`,
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

  // Who made the cast and what's happened to it since (db/migrations/0055): every change reaches every
  // league on the season, so the admin sees the trail.
  const { rows: changes } = await pool.query(
    `SELECT c.field, c.before, c.after, c.changed_at AS "changedAt", u.username AS "by", l.name AS "byLeague"
       FROM season_cast_changes c
       LEFT JOIN "user" u ON u.id = c.changed_by
       LEFT JOIN leagues l ON l.id = c.by_league
      WHERE c.season_id=$1 ORDER BY c.changed_at DESC LIMIT 50`,
    [id]
  );

  return NextResponse.json({
    cast: await seasonCastRows(id),
    approvedAt: season.cast_approved_at,
    tribesFromEpisode: season.tribes_from_episode,
    leagueCount: usage[0].n,
    castawayTerm: season.castaway_term,
    tribeTerm: season.tribe_term,
    createdByLeague: season.cast_created_by_league ? { id: season.cast_created_by_league, name: season.created_by_league_name } : null,
    lockedAt: season.cast_locked_at,
    tribesConfirmed: season.cast_tribes_confirmed,
    changes,
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
//
//   rename / photo / tribe -- { id, name } / { id, photoUrl } / { id, tribeName }: fix one person
//                        (docs/PLAN-universal-season-cast.md). These DON'T un-approve: on an approved
//                        cast they reach every league on the season at once, in place, through the link
//                        (castaway.seasonCastId; StateLogic.syncSeasonCast). A starting tribe still
//                        honours the tribes hold.
//
// Every edit is logged in season_cast_changes, since every edit can reach every league.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const season = await loadSeason(id);

  const body = (await req.json().catch(() => ({}))) as {
    tribesFromEpisode?: number | null;
    remove?: string;
    rename?: { id?: string; name?: string };
    photo?: { id?: string; photoUrl?: string | null };
    tribe?: { id?: string; tribeName?: string | null };
  };
  const log = (seasonCastId: string | null, field: string, before: string | null, after: string | null) =>
    pool.query(
      `INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, seasonCastId, field, before, after, user.id]
    );

  const edit = body.rename ? "rename" : body.photo ? "photo" : body.tribe ? "tribe" : null;
  if (edit) {
    const target = (body.rename || body.photo || body.tribe)!;
    if (!target.id || !isUuid(target.id)) throw new HttpError(400, `${edit}.id must be a cast row id`);
    const { rows: before } = await pool.query(
      `SELECT name, photo_url, tribe_name FROM season_cast WHERE id=$1 AND season_id=$2`,
      [target.id, id]
    );
    if (!before.length) throw new HttpError(404, "Not in this season's cast");
    try {
      if (body.rename) {
        const name = String(body.rename.name ?? "").trim();
        if (!name) throw new HttpError(400, "A name can't be empty");
        await pool.query("UPDATE season_cast SET name=$2 WHERE id=$1", [target.id, name]);
        await renameInSeasonDecisions(pool, id, before[0].name, name);
        await log(target.id, "name", before[0].name, name);
      } else if (body.photo) {
        const url = String(body.photo.photoUrl ?? "").trim() || null;
        await pool.query("UPDATE season_cast SET photo_url=$2 WHERE id=$1", [target.id, url]);
        await log(target.id, "photo", before[0].photo_url, url);
      } else if (body.tribe) {
        const tribe = String(body.tribe.tribeName ?? "").trim() || null;
        await pool.query("UPDATE season_cast SET tribe_name=$2 WHERE id=$1", [target.id, tribe]);
        await log(target.id, "tribe", before[0].tribe_name, tribe);
      }
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new HttpError(409, "Someone in this season's cast already has that name");
      throw e;
    }
    const cast = await seasonCastRows(id);
    const applied = season.cast_approved_at
      ? await applyApprovedCastToLeagues(season.slug, season.season_number, cast, season.tribes_from_episode ?? null)
      : [];
    return NextResponse.json({ cast, approvedAt: season.cast_approved_at, tribesFromEpisode: season.tribes_from_episode, applied });
  }

  if ("tribesFromEpisode" in body) {
    const hold = body.tribesFromEpisode;
    if (hold !== null && (!Number.isInteger(hold) || (hold as number) < 1)) {
      throw new HttpError(400, "tribesFromEpisode must be a positive whole number, or null to send tribes with the cast");
    }
    // An admin answering is an answer: a league-created cast stops asking its commissioner (0055).
    await pool.query("UPDATE show_seasons SET tribes_from_episode=$2, cast_tribes_confirmed=true, updated_at=now() WHERE id=$1", [id, hold]);
    await log(null, "tribes_hold", season.tribes_from_episode == null ? null : String(season.tribes_from_episode), hold == null ? null : String(hold));
  } else if (body.remove) {
    if (!isUuid(body.remove)) throw new HttpError(400, "remove must be a cast row id");
    const { rows: gone } = await pool.query("DELETE FROM season_cast WHERE id=$1 AND season_id=$2 RETURNING name", [body.remove, id]);
    if (gone.length) await log(body.remove, "removed", gone[0].name, null);
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
