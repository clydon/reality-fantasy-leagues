import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { researchSeasonEpisode, researchFromPaste, RESEARCH_MODELS } from "@db/episode-research.js";
import { episodeAirsAt, episodeCountOf } from "@db/auto-research.js";
import { formatInTz } from "@/lib/game/air-schedule.js";

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

  const body = (await req.json().catch(() => ({}))) as {
    episode?: unknown;
    force?: boolean;
    provider?: string;
    model?: string;
    notes?: string;
    structured?: boolean;
  };
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");

  const { rows } = await pool.query(
    `SELECT ss.season_number, ss.air_tz, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  const episodeCount = await episodeCountOf(pool, id);
  if (episodeCount && episode > episodeCount) {
    throw new HttpError(400, `This season has ${episodeCount} episodes — there's no episode ${episode}.`);
  }

  // Nothing to find about an episode that hasn't aired -- and a search (or a pasted answer) would
  // happily describe the previous week's episode instead. Only refused when the air time is known.
  const airsAt = await episodeAirsAt(pool, id, episode);
  if (airsAt && airsAt.getTime() > Date.now()) {
    throw new HttpError(400, `Episode ${episode} hasn't aired yet — it airs ${formatInTz(airsAt, rows[0].air_tz)}.`);
  }

  // Pasted notes: the admin already did their own (free) search elsewhere and is handing back the
  // result. Prose costs one small, non-search model call to fit it to the schema; `structured` JSON
  // is parsed directly and costs nothing -- see db/episode-research.js's "manual / paste import".
  if (typeof body.notes === "string" && body.notes.trim()) {
    try {
      const run = await researchFromPaste(pool, rows[0].slug, rows[0].season_number, episode, body.notes, {
        model: RESEARCH_MODELS.includes(String(body.model)) ? String(body.model) : undefined,
        structured: body.structured === true,
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
      throw new HttpError(502, e instanceof Error ? e.message : "Structuring the pasted notes failed");
    }
  }

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

// Throw away one episode's research -- for a run that shouldn't have happened (researched before the
// episode aired, so whatever it found is about an earlier one). Removes the stored answers, their
// search index, and the results they staged that nobody has decided yet; a result the wiki also
// reported stays, minus the research's claim to it. Anything already accepted or rejected is kept:
// that decision is history, and undoing it is a separate, deliberate click.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const search = new URL(req.url).searchParams;
  const episode = Number(search.get("episode"));
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");
  // scope=all: clear the episode entirely -- also its undecided wiki results and its entry in the
  // cached wiki read (so a re-pull reads it fresh instead of restaging the bad version).
  const all = search.get("scope") === "all";

  const { rows } = await pool.query("SELECT show_id, season_number FROM show_seasons WHERE id=$1", [id]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const { show_id: showId, season_number: season } = rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount: removed } = await client.query(
      all
        ? `DELETE FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND status='pending'`
        : `DELETE FROM season_decisions
            WHERE season_id=$1 AND episode_number=$2 AND status='pending' AND from_research AND NOT from_wiki`,
      [id, episode]
    );
    if (all) {
      await client.query(
        `UPDATE wiki_extractions
            SET payload = jsonb_set(payload, '{episodes}', COALESCE(
              (SELECT jsonb_agg(e) FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int <> $3),
              '[]'::jsonb))
          WHERE show_id=$1 AND season_number=$2 AND kind='episodes'`,
        [showId, season, episode]
      );
      await client.query("DELETE FROM auto_research_attempts WHERE season_id=$1 AND episode_number=$2", [id, episode]);
    }
    await client.query(
      `UPDATE season_decisions SET from_research=false, research_id=NULL, sources='{}'
        WHERE season_id=$1 AND episode_number=$2 AND status='pending' AND from_research`,
      [id, episode]
    );
    await client.query("DELETE FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number=$3", [
      showId,
      season,
      episode,
    ]);
    await client.query("DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3", [
      showId,
      season,
      episode,
    ]);
    await client.query("COMMIT");
    const { rows: decided } = await client.query(
      "SELECT count(*)::int AS n FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND status<>'pending'",
      [id, episode]
    );
    return NextResponse.json({ ok: true, removedResults: removed ?? 0, decidedKept: decided[0].n });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
