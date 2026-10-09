import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueDecisionSync, LeagueState } from "@/lib/game/types";
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

interface DecisionRow {
  id: string;
  episode_number: number;
  post_merge: boolean;
  kind: "elimination" | "event" | "exiled" | "role" | "group";
  castaway_name: string;
  method: string;
  event_type: string;
  /** A finalist elimination's jury votes received (0036), when research found them. */
  jury_votes: number | null;
  applied: { castawayName?: string; method?: string; eventType?: string } | null;
  decided_at: Date;
}

interface LedgerDetail {
  episodeNumber: number;
  castawayId: string;
  kind: DecisionRow["kind"];
  eventType?: string;
  eventId?: string;
  /** The league already had this result, so undoing the decision leaves it alone. */
  preexisting?: boolean;
}

/** show_seasons.id for the season a league is playing, or null. */
async function seasonIdForLeague(client: PoolClient, state: LeagueState): Promise<string | null> {
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null) return null;
  const { rows } = await client.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number::text = $2`,
    [showId, String(wikiSeason)]
  );
  return rows.length ? rows[0].id : null;
}

function applyDecision(state: LeagueState, d: DecisionRow): { detail?: LedgerDetail; skip?: string } {
  const name = d.applied?.castawayName || d.castaway_name;
  const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, name);
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
    if (existing) return { detail: { ...base, eventType: type, eventId: existing.id, preexisting: true } };
    const ev = StateLogic.ActiveRosterLogic.addEvent(state, ep.id, type, castaway.id);
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

function undoDetail(state: LeagueState, detail: LedgerDetail) {
  if (detail.preexisting) return;
  const ep = state.episodes.find((e) => e.number === detail.episodeNumber);
  if (!ep) return;
  if (detail.kind === "elimination") {
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
  const seasonId = await seasonIdForLeague(client, state);

  const gate = StateLogic.RevealLogic.revealedThrough(state);
  const { rows: accepted } = seasonId
    ? await client.query<DecisionRow>(
        `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, applied, decided_at
           FROM season_decisions
          WHERE season_id=$1 AND status='accepted' AND ($2::int IS NULL OR episode_number <= $2)
          ORDER BY episode_number ASC, (kind = 'elimination') DESC, created_at ASC`,
        [seasonId, gate]
      )
    : { rows: [] as DecisionRow[] };
  const byId = new Map(accepted.map((d) => [d.id, d]));

  const { rows: ledger } = await client.query<{ decision_id: string; decided_at: Date | null; detail: LedgerDetail }>(
    "SELECT decision_id, decided_at, detail FROM league_applied_decisions WHERE league_id=$1",
    [leagueId]
  );
  const current = new Set<string>();
  let eliminationsChanged = false;

  // Undo first, newest episode first, so eliminations come off in the reverse of the order they went on.
  const stale = ledger
    .filter((row) => {
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
    const { detail, skip } = applyDecision(state, d);
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
    const { castaway } = StateLogic.Core.findCastawayByName(state, d.applied?.castawayName || d.castaway_name);
    const ev = ep && castaway ? (ep.events || []).find((e) => e.castawayId === castaway.id) : null;
    if (ep && castaway && ev && ev.juryVotes !== d.jury_votes) StateLogic.setJuryVotes(state, ep.id, castaway.id, d.jury_votes);
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
