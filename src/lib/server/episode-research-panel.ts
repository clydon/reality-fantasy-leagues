import StateLogic from "@/lib/game/state-logic.js";
import type { Episode, EpisodeResearchPanel, LeagueState } from "@/lib/game/types";
import { leagueResearchStatus } from "@db/episode-research.js";
import { pool, HttpError } from "./db";
import { inLeague, stagedForEpisode } from "./episode-research-apply";

/** The league's episode by its in-state id, refused where a commissioner may not research it. */
export function researchableEpisode(state: LeagueState, epId: string): Episode {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep) throw new HttpError(404, "Episode not found");
  // A catching-up league gets an episode's results when it reveals it (the season sync is gated the
  // same way); results applied ahead of that would land in state unrevealed.
  const revealed = StateLogic.RevealLogic.revealedThrough(state);
  if (revealed !== null && ep.number > revealed) {
    throw new HttpError(400, `Reveal episode ${ep.number} first — this league is catching up, and its results come in when it's revealed.`);
  }
  return ep;
}

// What the commissioner's per-episode research panel shows (docs/PLAN-episode-research-compiled-cache.md,
// piece 6): coverage first, then the prompt if anyone's left to ask about, then everything staged for
// the episode from any source -- each marked with whether it's already in this league.
export async function episodeResearchPanel(leagueId: string, state: LeagueState, episodeNumber: number): Promise<EpisodeResearchPanel> {
  let status;
  try {
    status = await leagueResearchStatus(pool, leagueId, episodeNumber);
  } catch (e) {
    // The research layer's errors are written for the person who clicked ("set the show and season
    // first", "enter the cast first") -- passed through, as the admin research route does.
    throw new HttpError(400, e instanceof Error ? e.message : "Couldn't read this episode's research");
  }
  const staged = status.ctx.seasonId ? await stagedForEpisode(pool, status.ctx.seasonId, episodeNumber) : [];
  return {
    episodeNumber,
    showName: status.ctx.showName,
    season: status.ctx.season,
    coverage: status.coverage,
    prompt: status.prompt,
    betCount: status.betCount,
    staged: staged.map((d) => ({ ...d, inLeague: inLeague(state, episodeNumber, d) })),
  };
}
