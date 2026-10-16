import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { runForSeason, WIKI_MODELS } from "@db/wiki-sync.js";

// On-demand wiki pull for one catalog season -- what the "Pull cast" button on each season row in
// Admin > Shows & Seasons calls. The wiki is cast-only now: episode results come from research. Super-admin only, like the rest of the catalog.
//
// Scoped to a SEASON because that's the unit the work has: the wiki is read once for everyone
// playing it, and the row an admin is looking at here IS a season.
//
// Nothing is applied to any league by this. Same contract as the nightly job: a cast pull stages the
// cast for approval.
//
// The connector reads the wiki and then calls Claude, so this is a slow route by nature -- a few
// seconds, longer for a big cast. maxDuration is set to
// the platform's long-running ceiling rather than left at the default for that reason. An extraction
// that is cut off is never filed, and nothing is cached until it completes, so a timeout costs the
// model call and nothing else: clicking again re-runs it cleanly.
export const maxDuration = 300;

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const body = (await req.json().catch(() => ({}))) as { kind?: string; force?: boolean; model?: string };
  const kind = String(body.kind);
  if (kind !== "cast") throw new HttpError(400, 'kind must be "cast" -- episode results come from research now');

  const { rows } = await pool.query(
    `SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  try {
    // force: the connector skips the model entirely when every page's revision id matches the cached
    // extraction. That's the right default, but it makes "pull again" look like it did nothing after
    // a bad extraction, so the button offers the override.
    const result = await runForSeason(pool, rows[0].slug, rows[0].season_number, kind, {
      force: body.force === true,
      // Whitelisted: it picks what the server spends its own API credit on.
      model: WIKI_MODELS.includes(String(body.model)) ? String(body.model) : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    // The connector's own errors are written for a human to act on ("No cast section found on X;
    // looked for: ...; page has: ..."), so they're passed through verbatim rather than flattened
    // into a generic failure -- the admin who clicked is exactly who can fix them.
    throw new HttpError(502, e instanceof Error ? e.message : "The wiki pull failed");
  }
});
