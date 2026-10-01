import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { suggestAnswer } from "@db/embeddings.js";
import { storedBetAnswer } from "@db/episode-research.js";

// A suggested answer for one side bet, to speed up grading. Commissioner-only, like grading itself
// (bets/[betId]/route.ts's PATCH) -- it changes how fast grading goes, not who can do it.
//
// Two sources, best first:
//
//   1. The episode's research settled this bet directly. Research is handed every open bet on the
//      episode (db/episode-research.js's openBetsFor) and answers them from the pages it read, with
//      which guesses are right -- including "no, nobody played an idol" and "the person voted out was
//      a woman", which searching notes can't answer. Matched by the bet's wording.
//   2. Otherwise (a bet made after its episode was researched), semantic search over the research
//      notes (db/embeddings.js): the closest note, verbatim, with a confidence, or nothing if nothing
//      is close enough. Re-running the episode's research settles the bet properly.
//
// Neither ever grades anything: the UI shows the suggestion, and the commissioner decides.
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
  if (!bet) throw new HttpError(404, "Prediction not found");

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

  const where = { showId: showRows[0].id, season: Number(season), episodeNumber: ep.number };
  const stored = await storedBetAnswer(pool, { ...where, label: bet.label });
  if (stored.answer) {
    const a = stored.answer;
    return NextResponse.json({
      status: a.answer ? "ok" : "unconfident",
      source: "research",
      answer: a.answer,
      confidence: a.answer ? a.confidence : null,
      castawayName: null,
      similarity: null,
      correctGuesses: a.correctGuesses,
      evidence: a.evidence,
      sources: a.sources,
    });
  }

  try {
    const result = await suggestAnswer(pool, { ...where, question: bet.label });
    // Researched, but not asked about this bet: it was made (or reworded) after the research ran.
    return NextResponse.json({ ...result, source: "search", askedAfterResearch: stored.researched });
  } catch (e) {
    // A missing embedding key or a transient API error is a real answer for the UI to show ("can't
    // check right now"), not a 500 -- same reasoning as the research route passing its own errors
    // through verbatim rather than flattening them.
    throw new HttpError(502, e instanceof Error ? e.message : "Could not compute a suggested answer");
  }
});
