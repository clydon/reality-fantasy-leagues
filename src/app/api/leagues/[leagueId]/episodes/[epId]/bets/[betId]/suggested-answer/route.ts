import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { suggestAnswer } from "@db/embeddings.js";

// A semantic-search suggestion for one side bet, drawn from episode_text_chunks
// (db/migrations/0016_episode_text_embeddings.sql). Commissioner-only, like grading itself
// (bets/[betId]/route.ts's PATCH) -- this exists to speed up grading, not to change who can do it.
//
// A bet's `label` is arbitrary prose a member wrote ("Will Jenna find an idol?"), with no fixed set
// of candidate answers the way episode_research_items' checklist fields have -- that's exactly the
// gap semantic search fills and a structured lookup can't: it embeds the label, searches this
// episode's research chunks, and reports the closest one verbatim with a confidence, or says outright
// that nothing matched well enough to trust. It never invents an answer -- see db/embeddings.js's
// file header for why that's the one rule this can't bend.
//
// GET, not part of the bet's own payload: computing it costs one embedding call (cheap, but not
// free, and not needed at all for a bet nobody has opened to grade yet), so it's fetched on demand
// by the grading UI rather than joined into every episode-card render.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; betId: string }> }) => {
  const { leagueId, epId, betId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  // No isUuid guard on epId/betId: both are Core.uid()'s own short ids ("ep_ab12cd", "bet_cd34ef"),
  // not UUIDs -- a malformed one simply fails to .find() below and reports 404, same as everywhere
  // else in this app that looks an in-state id up rather than a database row.
  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!leagueRows.length) throw new HttpError(404, "League not found");
  const state = leagueRows[0].state;

  const ep = (state.episodes || []).find((e: { id: string }) => e.id === epId);
  if (!ep) throw new HttpError(404, "Episode not found");
  const bet = (ep.bets || []).find((b: { id: string }) => b.id === betId);
  if (!bet) throw new HttpError(404, "Bet not found");

  const settings = state.settings || {};
  const showSlug = settings.showId;
  const season = settings.wikiSeason;
  if (!showSlug || !season) {
    return NextResponse.json({ status: "no-research", answer: null, confidence: null, castawayName: null, similarity: null });
  }
  const { rows: showRows } = await pool.query("SELECT id FROM shows WHERE slug=$1", [showSlug]);
  if (!showRows.length) {
    return NextResponse.json({ status: "no-research", answer: null, confidence: null, castawayName: null, similarity: null });
  }

  try {
    const result = await suggestAnswer(pool, {
      showId: showRows[0].id,
      season: Number(season),
      episodeNumber: ep.number,
      question: bet.label,
    });
    return NextResponse.json(result);
  } catch (e) {
    // A missing embedding key or a transient API error is a real answer for the UI to show ("can't
    // check right now"), not a 500 -- same reasoning as the research route passing its own errors
    // through verbatim rather than flattening them.
    throw new HttpError(502, e instanceof Error ? e.message : "Could not compute a suggested answer");
  }
});
