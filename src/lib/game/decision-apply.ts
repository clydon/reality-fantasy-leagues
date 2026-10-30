import StateLogic from "./state-logic.js";
import type { LeagueState } from "./types";

// One accepted season decision (db/migrations/0019) applied to, or taken off, a league's state. Pure, so the
// classic sync (src/lib/server/season-decisions.ts, which keeps the ledger) and the new design's stats
// (cast-stats.ts, which builds a season's facts from its decisions alone) apply a result the same way.

export interface DecisionRow {
  id: string;
  episode_number: number;
  post_merge: boolean;
  /** `noexit`: nobody went home in the episode (step 6c; no castaway, castaway_name ''). */
  kind: "elimination" | "event" | "exiled" | "role" | "group" | "noexit";
  castaway_name: string;
  method: string;
  event_type: string;
  /** A finalist elimination's jury votes received (0036), when research found them. */
  jury_votes: number | null;
  /** An event's count (0106: 3 home runs), when research reported one. NUMERIC, so text. */
  units: string | null;
  applied: { castawayName?: string; method?: string; eventType?: string } | null;
  decided_at: Date;
}

export interface LedgerDetail {
  episodeNumber: number;
  castawayId: string;
  kind: DecisionRow["kind"];
  eventType?: string;
  eventId?: string;
  /** The league already had this result, so undoing the decision leaves it alone. */
  preexisting?: boolean;
}

/** What applying a decision reads of it (the ledger's id and when it was decided aside). */
export type DecisionFact = Omit<DecisionRow, "id" | "decided_at">;

/** The season's cast rows, for resolving staged names through each league's link (findSeasonCastaway). */
export type CastRef = { id: string; name: string }[];

export const unitsOf = (d: DecisionFact): number | null => (d.units != null ? Number(d.units) : null);

export function applyDecision(state: LeagueState, d: DecisionFact, cast: CastRef): { detail?: LedgerDetail; skip?: string } {
  if (d.kind === "noexit") {
    // Nobody went home: the episode has results with no one out (EpisodeLogic.hasResults reads the mark).
    const n = d.episode_number;
    const ep = StateLogic.ensureEpisodeNumber(state, n, d.post_merge);
    const detail: LedgerDetail = { episodeNumber: n, castawayId: "", kind: "noexit" };
    if (ep.noExit) return { detail: { ...detail, preexisting: true } };
    StateLogic.setNoExit(state, ep.id, true);
    return { detail };
  }
  const name = d.applied?.castawayName || d.castaway_name;
  // By the season cast link first (docs/PLAN-universal-season-cast.md, piece 7); the loose name match
  // only for a league not linked yet.
  const { castaway, ambiguous } = StateLogic.Core.findSeasonCastaway(state, name, cast);
  if (!castaway) return { skip: ambiguous ? `matches more than one castaway (${ambiguous.join(", ")})` : "not in this league's cast" };

  const ep = StateLogic.ensureEpisodeNumber(state, d.episode_number, d.post_merge);
  const base = { episodeNumber: d.episode_number, castawayId: castaway.id, kind: d.kind };

  if (d.kind === "elimination") {
    const method = d.applied?.method || d.method;
    if (castaway.status === "eliminated") {
      if ((ep.events || []).some((e) => e.castawayId === castaway.id)) {
        // Already there (entered by hand, say): still take a jury count it doesn't have yet.
        const ev = ep.events.find((e) => e.castawayId === castaway.id);
        if (ev && ev.juryVotes == null && d.jury_votes != null) StateLogic.setJuryVotes(state, ep.id, castaway.id, d.jury_votes);
        return { detail: { ...base, preexisting: true } };
      }
      return { skip: "already eliminated in a different episode in this league" };
    }
    StateLogic.addElimination(state, ep.id, castaway.id, method, d.jury_votes);
    return { detail: base };
  }
  if (d.kind === "event") {
    const type = d.applied?.eventType || d.event_type;
    const existing = (ep.scoringEvents || []).find((e) => e.type === type && e.castawayId === castaway.id);
    if (existing) {
      // Already there (entered by hand, say): still take a count it doesn't have yet.
      if (existing.units == null && unitsOf(d) != null) StateLogic.ActiveRosterLogic.setEventUnits(state, ep.id, existing.id, unitsOf(d));
      return { detail: { ...base, eventType: type, eventId: existing.id, preexisting: true } };
    }
    const ev = StateLogic.ActiveRosterLogic.addEvent(state, ep.id, type, castaway.id, unitsOf(d));
    if (!ev) return { skip: `"${type}" isn't a recognized scoring event` };
    return { detail: { ...base, eventType: type, eventId: ev.id } };
  }
  if (d.kind === "group") {
    // `applied.method` can legitimately be "" (corrected to "no group"), so it's checked for presence
    // rather than truthiness.
    const group = d.applied && d.applied.method !== undefined ? d.applied.method : d.method;
    if ((ep.groups || []).some((g) => g.castawayId === castaway.id)) return { detail: { ...base, preexisting: true } };
    StateLogic.addGroupChange(state, ep.id, castaway.id, group || null);
    return { detail: base };
  }
  if (d.kind === "role") {
    const role = d.applied?.method || d.method;
    if ((ep.roles || []).some((r) => r.castawayId === castaway.id)) return { detail: { ...base, preexisting: true } };
    if (!StateLogic.addRole(state, ep.id, castaway.id, role)) return { skip: `"${role}" isn't a role this league's show has` };
    return { detail: base };
  }
  if ((ep.exiled || []).some((x) => x.castawayId === castaway.id)) return { detail: { ...base, preexisting: true } };
  StateLogic.addExiled(state, ep.id, castaway.id);
  return { detail: base };
}

export function undoDetail(state: LeagueState, detail: LedgerDetail) {
  if (detail.preexisting) return;
  const ep = state.episodes.find((e) => e.number === detail.episodeNumber);
  if (!ep) return;
  if (detail.kind === "noexit") {
    StateLogic.setNoExit(state, ep.id, false);
  } else if (detail.kind === "elimination") {
    if ((ep.events || []).some((e) => e.castawayId === detail.castawayId)) {
      StateLogic.removeElimination(state, ep.id, detail.castawayId);
    }
  } else if (detail.kind === "event") {
    if (detail.eventId) StateLogic.removeScoringEvent(state, ep.id, detail.eventId);
  } else if (detail.kind === "role") {
    StateLogic.removeRole(state, ep.id, detail.castawayId);
  } else if (detail.kind === "group") {
    StateLogic.removeGroupChange(state, ep.id, detail.castawayId);
  } else {
    StateLogic.removeExiled(state, ep.id, detail.castawayId);
  }
}

/** One result in a league's episode that no season decision gave it or found there (its own: a commissioner's, classic's). */
export interface OwnResult {
  kind: DecisionRow["kind"];
  castawayId: string;
  eventType?: string;
  eventId?: string;
}

/**
 * The results in episode `n` of a league that its ledger (the details the sync recorded, preexisting ones too) doesn't
 * cover: what the league has of its own, beyond the season's. Making every game match the season takes these out.
 */
export function ownResults(state: LeagueState, details: LedgerDetail[], n: number): OwnResult[] {
  const ep = state.episodes.find((e) => e.number === n);
  if (!ep) return [];
  const mine = details.filter((d) => d.episodeNumber === n);
  const has = (kind: LedgerDetail["kind"], castawayId: string) => mine.some((d) => d.kind === kind && d.castawayId === castawayId);
  const eventIds = new Set(mine.filter((d) => d.kind === "event" && d.eventId).map((d) => d.eventId));
  const out: OwnResult[] = [];
  if (ep.noExit && !mine.some((d) => d.kind === "noexit")) out.push({ kind: "noexit", castawayId: "" });
  for (const e of ep.events || []) if (!has("elimination", e.castawayId)) out.push({ kind: "elimination", castawayId: e.castawayId });
  for (const e of ep.scoringEvents || []) if (!eventIds.has(e.id)) out.push({ kind: "event", castawayId: e.castawayId, eventType: e.type, eventId: e.id });
  for (const x of ep.exiled || []) if (!has("exiled", x.castawayId)) out.push({ kind: "exiled", castawayId: x.castawayId });
  for (const r of ep.roles || []) if (!has("role", r.castawayId)) out.push({ kind: "role", castawayId: r.castawayId });
  for (const g of ep.groups || []) if (!has("group", g.castawayId)) out.push({ kind: "group", castawayId: g.castawayId });
  return out;
}

/**
 * The kinds of result the season has settled for an episode (who went home counting "nobody" too): making a game match takes
 * out only its own results of these kinds, never a kind the season says nothing about (a tribe swap research didn't report).
 */
export function settledKinds(decisions: Pick<DecisionRow, "episode_number" | "kind">[], n: number): Set<DecisionRow["kind"]> {
  const kinds = new Set<DecisionRow["kind"]>(decisions.filter((d) => d.episode_number === n).map((d) => (d.kind === "noexit" ? "elimination" : d.kind)));
  if (kinds.has("elimination")) kinds.add("noexit");
  return kinds;
}

/** Takes one of a league's own results out (as undoDetail takes out what a decision gave it). */
export function removeOwn(state: LeagueState, n: number, own: OwnResult) {
  undoDetail(state, { episodeNumber: n, castawayId: own.castawayId, kind: own.kind, eventType: own.eventType, eventId: own.eventId });
}

// Placement is "order of elimination", and addElimination hands out the next number -- so a season
// whose episodes were accepted out of order (episode 3 before 2) would rank the episode-3 boot above
// the episode-2 one. Re-deriving it from episode order after a sync keeps it right whatever order
// the admin worked in. Only when every eliminated castaway has a known exit episode, so a league with
// hand-entered history from before exit episodes were recorded is left exactly as it is.
export function orderPlacementsByEpisode(state: LeagueState) {
  const epNumber = new Map(state.episodes.map((e) => [e.id, e.number]));
  const out = state.castaways.filter((c) => c.status === "eliminated" && typeof c.placementOrder === "number");
  if (out.some((c) => !c.exitEpisodeId || !epNumber.has(c.exitEpisodeId))) return;
  out.sort((a, b) => epNumber.get(a.exitEpisodeId!)! - epNumber.get(b.exitEpisodeId!)! || a.placementOrder! - b.placementOrder!);
  out.forEach((c, i) => (c.placementOrder = i + 1));
}
