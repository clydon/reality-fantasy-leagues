import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { buildPasteImportPrompt } from "@db/episode-research.js";

// Read-only: assembles the text an admin copies into their own web-searching AI chat (ChatGPT,
// Claude.ai, Gemini -- whatever they already have, no API key needed) for one episode, so they can
// get the same checklist this app would pay to research, for free, and paste the answer back into
// POST .../research's `notes` field. See db/episode-research.js's "manual / paste import" section.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const episode = Number(new URL(req.url).searchParams.get("episode"));
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");

  const { rows } = await pool.query(
    `SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  try {
    const result = await buildPasteImportPrompt(pool, rows[0].slug, rows[0].season_number, episode);
    return NextResponse.json(result);
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Couldn't build the prompt");
  }
});
