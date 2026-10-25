import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueDecisionSync, LeagueState } from "@/lib/game/types";
import { applyDecision, orderPlacementsByEpisode, undoDetail, unitsOf, type CastRef, type DecisionRow, type LedgerDetail } from "@/lib/game/decision-apply";
import { resultsDiff } from "@/lib/game/results-changes";
import { recordChange, type ChangeUndo } from "./change-log";
import { pool, withLeagueLock } from "./db";
import { applyHeldTribesIfDue } from "./season-cast";
import { notifyEpisodeResults } from "./push-events";

// Applying a season's ACCEPTED episode decisions (db/migrations/0019) to its leagues.
//
// Declarative on purpose: syncLeagueDecisions makes one league's state agree with the season's
// decisions, whatever it looked like before. It applies every accepted decision the league may see
// (its reveal pointer gates it) that isn't in the league's ledger yet, and undoes every ledger entry
// whose decision is no longer accepted -- or was re-decided since (an admin correcting a castaway or
// a method), in which case the new version is applied in its place. So every moment that could
// change what a league should have -- an admin deciding, a league revealing an episode, a league
// picking the season -- is the same call, and running it twice does nothing the second time.
//
// One mode since step 6b (docs/PLAN-new-design.md; db/migrations/0112): every league receives the season's shared
// facts, wherever they came from. Accepted means "in every league": an admin's decision, or a fact the community's
// submissions settled (community-results.ts). On a season whose commissioners entered their own results before
// (show_seasons.results_by = 'leagues'), what an admin only curated there stays out of the leagues, as it always did:
// only facts somebody submitted (fact_sources) reach them. A season switched from league-decided to admin-decided has a
// cutoff (results_admin_since): only decisions settled at or after it are in scope, and anything settled before it is
// left as each league has it, never pushed and never undone.
//
// A house ruling (league_rulings) is the one exception: that league keeps a result the shared check corrected, applied
// here in place of the shared one. A correction that reaches a league (something it had taken out, or changed) leaves a
// line in its Recent changes, with what changed and each player's points, for the episode's page.
//
// Applying one decision (and undoing it) is pure: src/lib/game/decision-apply.ts, which the new design's stats share.

/** The season a league is playing and who decides its results, or null. */
async function seasonForLeague(
  client: PoolClient,
  state: LeagueState
): Promise<{ id: string; resultsBy: "admin" | "leagues"; adminSince: Date | null; showId: string; season: number } | null> {
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null) return null;
  const { rows } = await client.query(
    `SELECT ss.id, ss.results_by AS "resultsBy", ss.results_admin_since AS "adminSince", ss.show_id AS "showId", ss.season_number AS season
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number::text = $2`,
    [showId, String(wikiSeason)]
  );
  return rows.length ? rows[0] : null;
}

/** The season's cast rows, for resolving staged names through each league's link (findSeasonCastaway). */
export async function seasonCastRefs(client: PoolClient, seasonId: string | null): Promise<CastRef> {
  if (!seasonId) return [];
  const { rows } = await client.query<{ id: string; name: string }>("SELECT id, name FROM season_cast WHERE season_id=$1", [seasonId]);
  return rows;
}

/** The line a sync leaves in one couch's leagues: the answer that couch sent (its own Recent changes line, with Undo). */
export interface SyncLog {
  couchId: string | null;
  episode: number;
  userId: string | null;
  kind: string;
  text: string;
  batch: string;
  detail?: Record<string, unknown>;
  undo?: ChangeUndo | null;
  /** Taking an answer back: that couch's own line is marked undone, so it gets no correction line of its own. */
  withdrawal?: boolean;
}

export interface SyncOptions {
  log?: SyncLog;
  /** Correction lines across the season share one batch. */
  correctionBatch?: string;
  /** A house ruling going on or coming off: it has its own line, and isn't a correction of the shared facts. */
  noCorrections?: boolean;
}

type SyncResult = { applied: number; undone: number; skipped: { name: string; why: string }[]; eliminatedEpisodeIds: string[]; episodes: number[] };

/**
 * A fact as it was, for a correction's line and a house ruling to keep. `absent`: the league keeps it out (a result the
 * shared check added after the episode's results were in, step 6b part 3): the rest says what it was.
 */
export type KeptFact = Pick<DecisionRow, "episode_number" | "post_merge" | "kind" | "castaway_name" | "method" | "event_type" | "jury_votes" | "units" | "applied"> & {
  absent?: true;
};

/** What a correction did to one fact, for the episode's plate. */
export interface CorrectedFact {
  id: string;
  name: string;
  label: string;
  /** Taken out, changed, or added to an episode whose results the game already had. */
  change: "removed" | "changed" | "added";
  to: string | null;
  /** What the game had: for one added, what came in, kept out by a ruling (`absent`). */
  was: KeptFact;
}

const keptOf = (d: DecisionRow): KeptFact => ({
  episode_number: d.episode_number,
  post_merge: d.post_merge,
  kind: d.kind,
  castaway_name: d.castaway_name,
  method: d.method,
  event_type: d.event_type,
  jury_votes: d.jury_votes,
  units: d.units,
  applied: d.applied,
});

/** "Found an idol", "Voted Out": what a fact is, in the show's words. */
function labelOf(state: LeagueState, d: Pick<DecisionRow, "kind" | "method" | "event_type" | "applied">): string {
  const type = d.applied?.eventType || d.event_type;
  if (d.kind === "event") return StateLogic.formatOf(state).events.find((e) => e.id === type)?.label ?? type;
  if (d.kind === "group") return `moved to ${d.applied?.method ?? d.method}`;
  if (d.kind === "noexit") return "Nobody went home";
  return (d.applied?.method ?? d.method) || d.kind;
}

/**
 * Brings one league (already locked, inside withLeagueLock) in line with its season's accepted
 * decisions. Returns counts, what couldn't be applied, the episodes that gained an elimination
 * (for the results push), and the episodes it changed.
 */
export async function syncLeagueDecisions(client: PoolClient, leagueId: string, state: LeagueState, opts: SyncOptions = {}): Promise<SyncResult> {
  const result: SyncResult = { applied: 0, undone: 0, skipped: [], eliminatedEpisodeIds: [], episodes: [] };
  const season = await seasonForLeague(client, state);
  const seasonId = season ? season.id : null;
  const since = season ? season.adminSince : null;
  const before = structuredClone(state);

  const gate = StateLogic.RevealLogic.revealedThrough(state);
  const { rows: accepted } = seasonId
    ? await client.query<DecisionRow & { fact_status: string | null; sourced: boolean }>(
        `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied, decided_at, fact_status,
                EXISTS (SELECT 1 FROM fact_sources f WHERE f.decision_id = season_decisions.id) AS sourced
           FROM season_decisions WHERE season_id=$1 AND status='accepted' AND ($2::int IS NULL OR episode_number <= $2)
            AND ($3::timestamptz IS NULL OR decided_at >= $3)
            AND ($4 OR EXISTS (SELECT 1 FROM fact_sources f WHERE f.decision_id = season_decisions.id))
          ORDER BY episode_number ASC, (kind = 'elimination') DESC, created_at ASC`,
        [seasonId, gate, since, season!.resultsBy === "admin"]
      )
    : { rows: [] as (DecisionRow & { fact_status: string | null; sourced: boolean })[] };
  // House rulings: this league keeps the result as it was, in place of the shared one (accepted or not).
  const { rows: rulings } = await client.query<{ decision_id: string; keeps: KeptFact; created_at: Date }>(
    "SELECT decision_id, keeps, created_at FROM league_rulings WHERE league_id=$1",
    [leagueId]
  );
  const ruled = new Set(rulings.map((r) => r.decision_id));
  const shared = accepted.filter((d) => !ruled.has(d.id));
  const decisions: DecisionRow[] = [
    ...shared,
    ...rulings.filter((r) => !r.keeps.absent && (gate === null || r.keeps.episode_number <= gate)).map((r) => ({ ...r.keeps, id: r.decision_id, decided_at: r.created_at })),
  ].sort((a, b) => a.episode_number - b.episode_number || Number(b.kind === "elimination") - Number(a.kind === "elimination"));
  const byId = new Map(decisions.map((d) => [d.id, d]));

  const { rows: ledger } = await client.query<{ decision_id: string; decided_at: Date | null; detail: LedgerDetail }>(
    "SELECT decision_id, decided_at, detail FROM league_applied_decisions WHERE league_id=$1",
    [leagueId]
  );
  const current = new Set<string>();
  let eliminationsChanged = false;
  const cast = await seasonCastRefs(client, seasonId);
  const touched = new Set<number>();

  // Past a cutoff, a ledger entry whose decision was last settled BEFORE it (in an earlier admin-decided
  // spell) is out of scope: left exactly as it is, as if current. One settled since -- re-decided,
  // rejected, deleted -- is in scope and handled as always. With no cutoff, nothing is out of scope.
  const outOfScope = new Set<string>();
  if (since) {
    const { rows: settled } = await client.query<{ id: string; decided_at: Date | null }>(
      "SELECT id, decided_at FROM season_decisions WHERE id = ANY($1::uuid[])",
      [ledger.filter((row) => !byId.has(row.decision_id)).map((row) => row.decision_id)]
    );
    for (const d of settled) if (d.decided_at && d.decided_at.getTime() < since.getTime()) outOfScope.add(d.id);
  }

  // Undo first, newest episode first, so eliminations come off in the reverse of the order they went on.
  const stale = ledger
    .filter((row) => {
      if (outOfScope.has(row.decision_id)) return false;
      const d = byId.get(row.decision_id);
      return !d || !row.decided_at || d.decided_at.getTime() !== new Date(row.decided_at).getTime();
    })
    .sort((a, b) => b.detail.episodeNumber - a.detail.episodeNumber);
  // What the stale entries were (for a correction's line): the decision as the league had it.
  const { rows: wasRows } = stale.length
    ? await client.query<DecisionRow>(
        `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied, decided_at
           FROM season_decisions WHERE id = ANY($1::uuid[])`,
        [stale.map((r) => r.decision_id)]
      )
    : { rows: [] as DecisionRow[] };
  const was = new Map(wasRows.map((d) => [d.id, d]));
  const corrected = new Map<number, CorrectedFact[]>();
  for (const row of stale) {
    undoDetail(state, row.detail);
    if (row.detail.kind === "elimination" && !row.detail.preexisting) eliminationsChanged = true;
    await client.query("DELETE FROM league_applied_decisions WHERE league_id=$1 AND decision_id=$2", [leagueId, row.decision_id]);
    result.undone++;
    if (!row.detail.preexisting) touched.add(row.detail.episodeNumber);
    const now = byId.get(row.decision_id);
    const old = was.get(row.decision_id);
    if (old && !row.detail.preexisting && !ruled.has(row.decision_id) && !opts.noCorrections) {
      const list = corrected.get(row.detail.episodeNumber) ?? [];
      const nameNow = now?.applied?.castawayName || now?.castaway_name;
      list.push({
        id: old.id,
        name: old.applied?.castawayName || old.castaway_name,
        label: labelOf(state, old),
        change: now ? "changed" : "removed",
        to: now ? `${nameNow} · ${labelOf(state, now)}` : null,
        was: keptOf(old),
      });
      corrected.set(row.detail.episodeNumber, list);
    }
  }
  for (const row of ledger) if (!stale.includes(row)) current.add(row.decision_id);

  // An episode whose results the game already had in full: a result someone sent arriving there now is a correction too
  // (it adds). One an admin entered by hand (classic's Accept, a fact at a time) is still results coming in, not a correction.
  const sourced = new Set(accepted.filter((d) => d.sourced).map((d) => d.id));
  const finalBefore = new Set(before.episodes.filter((e) => StateLogic.episodeHasResults(e) && StateLogic.resultsStage(e) === "final").map((e) => e.number));
  for (const d of decisions) {
    if (current.has(d.id)) continue;
    const { detail, skip } = applyDecision(state, d, cast);
    if (!detail) {
      result.skipped.push({ name: d.applied?.castawayName || d.castaway_name, why: skip || "couldn't be applied" });
      continue;
    }
    await client.query(
      `INSERT INTO league_applied_decisions (league_id, decision_id, decided_at, detail) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (league_id, decision_id) DO UPDATE SET decided_at=EXCLUDED.decided_at, detail=EXCLUDED.detail, applied_at=now()`,
      [leagueId, d.id, d.decided_at, JSON.stringify(detail)]
    );
    result.applied++;
    if (!detail.preexisting) touched.add(d.episode_number);
    if (!detail.preexisting && finalBefore.has(d.episode_number) && sourced.has(d.id) && !was.has(d.id) && !ruled.has(d.id) && !opts.noCorrections && d.kind === "event") {
      const list = corrected.get(d.episode_number) ?? [];
      list.push({ id: d.id, name: d.applied?.castawayName || d.castaway_name, label: labelOf(state, d), change: "added", to: null, was: { ...keptOf(d), absent: true } });
      corrected.set(d.episode_number, list);
    }
    if (d.kind === "elimination" && !detail.preexisting) {
      eliminationsChanged = true;
      const ep = state.episodes.find((e) => e.number === d.episode_number);
      if (ep && !result.eliminatedEpisodeIds.includes(ep.id)) result.eliminatedEpisodeIds.push(ep.id);
    }
  }

  // A jury count can arrive after its elimination was already applied (research filled it in on the
  // accepted decision) -- re-applying isn't triggered for that, so top the league's record up here.
  for (const d of decisions) {
    if (d.kind !== "elimination" || d.jury_votes == null || !current.has(d.id)) continue;
    const ep = state.episodes.find((e) => e.number === d.episode_number);
    const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.applied?.castawayName || d.castaway_name, cast);
    const ev = ep && castaway ? (ep.events || []).find((e) => e.castawayId === castaway.id) : null;
    if (ep && castaway && ev && ev.juryVotes !== d.jury_votes) StateLogic.setJuryVotes(state, ep.id, castaway.id, d.jury_votes);
  }
  // A count, the same way: filled in or corrected on the accepted decision after its event was applied.
  for (const d of decisions) {
    if (d.kind !== "event" || d.units == null || !current.has(d.id)) continue;
    const ep = state.episodes.find((e) => e.number === d.episode_number);
    const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.applied?.castawayName || d.castaway_name, cast);
    const type = d.applied?.eventType || d.event_type;
    const ev = ep && castaway ? (ep.scoringEvents || []).find((e) => e.type === type && e.castawayId === castaway.id) : null;
    if (ep && ev && (ev.units ?? 1) !== unitsOf(d)) StateLogic.ActiveRosterLogic.setEventUnits(state, ep.id, ev.id, unitsOf(d));
  }

  if (eliminationsChanged) orderPlacementsByEpisode(state);
  // Where each episode this changed stands: final once any scoring moment is in, or once someone sent the full results
  // (an episode where nothing scored is still finished); early while only who went home is.
  if (touched.size) {
    const finals = season ? await fullAnswers(client, season.showId, season.season) : new Set<number>();
    for (const n of touched) {
      const ep = state.episodes.find((e) => e.number === n);
      if (!ep) continue;
      const scored = (ep.scoringEvents ?? []).length > 0 || finals.has(n);
      StateLogic.setResultsStage(state, ep.id, !StateLogic.episodeHasResults(ep) || scored ? "final" : "early");
    }
  }
  // Results landing can be the moment a live league reaches the episode the tribes were held for.
  if (result.applied) await applyHeldTribesIfDue(client, state);
  result.episodes = [...touched].sort((a, b) => a - b);
  await logSync(client, leagueId, before, state, result.episodes, corrected, opts);
  return result;
}

/** The episodes that have a full answer in (someone sent every result, not just who went home). */
async function fullAnswers(client: PoolClient, showId: string, season: number): Promise<Set<number>> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT DISTINCT episode_number AS n FROM episode_research
      WHERE show_id=$1 AND season_number=$2 AND source <> 'combined' AND withdrawn_at IS NULL
        AND covers IS NOT NULL AND NOT (covers ? 'only') AND jsonb_typeof(covers->'kinds') = 'null'`,
    [showId, season]
  );
  return new Set(rows.map((r) => r.n));
}

/** The lines this sync leaves: the answer's own couch gets its line (with Undo); a correction, every league it reached. */
async function logSync(client: PoolClient, leagueId: string, before: LeagueState, after: LeagueState, episodes: number[], corrected: Map<number, CorrectedFact[]>, opts: SyncOptions) {
  if (!episodes.length) return;
  const { rows } = await client.query<{ couch_id: string | null }>("SELECT couch_id FROM leagues WHERE id=$1", [leagueId]);
  const couch = rows[0]?.couch_id ?? null;
  const log = opts.log;
  const own = !!log && !!log.couchId && log.couchId === couch;
  for (const n of episodes) {
    // The answer's own line (its Undo takes the answer back); a correction it made too gets its line below.
    if (own && n === log!.episode && !log!.withdrawal && resultsDiff(before, after, n)) {
      await recordChange(client, leagueId, after, { userId: log!.userId, kind: log!.kind, tier: 2, episode: n, text: log!.text, batch: log!.batch, detail: log!.detail ?? null, undo: log!.undo ?? null });
    }
    const facts = corrected.get(n);
    if (!facts?.length || (own && log!.withdrawal)) continue;
    const scores = (s: LeagueState) => new Map(StateLogic.computeScores(s).map((r) => [r.playerId, r.total]));
    const [a, b] = [scores(before), scores(after)];
    const deltas = Object.fromEntries([...b].map(([p, t]) => [p, t - (a.get(p) ?? 0)]).filter(([, d]) => d !== 0));
    await recordChange(client, leagueId, after, {
      userId: null,
      kind: "results.correction",
      tier: 2,
      episode: n,
      text: `Episode ${n} corrected`,
      batch: opts.correctionBatch,
      detail: { facts, deltas },
      undo: null,
    });
  }
}

/**
 * Syncs every league playing a season -- what an admin decision, or an answer someone sent, triggers. One league
 * failing (a lock timeout, a league deleted mid-loop) is reported against that league and never denies the others.
 * Live leagues that gained an elimination get the usual episode-results push.
 */
export async function syncSeasonLeagues(seasonId: string, actorUserId: string | null, opts: SyncOptions = {}): Promise<(LeagueDecisionSync & { couchId: string | null; episodes: number[] })[]> {
  const { rows: leagues } = await pool.query(
    `SELECT l.id, l.name, l.couch_id FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1
      ORDER BY l.name`,
    [seasonId]
  );
  const sync = { ...opts, correctionBatch: opts.correctionBatch ?? crypto.randomUUID() };
  const results: (LeagueDecisionSync & { couchId: string | null; episodes: number[] })[] = [];
  for (const league of leagues) {
    try {
      let out: SyncResult | null = null;
      const state = await withLeagueLock(league.id, async (s, client) => {
        out = await syncLeagueDecisions(client, league.id, s, sync);
      });
      const r = out as unknown as SyncResult;
      for (const epId of r.eliminatedEpisodeIds) notifyEpisodeResults(league.id, state, epId, actorUserId);
      results.push({ leagueId: league.id, leagueName: league.name, couchId: league.couch_id, applied: r.applied, undone: r.undone, skipped: r.skipped, episodes: r.episodes });
    } catch (e) {
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        couchId: league.couch_id,
        applied: 0,
        undone: 0,
        skipped: [],
        episodes: [],
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  return results;
}

/** How many leagues play a season. */
export async function leagueCountForSeason(seasonId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1`,
    [seasonId]
  );
  return rows[0].n;
}
