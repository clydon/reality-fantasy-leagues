import StateLogic from "./state-logic.js";
import type { LeagueState } from "./types";

// What an episode's results ask of someone across their games on a season (docs/PLAN-new-design.md steps 2 and 8):
// the next episode to reveal (its results are in past their mark) and the morning update (the episode they revealed
// early whose final scores are in now). The show space's Episodes read (season-episodes.ts) and the hub's status line
// and Up next (/api/me/home) both work it out here, so they always agree. Pure, for the tests. It says only that
// results are in and at which stage, never what they are: that's not a spoiler.

/** An episode's stage across these games: early if any of them only has its early results; null when none has any. */
export function stageAcross(states: LeagueState[], n: number): "early" | "final" | null {
  let stage: "early" | "final" | null = null;
  for (const s of states) {
    const st = StateLogic.resultsStage(s.episodes.find((e) => e.number === n));
    if (st === "early") return "early";
    if (st) stage = "final";
  }
  return stage;
}

/** The last episode with results in any of these games. */
export const latestIn = (states: LeagueState[]) => Math.max(0, ...states.map((s) => StateLogic.SpoilerLogic.latestWithResults(s)));

export interface ResultsDue {
  /** The first episode past your mark whose results are in, and how far they are. */
  reveal: { episode: number; stage: "early" | "final" } | null;
  /** The episode you revealed early whose final scores have landed since. */
  final: { episode: number } | null;
}

/**
 * `mark`: the last episode you've seen (Infinity when you see everything as it lands); `earlySeen`: show_follows'
 * early_seen, the episode you revealed while only its early results were in.
 */
export function resultsDue(states: LeagueState[], mark: number, earlySeen: number | null | undefined): ResultsDue {
  let reveal: ResultsDue["reveal"] = null;
  if (Number.isFinite(mark)) {
    const latest = latestIn(states);
    for (let n = mark + 1; n <= latest && !reveal; n++) {
      const stage = stageAcross(states, n);
      if (stage) reveal = { episode: n, stage };
    }
  }
  const final = earlySeen && earlySeen <= mark && stageAcross(states, earlySeen) === "final" ? { episode: earlySeen } : null;
  return { reveal, final };
}
