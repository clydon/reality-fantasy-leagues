import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { researchFromPasteForLeague } from "@db/episode-research.js";
import { episodeResearchPanel, researchableEpisode } from "@/lib/server/episode-research-panel";

// A commissioner's episode research (docs/PLAN-episode-research-compiled-cache.md) -- for a league no
// admin is researching, typically on a self-serve show. Commissioner-only.
//
//   GET  -- the panel: who this episode's stored research already settles, the paste prompt narrowed to
//           who it doesn't (none if nobody), and everything staged for the episode. Writes nothing.
//           `?again=1`: the prompt asks about everyone, to research the episode again and fill gaps.
//   POST -- `{ notes, again? }`: the chat's JSON answer to that prompt. Merged into the episode's stored
//           research and staged as season decisions -- the shared cache, which the next league on the
//           season reads. Changes NO league: applying is .../research/apply, this league's own step.
//
// JSON only, so it's free: no model call on the site's key (see leagueResearchStatus).

async function leagueState(leagueId: string) {
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  return rows[0].state;
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const state = await leagueState(leagueId);
  const ep = researchableEpisode(state, epId);
  const again = new URL(req.url).searchParams.get("again") === "1";
  return NextResponse.json(await episodeResearchPanel(leagueId, state, ep.number, { again }));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { notes, again } = (await req.json().catch(() => ({}))) as { notes?: unknown; again?: unknown };
  if (typeof notes !== "string" || !notes.trim()) throw new HttpError(400, "Paste the chat's answer first.");
  const state = await leagueState(leagueId);
  const ep = researchableEpisode(state, epId);

  let problems: string[] = [];
  try {
    const run = await researchFromPasteForLeague(pool, leagueId, ep.number, notes, { again: again === true });
    problems = run.problems;
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "That answer couldn't be read.");
  }
  return NextResponse.json({ ...(await episodeResearchPanel(leagueId, state, ep.number)), problems });
});
