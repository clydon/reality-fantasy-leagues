import type { PoolClient, Pool } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState, ResearchApplySummary, ResearchDecisionKind, StagedResearchDecision } from "@/lib/game/types";
import { orderPlacementsByEpisode } from "./season-decisions";

export type { ResearchApplySummary, StagedResearchDecision };

// A commissioner applying staged episode research to THEIR OWN league
// (docs/PLAN-episode-research-compiled-cache.md, piece 4), kept out of the route so it can be tested
// without a database -- same arrangement as cast-import.ts.
//
// The second, independent way a season decision reaches a league. The first is an admin accepting it
// season-wide (season_decisions.status + syncLeagueDecisions), which stays exactly as it was. This one
// changes nothing in season_decisions -- one league's commissioner deciding something decides it for
// no other league -- and writes only the league's own state.
//
// Eliminations and scoring events go through StateLogic.applyEliminationsImport/applyScoringEventsImport,
// the wiki proposal flow's apply step: additive, and idempotent per castaway (eliminations) and per
// (episode, type, castaway) (events). That is also what keeps the two paths from double-scoring one
// decision: whichever reaches the league first records it, and the other finds it there --
// applyEliminationsImport skips someone already out, and syncLeagueDecisions files a result it finds
// already in the league as `preexisting`, which it then never undoes. tests/episode-research-apply.test.js
// runs both orders.

/** What the commissioner confirmed: a staged row, possibly corrected. */
export interface ResearchApplyItem {
  kind: ResearchDecisionKind;
  castawayName: string;
  method?: string;
  eventType?: string;
  juryVotes?: number | null;
  /** An event's count, when research reported one. */
  units?: number | null;
  postMerge?: boolean;
}

/** Everything staged for one episode of a season, wiki and research alike, in the season sync's order. */
export async function stagedForEpisode(db: Pool | PoolClient, seasonId: string, episodeNumber: number): Promise<StagedResearchDecision[]> {
  const { rows } = await db.query(
    `SELECT id, kind, castaway_name, method, event_type, jury_votes, units, confidence, sources, status,
            from_wiki, from_research, post_merge, applied
       FROM season_decisions
      WHERE season_id=$1 AND episode_number=$2
      ORDER BY (kind = 'elimination') DESC, created_at ASC`,
    [seasonId, episodeNumber]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    // An admin's correction is the better-informed version of the row, so it's what's offered.
    castawayName: (r.applied && r.applied.castawayName) || r.castaway_name,
    // Presence, not truthiness: a tribe move corrected to "no tribe" is a real "" (as syncLeagueDecisions reads it).
    method: r.applied && r.applied.method !== undefined ? r.applied.method : r.method,
    eventType: (r.applied && r.applied.eventType) || r.event_type,
    juryVotes: r.jury_votes,
    // NUMERIC arrives as text.
    units: r.units != null ? Number(r.units) : null,
    confidence: r.confidence,
    sources: r.sources || [],
    status: r.status,
    // Curator mode shows a corrected row as corrected (docs/PLAN-universal-season-cast.md, piece 5).
    corrected: !!r.applied,
    fromWiki: r.from_wiki,
    fromResearch: r.from_research,
    postMerge: r.post_merge,
  }));
}

/**
 * Whether a decision's result is already in the league's episode -- what makes applying it a no-op.
 * `seasonCast` (the season's [{ id, name }]) resolves the staged name through the league's link first.
 */
export function inLeague(
  state: LeagueState,
  episodeNumber: number,
  d: Pick<StagedResearchDecision, "kind" | "castawayName" | "eventType">,
  seasonCast?: { id: string; name: string }[]
): boolean {
  const ep = state.episodes.find((e) => e.number === episodeNumber);
  const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.castawayName, seasonCast);
  if (!ep || !castaway) return false;
  if (d.kind === "elimination") return (ep.events || []).some((e) => e.castawayId === castaway.id);
  if (d.kind === "event") return (ep.scoringEvents || []).some((e) => e.type === d.eventType && e.castawayId === castaway.id);
  if (d.kind === "exiled") return (ep.exiled || []).some((x) => x.castawayId === castaway.id);
  if (d.kind === "role") return (ep.roles || []).some((r) => r.castawayId === castaway.id);
  if (d.kind === "group") return (ep.groups || []).some((g) => g.castawayId === castaway.id);
  return false;
}

/**
 * Applies the confirmed rows to one episode of one league's state. Corrections are checked against the
 * league's own format here, not trusted from the client: an exit method it doesn't have never reaches
 * castaway.exitMethod (applyEliminationsImport writes it straight on), and addEvent/addRole already
 * refuse what the format doesn't know.
 */
export function applyResearchDecisions(state: LeagueState, episodeNumber: number, items: ResearchApplyItem[]): ResearchApplySummary {
  const format = StateLogic.formatOf(state);
  const out: ResearchApplySummary = { eliminations: [], events: [], other: [], skipped: [], unresolved: [] };
  const postMerge = items.some((i) => i.postMerge);

  const eliminations = items.filter((i) => i.kind === "elimination");
  const legal = eliminations.filter((i) => {
    if (format.exitMethods.includes(i.method || "")) return true;
    out.skipped.push(`${i.castawayName} ("${i.method}" isn't a way to leave this show)`);
    return false;
  });
  if (legal.length) {
    const r = StateLogic.applyEliminationsImport(state, {
      episodes: [{ number: episodeNumber, postMerge, eliminations: legal.map((i) => ({ name: i.castawayName, method: i.method! })) }],
    });
    out.eliminations.push(...r.eliminations.map((e) => ({ name: e.name, method: e.method })));
    out.skipped.push(...r.skipped.map((n) => `${n} (already out)`));
    out.unresolved.push(...r.unresolved);
    // A finalist's jury count rides on their elimination; the import doesn't carry one.
    const ep = state.episodes.find((e) => e.number === episodeNumber)!;
    for (const i of legal) {
      if (!Number.isInteger(i.juryVotes)) continue;
      const { castaway } = StateLogic.Core.findCastawayByName(state, i.castawayName);
      const ev = castaway && (ep.events || []).find((e) => e.castawayId === castaway.id);
      if (castaway && ev && ev.juryVotes == null) StateLogic.setJuryVotes(state, ep.id, castaway.id, i.juryVotes as number);
    }
    if (r.eliminations.length) orderPlacementsByEpisode(state);
  }

  const events = items.filter((i) => i.kind === "event" && i.eventType);
  if (events.length) {
    // The proposal shape carries a confidence the apply step never reads; a commissioner's confirmed row is "high".
    const r = StateLogic.applyScoringEventsImport(state, {
      episodes: [
        {
          number: episodeNumber,
          postMerge,
          events: events.map((i) => ({ name: i.castawayName, type: i.eventType!, confidence: "high" as const, units: i.units ?? null })),
        },
      ],
    });
    out.events.push(...r.events.map((e) => ({ name: e.name, type: e.type })));
    out.skipped.push(...r.skipped);
    out.unresolved.push(...r.unresolved);
    // The full results: whatever stage the episode was at (early: who went home), it's final now.
    const ep = state.episodes.find((e) => e.number === episodeNumber);
    if (ep && r.events.length) StateLogic.setResultsStage(state, ep.id, "final");
  }

  // Exile, roles and tribe moves have no import function of their own; the same per-person idempotency
  // syncLeagueDecisions uses, by hand.
  for (const i of items.filter((x) => x.kind === "exiled" || x.kind === "role" || x.kind === "group")) {
    const { castaway } = StateLogic.Core.findCastawayByName(state, i.castawayName);
    if (!castaway) {
      out.unresolved.push(i.castawayName);
      continue;
    }
    if (inLeague(state, episodeNumber, i as Pick<StagedResearchDecision, "kind" | "castawayName" | "eventType">)) {
      out.skipped.push(`${castaway.name} (${i.kind}, already recorded)`);
      continue;
    }
    const ep = StateLogic.ensureEpisodeNumber(state, episodeNumber, postMerge);
    if (i.kind === "exiled") StateLogic.addExiled(state, ep.id, castaway.id);
    else if (i.kind === "group") StateLogic.addGroupChange(state, ep.id, castaway.id, i.method || null);
    else if (!StateLogic.addRole(state, ep.id, castaway.id, i.method || "")) {
      out.skipped.push(`${castaway.name} ("${i.method}" isn't a role this show has)`);
      continue;
    }
    out.other.push({ name: castaway.name, kind: i.kind });
  }
  return out;
}

/** True when anything in a summary changed the league. */
export function appliedAnything(r: ResearchApplySummary): boolean {
  return r.eliminations.length + r.events.length + r.other.length > 0;
}
