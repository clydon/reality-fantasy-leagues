import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { undoResults } from "@/lib/game/results-changes";
import type { LeagueState } from "@/lib/game/types";
import type { ChangeUndo, MemberUndo, Tier } from "./change-log";
import { isSuperAdminUser, type SessionUser } from "./auth-helpers";
import { withdrawResults } from "./community-results";
import { joinedLeague, requireCouch } from "./couches";
import { pool, withLeagueLock, HttpError } from "./db";
import { setLeagueRole } from "./roles";
import { syncLeagueDecisions } from "./season-decisions";
import { games } from "./show-space";

// Reading Recent changes (docs/PLAN-new-design.md step 5), for everyone on the couch, and Undo, for whoever runs the
// games a change touched. The lines are written by change-log.ts, in the same transaction as each change.

// ---- reading them, for the couch ----

export interface ChangeLine {
  batch: string;
  at: string;
  kind: string;
  tier: Tier;
  episode: number | null;
  text: string;
  /** Who did it; null: it applied on its own. */
  who: { userId: string; name: string } | null;
  /** The games it changed, by name. */
  games: string[];
  undone: { at: string; by: string | null } | null;
  undoUntil: string | null;
  /** You run every game it changed, and it can still be taken back. */
  undoable: boolean;
}

/** The couch's games on a season, and which of them you run (Commissioner or Game admin; a site admin runs them all). */
export async function couchGames(user: SessionUser, seasonId: string, couchId: string) {
  await requireCouch(user, couchId);
  const here = await games(user.id, { couchIds: [couchId], seasonId });
  const runs = new Set(here.filter((g) => isSuperAdminUser(user) || g.yourRole === "commissioner" || g.yourRole === "admin").map((g) => g.leagueId));
  return { here, runs };
}

interface ChangeRow {
  id: string;
  batch: string;
  league_id: string;
  user_id: string | null;
  who: string | null;
  kind: string;
  tier: number;
  episode: number | null;
  text: string;
  undo: ChangeUndo | null;
  undo_until: Date | null;
  undone_at: Date | null;
  undone_by_name: string | null;
  created_at: Date;
}

const ROW_COLUMNS = `c.id, c.batch, c.league_id, c.user_id, COALESCE(u.username, u.name) AS who, c.kind, c.tier, c.episode, c.text, c.undo,
  c.undo_until, c.undone_at, COALESCE(ub.username, ub.name) AS undone_by_name, c.created_at`;
const ROW_JOINS = `LEFT JOIN "user" u ON u.id = c.user_id LEFT JOIN "user" ub ON ub.id = c.undone_by`;

/**
 * The newest results change on each league and episode that hasn't been undone: the only one of them Undo can take back.
 * Lines with no Undo of their own (a correction from the shared check) don't stand in the way.
 */
async function latestResults(leagueIds: string[]): Promise<Set<string>> {
  if (!leagueIds.length) return new Set();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (league_id, episode) id FROM league_changes
      WHERE league_id = ANY($1::uuid[]) AND kind LIKE 'results%' AND undone_at IS NULL AND episode IS NOT NULL AND undo IS NOT NULL
      ORDER BY league_id, episode, created_at DESC`,
    [leagueIds]
  );
  return new Set(rows.map((r) => r.id));
}

/** Results changes (and answers sent, step 6b) come off newest first. */
const inOrder = (u: ChangeUndo) => u.type === "results" || u.type === "submission";

/** Whoever runs every game a change touched may undo it; an answer sent, also whoever sent it. */
function canUndo(rows: ChangeRow[], runs: Set<string>, latest: Set<string>, you: string | null = null): boolean {
  const now = Date.now();
  return rows.every(
    (r) =>
      (runs.has(r.league_id) || (r.undo?.type === "submission" && !!you && r.user_id === you)) &&
      r.undo &&
      !r.undone_at &&
      r.undo_until &&
      r.undo_until.getTime() > now &&
      (!inOrder(r.undo) || latest.has(r.id))
  );
}

/** One batch as a line; `names` in the couch's order, which its games are listed in. */
function lineOf(rows: ChangeRow[], names: Map<string, string>, runs: Set<string>, latest: Set<string>, you: string | null = null): ChangeLine {
  const order = [...names.keys()];
  rows = [...rows].sort((a, b) => order.indexOf(a.league_id) - order.indexOf(b.league_id));
  const r = rows[0];
  return {
    batch: r.batch,
    at: r.created_at.toISOString(),
    kind: r.kind,
    tier: r.tier as Tier,
    episode: r.episode,
    text: r.text,
    who: r.user_id ? { userId: r.user_id, name: r.who ?? "someone" } : null,
    games: rows.map((x) => names.get(x.league_id) ?? "a game"),
    undone: r.undone_at ? { at: r.undone_at.toISOString(), by: r.undone_by_name } : null,
    undoUntil: r.undo_until ? r.undo_until.toISOString() : null,
    undoable: canUndo(rows, runs, latest, you),
  };
}

/** Recent changes to the couch's games on a season, newest first, as one line per batch: for anyone on the couch. */
export async function changesFor(user: SessionUser, seasonId: string, couchId: string, limit = 60): Promise<{ lines: ChangeLine[]; runs: boolean }> {
  const { here, runs } = await couchGames(user, seasonId, couchId);
  const ids = here.map((g) => g.leagueId);
  if (!ids.length) return { lines: [], runs: false };
  const { rows } = await pool.query<ChangeRow>(
    `SELECT ${ROW_COLUMNS} FROM league_changes c ${ROW_JOINS}
      WHERE c.batch IN (SELECT batch FROM league_changes WHERE league_id = ANY($1::uuid[]) GROUP BY batch ORDER BY max(created_at) DESC LIMIT $2)
        AND c.league_id = ANY($1::uuid[])
      ORDER BY c.created_at DESC`,
    [ids, limit]
  );
  const names = new Map(here.map((g) => [g.leagueId, g.name]));
  const latest = await latestResults(ids);
  const batches = new Map<string, ChangeRow[]>();
  for (const r of rows) batches.set(r.batch, [...(batches.get(r.batch) ?? []), r]);
  return { lines: [...batches.values()].map((b) => lineOf(b, names, runs, latest, user.id)), runs: runs.size > 0 };
}

/** The newest results batch for an episode in these games (Backstage's quick and full cards), or null. */
export async function latestBatch(leagueIds: string[], episode: number, kind: string, runs: Set<string>, you: string | null = null): Promise<(ChangeLine & { count: number; own: boolean }) | null> {
  if (!leagueIds.length) return null;
  const { rows: last } = await pool.query(
    `SELECT batch FROM league_changes WHERE league_id = ANY($1::uuid[]) AND episode = $2 AND kind = $3 ORDER BY created_at DESC LIMIT 1`,
    [leagueIds, episode, kind]
  );
  if (!last.length) return null;
  const { rows } = await pool.query<ChangeRow & { detail: { count?: number; own?: boolean } | null }>(
    `SELECT ${ROW_COLUMNS}, c.detail, l.name AS league_name FROM league_changes c ${ROW_JOINS} JOIN leagues l ON l.id = c.league_id
      WHERE c.batch = $1 AND c.league_id = ANY($2::uuid[])`,
    [last[0].batch, leagueIds]
  );
  const named = new Map(rows.map((r) => [r.league_id, (r as unknown as { league_name: string }).league_name]));
  const names = new Map(leagueIds.filter((id) => named.has(id)).map((id) => [id, named.get(id)!]));
  const line = lineOf(rows, names, runs, await latestResults(leagueIds), you);
  return { ...line, count: rows[0]?.detail?.count ?? 0, own: !!rows[0]?.detail?.own };
}

// ---- taking one back ----

/**
 * Undoes a batch in every game it changed: you must run each of them, it must still be open (before the next episode
 * airs) and, for results, the newest results change on that episode (undo the later one first). Each league is put back
 * under its own lock, the row marked undone in the same transaction.
 */
export async function undoBatch(user: SessionUser, seasonId: string, couchId: string, batch: string): Promise<{ undone: number; text: string }> {
  const { here, runs } = await couchGames(user, seasonId, couchId);
  const ids = here.map((g) => g.leagueId);
  const { rows } = await pool.query<ChangeRow>(
    `SELECT ${ROW_COLUMNS} FROM league_changes c ${ROW_JOINS} WHERE c.batch = $1 AND c.league_id = ANY($2::uuid[])`,
    [batch, ids]
  );
  if (!rows.length) throw new HttpError(404, "That change isn't here");
  const sent = rows.every((r) => r.undo?.type === "submission" && r.user_id === user.id);
  if (!sent && rows.some((r) => !runs.has(r.league_id))) throw new HttpError(403, "Only whoever runs these games can undo this");
  if (rows.some((r) => r.undone_at)) throw new HttpError(409, "That's already been undone");
  if (rows.some((r) => !r.undo)) throw new HttpError(409, "This one can't be undone here");
  if (rows.some((r) => !r.undo_until || r.undo_until.getTime() <= Date.now())) throw new HttpError(409, "Too late to undo: the next episode has aired");
  if (!canUndo(rows, runs, await latestResults(ids), user.id)) throw new HttpError(409, "Undo the later change to this episode first");

  // An answer someone sent (step 6b): taken back once, for every league on the season, then its lines are marked.
  const first = rows[0].undo!;
  if (first.type === "submission") {
    await withdrawResults(first.researchId, couchId, user.id);
    await pool.query("UPDATE league_changes SET undone_at = now(), undone_by = $3 WHERE batch = $1 AND league_id = ANY($2::uuid[]) AND undone_at IS NULL", [batch, ids, user.id]);
    return { undone: rows.length, text: rows[0].text };
  }

  for (const r of rows) {
    const undo = r.undo!;
    const mark = async (client: PoolClient) => {
      const { rowCount } = await client.query("UPDATE league_changes SET undone_at = now(), undone_by = $2 WHERE id = $1 AND undone_at IS NULL", [r.id, user.id]);
      if (!rowCount) throw new HttpError(409, "That's already been undone");
    };
    if (undo.type === "role") {
      const { rows: m } = await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [r.league_id, undo.userId]);
      if (m[0]?.role !== undo.after) throw new HttpError(409, "Their role has changed since");
      await setLeagueRole(r.league_id, undo.userId, undo.before, mark);
      continue;
    }
    await withLeagueLock(r.league_id, async (s, client) => {
      const settings = s.settings as unknown as Record<string, unknown>;
      if (undo.type === "results") undoResults(s, undo);
      else if (undo.type === "settings") {
        if (JSON.stringify(settings[undo.field] ?? null) !== JSON.stringify(undo.after)) throw new HttpError(409, "That setting has changed since");
        StateLogic.updateSettings(s, undo.field, undo.before);
      } else if (undo.type === "settingsSet") {
        if (Object.keys(undo.after).some((k) => JSON.stringify(settings[k] ?? null) !== JSON.stringify(undo.after[k]))) throw new HttpError(409, "Those settings have changed since");
        for (const [k, v] of Object.entries(undo.before)) {
          if (v === null) delete settings[k];
          else settings[k] = v;
        }
        StateLogic.WaiverLogic.mirrorLegacy(s);
      } else if (undo.type === "ruling") {
        // The house ruling comes off: the shared result applies here again.
        await client.query("DELETE FROM league_rulings WHERE league_id = $1 AND decision_id = $2", [r.league_id, undo.decisionId]);
        await syncLeagueDecisions(client, r.league_id, s, { noCorrections: true });
      } else if (undo.type === "waivers") {
        const p = StateLogic.WaiverLogic.current(s);
        if (!p || p.id !== undo.periodId || p.phase !== "processed" || !p.run) throw new HttpError(409, "That waiver run can't be taken back any more");
        const refused = StateLogic.WaiverLogic.undo(s);
        if (refused) throw new HttpError(409, refused);
      } else if (undo.type === "member") await restoreMember(s, client, r.league_id, undo);
      await mark(client);
    });
    if (undo.type === "member") await joinedLeague(r.league_id, undo.userId);
  }
  return { undone: rows.length, text: rows[0].text };
}

/** Someone taken out of a game (or who left it) comes back: their seat (reclaimed, or a new one if it went before the draft) and membership. */
async function restoreMember(s: LeagueState, client: PoolClient, leagueId: string, undo: MemberUndo): Promise<void> {
  const { rows } = await client.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, undo.userId]);
  if (rows.length) throw new HttpError(409, "They're back in already");
  let playerId = undo.playerId;
  const seat = s.players.find((p) => p.id === playerId);
  if (seat?.disabled && (!seat.disabledFromUserId || seat.disabledFromUserId === undo.userId)) StateLogic.reclaimPlayer(s, playerId);
  else if (undo.removed || !seat) playerId = StateLogic.addPlayer(s, undo.name).id;
  else throw new HttpError(409, "Their seat has changed since");
  await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through, explainer_seen_at) VALUES ($1, $2, $3, $4, $5, now())", [
    leagueId,
    undo.userId,
    playerId,
    undo.role,
    undo.seen,
  ]);
}
