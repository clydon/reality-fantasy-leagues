import type { EpisodeResearchPanel, LeagueState, ResearchApplySummary, StagedResearchDecision } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TOUR_SHOW_NAME, buildTourState, closeEpisode, planEpisode } from "./rise-and-fall";

// The commissioner's tour on *Rise & Fall* (docs/PLAN-guided-tour.md, "Commissioner path"): the same
// season as the player's, but you run it. You create the league (prefilled), copy its code, start the
// draft with Ben and Kat already in as computer players, and then do the commissioner's weekly job:
// Episode 1's results come in from research, and you check them and apply them to the league.
//
// The results are the player path's (planEpisode), staged instead of written: a research run "found"
// them, and nothing reaches the league until you apply. Applying uses the engine's own import steps,
// the ones the server's apply route runs (episode-research-apply.ts), so the scores are real.

/** The join code the tour's league shows. Nothing is sent: it joins nothing. */
export const TOUR_JOIN_CODE = "RISE24";

/** Your league the moment you create it: Ben and Kat in as computer players, the draft not started. */
export function buildCommissionerState(): LeagueState {
  const state = buildTourState();
  state.draftForceStarted = false;
  return state;
}

/** Episode `n`'s results as a research run would stage them: who won, the bottom two, who went home.
 *  The partner in the bottom two comes from one source only, so there's something to check. */
export function stageResults(state: LeagueState, n: number): StagedResearchDecision[] {
  const plan = planEpisode(state, n);
  const name = (id: string) => StateLogic.getCastaway(state, id)?.name ?? id;
  const row = (i: number, d: Partial<StagedResearchDecision> & Pick<StagedResearchDecision, "kind" | "castawayName">): StagedResearchDecision => ({
    id: `tour_r_${n}_${i}`,
    method: "",
    eventType: "",
    juryVotes: null,
    confidence: "high",
    sources: [],
    status: "pending",
    fromWiki: true,
    fromResearch: true,
    postMerge: false,
    ...d,
  });
  const rows: StagedResearchDecision[] = [];
  if (plan.out) rows.push(row(rows.length, { kind: "elimination", castawayName: name(plan.out), method: "Went home" }));
  plan.winners.forEach((id) => rows.push(row(rows.length, { kind: "event", castawayName: name(id), eventType: "wonWeek" })));
  plan.bottom.forEach((id) =>
    rows.push(
      row(rows.length, {
        kind: "event",
        castawayName: name(id),
        eventType: "bottomTwo",
        ...(id !== plan.out && { confidence: "low" as const, fromWiki: false }),
      })
    )
  );
  // The episode has aired: nobody can change a lineup now.
  const ep = state.episodes.find((e) => e.number === n);
  if (ep) ep.lineupsLocked = true;
  return rows;
}

/** The results page's panel for a tour episode: fully researched, nothing to paste, what's staged. */
export function tourPanel(state: LeagueState, n: number, staged: StagedResearchDecision[]): EpisodeResearchPanel {
  const names = state.castaways.map((c) => c.name);
  return {
    episodeNumber: n,
    showName: TOUR_SHOW_NAME,
    season: 1,
    coverage: {
      researched: true,
      researchedAt: new Date().toISOString(),
      total: names.length,
      covered: names,
      lowConfidence: [],
      missing: [],
      needsAsking: [],
    },
    prompt: null,
    betCount: 0,
    staged: staged.map((d) => ({ ...d, inLeague: inLeague(state, n, d) })),
  };
}

function inLeague(state: LeagueState, n: number, d: StagedResearchDecision): boolean {
  const ep = state.episodes.find((e) => e.number === n);
  const c = state.castaways.find((x) => x.name === d.castawayName);
  if (!ep || !c) return false;
  if (d.kind === "elimination") return ep.events.some((e) => e.castawayId === c.id);
  return (ep.scoringEvents || []).some((e) => e.type === d.eventType && e.castawayId === c.id);
}

/** Applies the rows you kept to the tour league, as the server's apply route would to a real one. */
export function applyTourResults(
  state: LeagueState,
  n: number,
  items: { kind: StagedResearchDecision["kind"]; castawayName: string; method: string; eventType: string }[]
): ResearchApplySummary {
  const out: ResearchApplySummary = { eliminations: [], events: [], other: [], skipped: [], unresolved: [] };
  const exits = items.filter((i) => i.kind === "elimination");
  if (exits.length) {
    const r = StateLogic.applyEliminationsImport(state, {
      episodes: [{ number: n, postMerge: false, eliminations: exits.map((i) => ({ name: i.castawayName, method: i.method })) }],
    });
    out.eliminations.push(...r.eliminations.map((e: { name: string; method: string }) => ({ name: e.name, method: e.method })));
  }
  const events = items.filter((i) => i.kind === "event" && i.eventType);
  if (events.length) {
    const r = StateLogic.applyScoringEventsImport(state, {
      episodes: [{ number: n, postMerge: false, events: events.map((i) => ({ name: i.castawayName, type: i.eventType, confidence: "high" })) }],
    });
    out.events.push(...r.events.map((e: { name: string; type: string }) => ({ name: e.name, type: e.type })));
  }
  closeEpisode(state, n);
  return out;
}
