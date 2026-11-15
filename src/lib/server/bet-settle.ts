import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { BetAnswer, LeagueState } from "@/lib/game/types";

// The AI settles side bets with an episode's final results (BACKLOG 87, the user's decision 2026-11-15). The research answers
// every open bet on the episode (db/episode-research.js openBetsFor: one request with the checklist) and stores the answers on
// the season's shared research row; here each game whose episode is at its final results takes them, bet by bet, matched by
// wording (BetLogic.key). The engine decides what a call settles and what stays open (BetLogic.settleByAI); whoever runs the
// game can change any mark, and once they have, the AI leaves that bet alone.
//
// Called by every season sync (season-decisions.ts syncLeagueDecisions), which is what every way results arrive ends in (the
// bot's runs, a couch's answer, the desk), and by a commissioner applying research to their own game. Inside the league's lock.

/** Settles the bets the research answers on each episode at its final results. Returns how many it marked and suggested. */
export async function settleBetsByResearch(
  client: PoolClient,
  state: LeagueState,
  key: { showId: string; season: number }
): Promise<{ settled: number; suggested: number }> {
  const out = { settled: 0, suggested: 0 };
  const due = state.episodes.filter(
    (ep) =>
      StateLogic.resultsStage(ep) === "final" &&
      StateLogic.episodeHasResults(ep) &&
      !ep.resultsHidden &&
      (ep.bets || []).some((b) => (b.predictions || []).length && StateLogic.BetLogic.aiMaySettle(b))
  );
  if (!due.length) return out;
  const { rows } = await client.query<{ n: number; answers: BetAnswer[] | null }>(
    `SELECT episode_number AS n, payload->'betAnswers' AS answers FROM episode_research
      WHERE show_id = $1 AND season_number = $2 AND source = 'combined' AND episode_number = ANY($3::int[])`,
    [key.showId, key.season, due.map((e) => e.number)]
  );
  const byEpisode = new Map(rows.map((r) => [r.n, new Map((Array.isArray(r.answers) ? r.answers : []).map((a) => [StateLogic.betKey(a.question), a]))]));
  const at = new Date().toISOString();
  for (const ep of due) {
    const answers = byEpisode.get(ep.number);
    if (!answers) continue;
    for (const bet of ep.bets || []) {
      const a = answers.get(StateLogic.betKey(bet.label));
      if (!a) continue;
      const r = StateLogic.settleBetByAI(state, ep.id, bet.id, a, at);
      if (r === "settled") out.settled++;
      else if (r === "suggested") out.suggested++;
    }
  }
  return out;
}
