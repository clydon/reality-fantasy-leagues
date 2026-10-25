import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueDecisionSync, LeagueState } from "@/lib/game/types";
import { applyDecision, orderPlacementsByEpisode, undoDetail, unitsOf, type CastRef, type DecisionRow, type LedgerDetail } from "@/lib/game/decision-apply";
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
// Only for a season whose results an admin decides (show_seasons.results_by, db/migrations/0054). A
// league-decided season's leagues get their results from their own commissioner, and the season sync
// leaves them entirely alone -- it neither applies nor undoes anything. A season switched from
// league-decided to admin-decided has a cutoff (results_admin_since): only decisions settled at or after
// it are in scope, and anything settled before it is left as each league has it, never pushed and never
// undone.
//
// Applying one decision (and undoing it) is pure: src/lib/game/decision-apply.ts, which the new design's stats share.

/** The season a league is playing and who decides its results, or null. */
async function seasonForLeague(
  client: PoolClient,
  state: LeagueState
): Promise<{ id: string; resultsBy: "admin" | "leagues"; adminSince: Date | null } | null> {
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null) return null;
  const { rows } = await client.query(
    `SELECT ss.id, ss.results_by AS "resultsBy", ss.results_admin_since AS "adminSince"
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

/**
 * Brings one league (already locked, inside withLeagueLock) in line with its season's accepted
 * decisions. Returns counts, what couldn't be applied, and the episodes that gained an elimination
 * (for the results push).
 */
export async function syncLeagueDecisions(
  client: PoolClient,
  leagueId: string,
  state: LeagueState
): Promise<{ applied: number; undone: number; skipped: { name: string; why: string }[]; eliminatedEpisodeIds: string[] }> {
  const result = { applied: 0, undone: 0, skipped: [] as { name: string; why: string }[], eliminatedEpisodeIds: [] as string[] };
  const season = await seasonForLeague(client, state);
  // League-decided: this league's results are its commissioner's. Nothing to apply, nothing to undo.
  if (season && season.resultsBy === "leagues") return result;
  const seasonId = season ? season.id : null;
  const since = season ? season.adminSince : null;

  const gate = StateLogic.RevealLogic.revealedThrough(state);
  const { rows: accepted } = seasonId
    ? await client.query<DecisionRow>(
        `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied, decided_at
           FROM season_decisions
          WHERE season_id=$1 AND status='accepted' AND ($2::int IS NULL OR episode_number <= $2)
            AND ($3::timestamptz IS NULL OR decided_at >= $3)
          ORDER BY episode_number ASC, (kind = 'elimination') DESC, created_at ASC`,
        [seasonId, gate, since]
      )
    : { rows: [] as DecisionRow[] };
  const byId = new Map(accepted.map((d) => [d.id, d]));

  const { rows: ledger } = await client.query<{ decision_id: string; decided_at: Date | null; detail: LedgerDetail }>(
    "SELECT decision_id, decided_at, detail FROM league_applied_decisions WHERE league_id=$1",
    [leagueId]
  );
  const current = new Set<string>();
  let eliminationsChanged = false;
  const cast = await seasonCastRefs(client, seasonId);

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
  for (const row of stale) {
    undoDetail(state, row.detail);
    if (row.detail.kind === "elimination" && !row.detail.preexisting) eliminationsChanged = true;
    await client.query("DELETE FROM league_applied_decisions WHERE league_id=$1 AND decision_id=$2", [leagueId, row.decision_id]);
    result.undone++;
  }
  for (const row of ledger) if (!stale.includes(row)) current.add(row.decision_id);

  for (const d of accepted) {
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
    // A scoring moment is the full results: an episode at the early stage (who went home) is final now.
    if (d.kind === "event") {
      const ep = state.episodes.find((e) => e.number === d.episode_number);
      if (ep) StateLogic.setResultsStage(state, ep.id, "final");
    }
    if (d.kind === "elimination" && !detail.preexisting) {
      eliminationsChanged = true;
      const ep = state.episodes.find((e) => e.number === d.episode_number);
      if (ep && !result.eliminatedEpisodeIds.includes(ep.id)) result.eliminatedEpisodeIds.push(ep.id);
    }
  }

  // A jury count can arrive after its elimination was already applied (research filled it in on the
  // accepted decision) -- re-applying isn't triggered for that, so top the league's record up here.
  for (const d of accepted) {
    if (d.kind !== "elimination" || d.jury_votes == null || !current.has(d.id)) continue;
    const ep = state.episodes.find((e) => e.number === d.episode_number);
    const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.applied?.castawayName || d.castaway_name, cast);
    const ev = ep && castaway ? (ep.events || []).find((e) => e.castawayId === castaway.id) : null;
    if (ep && castaway && ev && ev.juryVotes !== d.jury_votes) StateLogic.setJuryVotes(state, ep.id, castaway.id, d.jury_votes);
  }
  // A count, the same way: filled in or corrected on the accepted decision after its event was applied.
  for (const d of accepted) {
    if (d.kind !== "event" || d.units == null || !current.has(d.id)) continue;
    const ep = state.episodes.find((e) => e.number === d.episode_number);
    const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.applied?.castawayName || d.castaway_name, cast);
    const type = d.applied?.eventType || d.event_type;
    const ev = ep && castaway ? (ep.scoringEvents || []).find((e) => e.type === type && e.castawayId === castaway.id) : null;
    if (ep && ev && (ev.units ?? 1) !== unitsOf(d)) StateLogic.ActiveRosterLogic.setEventUnits(state, ep.id, ev.id, unitsOf(d));
  }

  if (eliminationsChanged) orderPlacementsByEpisode(state);
  // Results landing can be the moment a live league reaches the episode the tribes were held for.
  if (result.applied) await applyHeldTribesIfDue(client, state);
  return result;
}

/**
 * Syncs every league playing a season -- what an admin decision triggers. One league failing (a lock
 * timeout, a league deleted mid-loop) is reported against that league and never denies the others.
 * Live leagues that gained an elimination get the usual episode-results push.
 */
export async function syncSeasonLeagues(seasonId: string, actorUserId: string | null): Promise<LeagueDecisionSync[]> {
  // A league-decided season reaches no league from here -- not even a no-op lock-and-write, which would
  // still run each league's bots and episode bookkeeping on an admin's click.
  const { rows: seasonRows } = await pool.query("SELECT results_by FROM show_seasons WHERE id=$1", [seasonId]);
  if (!seasonRows.length || seasonRows[0].results_by === "leagues") return [];
  const { rows: leagues } = await pool.query(
    `SELECT l.id, l.name FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1
      ORDER BY l.name`,
    [seasonId]
  );
  const results: LeagueDecisionSync[] = [];
  for (const league of leagues) {
    try {
      let out: Awaited<ReturnType<typeof syncLeagueDecisions>> | null = null;
      const state = await withLeagueLock(league.id, async (s, client) => {
        out = await syncLeagueDecisions(client, league.id, s);
      });
      const r = out as unknown as Awaited<ReturnType<typeof syncLeagueDecisions>>;
      for (const epId of r.eliminatedEpisodeIds) notifyEpisodeResults(league.id, state, epId, actorUserId);
      results.push({ leagueId: league.id, leagueName: league.name, applied: r.applied, undone: r.undone, skipped: r.skipped });
    } catch (e) {
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        applied: 0,
        undone: 0,
        skipped: [],
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
