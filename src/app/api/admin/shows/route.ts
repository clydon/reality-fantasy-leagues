import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Super-admin view of the show catalog: every show including archived ones, each with its seasons
// and a count of how many leagues reference it. That count is what makes archive-vs-delete an
// informed choice rather than a guess -- see the DELETE handler below.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const { rows } = await pool.query(
    `SELECT s.id, s.slug, s.name, s.castaway_term, s.tribe_term, s.wiki_api_url, s.cast_section_heading, s.research_domains,
            s.archived, s.created_at,
            (SELECT count(*)::int FROM leagues l WHERE l.state->'settings'->>'showId' = s.slug) AS league_count,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ss.id, 'seasonNumber', ss.season_number, 'name', ss.name,
                  'wikiPageTitle', ss.wiki_page_title, 'wikiUrl', ss.wiki_url,
                  'status', ss.status, 'castSize', ss.cast_size,
                  'premiereDate', ss.premiere_date, 'finaleDate', ss.finale_date,
                  -- Where the season is in its pipeline (cast -> episodes), so the admin row can show
                  -- state and the next step instead of a row of equal-looking buttons.
                  'castStaged', (SELECT count(*)::int FROM season_cast sc WHERE sc.season_id = ss.id),
                  'castApprovedAt', ss.cast_approved_at,
                  'wikiEpisodesThrough', (
                    SELECT max((e->>'number')::int)
                      FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
                     WHERE we.show_id = s.id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                  ),
                  'pendingDecisions', (SELECT count(*)::int FROM season_decisions d WHERE d.season_id = ss.id AND d.status = 'pending'),
                  'researchedEpisodes', COALESCE((
                    SELECT json_agg(er.episode_number ORDER BY er.episode_number)
                      FROM episode_research er
                     WHERE er.show_id = s.id AND er.season_number = ss.season_number
                  ), '[]'::json)
                ) ORDER BY ss.season_number DESC
              ) FILTER (WHERE ss.id IS NOT NULL),
              '[]'
            ) AS seasons
       FROM shows s
       LEFT JOIN show_seasons ss ON ss.show_id = s.id
      GROUP BY s.id
      ORDER BY s.archived, s.name`
  );
  return NextResponse.json({ shows: rows });
});

// Slug is what leagues store in settings.showId, so it's derived once here and never editable
// afterwards -- changing it later would orphan every league pointing at the old value.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const POST = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    castawayTerm?: string;
    tribeTerm?: string;
    wikiApiUrl?: string;
    castSectionHeading?: string;
  };
  const name = (body.name || "").trim();
  if (!name) throw new HttpError(400, "name required");
  const slug = slugify(name);
  if (!slug) throw new HttpError(400, "name must contain at least one letter or number");

  try {
    const { rows } = await pool.query(
      `INSERT INTO shows (slug, name, castaway_term, tribe_term, wiki_api_url, cast_section_heading)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, slug, name`,
      [
        slug,
        name,
        (body.castawayTerm || "").trim() || "Castaway",
        (body.tribeTerm || "").trim() || "Tribe",
        (body.wikiApiUrl || "").trim() || null,
        // Null is the normal case: wiki-sync infers the heading from castawayTerm and only needs
        // telling when a wiki calls the section something unguessable.
        (body.castSectionHeading || "").trim() || null,
      ]
    );
    return NextResponse.json({ show: rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new HttpError(409, `A show with the slug "${slug}" already exists`);
    }
    throw e;
  }
});
