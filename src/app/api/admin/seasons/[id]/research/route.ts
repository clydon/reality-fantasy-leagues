import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { researchSeasonEpisode, RESEARCH_MODELS } from "@db/episode-research.js";

// On-demand episode research for one catalog season -- what the "Research ep N" button on each
// season row in Admin > Shows & Seasons calls. Super-admin only, like the rest of the catalog.
//
// The sibling of .../sync, and deliberately a separate route rather than a third `kind` on it,
// because the two do genuinely different things and fail in different ways:
//
//   sync     -- reads a known wiki page, extracts its tables. Whole season at once, cached on the
//               page's revision ids, reproducible.
//   research -- asks a web-searching model a checklist. ONE EPISODE at a time (a search is scoped to
//               an episode, and a season in progress then costs one episode a week), cached on
//               nothing but "we already asked", and not reproducible -- so every answer carries its
//               own sources and confidence for a human to check.
//
// Writes one row to `episode_research`, then stages its "yes" answers as pending season decisions
// (db/migrations/0019) -- the same list a wiki episodes pull feeds, reviewed once by an admin for
// every league. Nothing is APPLIED here. See db/episode-research.js's staging section for the
// checklist-to-event-type mapping.
//
// Slow by nature -- a live web search plus a long structured answer is tens of seconds, and a
// provider that can't search and answer in one call takes two round trips -- so this sets the
// platform's long-running ceiling, same as the wiki pull. A run that is cut off writes nothing.
export const maxDuration = 300;

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; force?: boolean; provider?: string; model?: string };
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");

  const { rows } = await pool.query(
    `SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  try {
    const run = await researchSeasonEpisode(pool, rows[0].slug, rows[0].season_number, episode, {
      force: body.force === true,
      // Whitelisted rather than passed through: this value picks which external API the server calls
      // with its own credentials, so it isn't something a request body gets to name freely.
      // A model choice (the admin UI's selector) is always a Claude model, so it implies Anthropic.
      ...(RESEARCH_MODELS.includes(String(body.model))
        ? { provider: "anthropic", model: String(body.model) }
        : { provider: PROVIDERS.includes(String(body.provider)) ? String(body.provider) : undefined }),
    });
    return NextResponse.json({
      showSlug: run.showSlug,
      season: run.season,
      episode: run.episodeNumber,
      cached: run.cached,
      payload: run.payload,
      provenance: run.provenance,
      problems: run.problems,
      counts: run.counts,
      decisions: run.decisions,
    });
  } catch (e) {
    // The researcher's errors are written for the person who clicked ("Google Search grounding has
    // NO free-tier quota... enable billing, or run with --provider=..."), so they're passed through
    // verbatim rather than flattened -- the admin reading this is exactly who can fix them.
    throw new HttpError(502, e instanceof Error ? e.message : "The research failed");
  }
});

const PROVIDERS = ["anthropic", "gemini", "grok"];
