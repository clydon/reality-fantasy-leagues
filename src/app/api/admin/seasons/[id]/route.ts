import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { parseWikiUrl } from "@/lib/server/wiki-url";

type RouteParams = { id: string };

// Seasons are edited and deleted by their own id rather than nested under the show, since that's all
// the UI has to hand once a show's seasons are listed.
//
// `seasonNumber` is editable here, unlike a show's slug: a league references (show slug, season
// number), so renumbering CAN strand a league's settings.wikiSeason -- but a wrong season number is
// also the single most likely data-entry mistake, and leaving it uncorrectable would be worse. The
// response reports how many leagues point at the old number so the admin knows if they need to
// follow up.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { rows: existing } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.show_id, s.slug
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.id=$1`,
    [id]
  );
  if (!existing.length) throw new HttpError(404, "Season not found");

  const sets: string[] = [];
  const values: unknown[] = [id];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column}=$${values.length}`);
  };

  if ("seasonNumber" in body) {
    const n = Number(body.seasonNumber);
    if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "seasonNumber must be a positive whole number");
    push("season_number", n);
  }
  if ("name" in body) push("name", String(body.name || "").trim() || null);
  if ("status" in body) {
    const status = String(body.status);
    if (!["upcoming", "airing", "completed"].includes(status)) throw new HttpError(400, "status must be upcoming, airing or completed");
    push("status", status);
  }
  if ("castSize" in body) {
    const n = Number(body.castSize);
    push("cast_size", Number.isInteger(n) && n > 0 ? n : null);
  }
  if ("premiereDate" in body) push("premiere_date", body.premiereDate || null);
  if ("finaleDate" in body) push("finale_date", body.finaleDate || null);
  if ("wikiUrl" in body) {
    const wikiUrl = String(body.wikiUrl || "").trim() || null;
    if (wikiUrl) {
      const parsed = parseWikiUrl(wikiUrl);
      if (!parsed) throw new HttpError(400, "That doesn't look like a wiki page URL (expected something like https://survivor.fandom.com/wiki/Survivor_44)");
      push("wiki_url", wikiUrl);
      push("wiki_page_title", parsed.pageTitle);
    } else {
      push("wiki_url", null);
      push("wiki_page_title", null);
    }
  }
  // Allows correcting a derived title directly, for a wiki whose URL scheme and canonical page title
  // genuinely differ.
  if ("wikiPageTitle" in body) push("wiki_page_title", String(body.wikiPageTitle || "").trim() || null);

  if (!sets.length) throw new HttpError(400, "No editable fields supplied");

  const { rows } = await pool.query(
    `UPDATE show_seasons SET ${sets.join(", ")}, updated_at=now() WHERE id=$1
     RETURNING id, season_number, name, wiki_page_title, wiki_url, status, cast_size`,
    values
  );

  // Only worth reporting when the number actually moved.
  let leaguesOnOldNumber = 0;
  if ("seasonNumber" in body && Number(body.seasonNumber) !== existing[0].season_number) {
    const { rows: usage } = await pool.query(
      `SELECT count(*)::int AS n FROM leagues
        WHERE state->'settings'->>'showId' = $1
          AND (state->'settings'->>'wikiSeason')::int = $2`,
      [existing[0].slug, existing[0].season_number]
    );
    leaguesOnOldNumber = usage[0].n;
  }
  return NextResponse.json({ season: rows[0], leaguesOnOldNumber });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const { rows } = await pool.query(
    `SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  // A league pointing at this season keeps working for everything except the wiki connector, which
  // falls back to its own title guess -- so this warns rather than refuses, unlike deleting a show.
  const { rows: usage } = await pool.query(
    `SELECT count(*)::int AS n FROM leagues
      WHERE state->'settings'->>'showId' = $1 AND (state->'settings'->>'wikiSeason')::int = $2`,
    [rows[0].slug, rows[0].season_number]
  );
  await pool.query("DELETE FROM show_seasons WHERE id=$1", [id]);
  return NextResponse.json({ ok: true, leaguesAffected: usage[0].n });
});
