import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { parseWikiUrl } from "@/lib/server/wiki-url";

// Adds a season to a show. The wiki URL is the friendly input: paste what's in the browser address
// bar and the API endpoint + page title are derived from it (see src/lib/server/wiki-url.ts for why
// that's the input rather than asking for both pieces).
//
// Deriving the show's wiki_api_url from the first season's URL means an admin who created the show
// without one doesn't have to go back and fill it in -- the connector needs it, and the season URL
// already contains it.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Show not found");

  const body = (await req.json().catch(() => ({}))) as {
    seasonNumber?: number;
    name?: string;
    wikiUrl?: string;
    status?: string;
    castSize?: number;
    premiereDate?: string;
    finaleDate?: string;
  };
  const seasonNumber = Number(body.seasonNumber);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) throw new HttpError(400, "seasonNumber must be a positive whole number");

  const { rows: showRows } = await pool.query("SELECT id, wiki_api_url FROM shows WHERE id=$1", [id]);
  if (!showRows.length) throw new HttpError(404, "Show not found");

  const wikiUrl = (body.wikiUrl || "").trim() || null;
  let parsed = null;
  if (wikiUrl) {
    parsed = parseWikiUrl(wikiUrl);
    // Reject rather than store something unusable: the connector would otherwise fail later with a
    // far less obvious message.
    if (!parsed) throw new HttpError(400, "That doesn't look like a wiki page URL (expected something like https://survivor.fandom.com/wiki/Survivor_44)");
  }

  const status = ["upcoming", "airing", "completed"].includes(String(body.status)) ? String(body.status) : "completed";
  const castSize = Number.isInteger(Number(body.castSize)) && Number(body.castSize) > 0 ? Number(body.castSize) : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO show_seasons
         (show_id, season_number, name, wiki_page_title, wiki_url, status, cast_size, premiere_date, finale_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, season_number, name, wiki_page_title, wiki_url, status, cast_size`,
      [
        id,
        seasonNumber,
        (body.name || "").trim() || null,
        parsed ? parsed.pageTitle : null,
        wikiUrl,
        status,
        castSize,
        body.premiereDate || null,
        body.finaleDate || null,
      ]
    );
    // Backfill the show's API endpoint from this season's URL if it didn't have one.
    if (parsed && !showRows[0].wiki_api_url) {
      await pool.query("UPDATE shows SET wiki_api_url=$2, updated_at=now() WHERE id=$1", [id, parsed.apiUrl]);
    }
    return NextResponse.json({ season: rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new HttpError(409, `Season ${seasonNumber} already exists for this show`);
    }
    throw e;
  }
});
