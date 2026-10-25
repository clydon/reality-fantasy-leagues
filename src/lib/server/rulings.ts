import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { applyDecision, orderPlacementsByEpisode, undoDetail, type DecisionFact, type LedgerDetail } from "@/lib/game/decision-apply";
import { publicMediaSrc } from "@/lib/game/selectors";
import { previewLines, type PreviewLine } from "@/lib/game/results-changes";
import type { LeagueState } from "@/lib/game/types";
import type { BackstageScope } from "./backstage";
import { pool, withLeagueLock, HttpError } from "./db";
import { leagueStates } from "./league-states";
import { seasonCastRefs, syncLeagueDecisions, type CorrectedFact } from "./season-decisions";

// Corrections and house rulings (docs/PLAN-new-design.md step 6b). When the shared check takes a result out of a game
// (or changes it), the season sync leaves a line in that game's Recent changes (kind results.correction) with what changed
// and each player's points. These read them back for a couch: the episode's plate, the line in Episodes, and Backstage ›
// Results' Corrections, where whoever runs the games may keep the old result as a HOUSE RULING (league_rulings): previewed
// first (tier 2), for every game of theirs it reached at once (linked leagues rule together), shown to their players on the
// episode, and never in the shared facts or stats. Dropping it lets the correction apply. A correction that ADDS (a result
// the shared check confirmed after the episode's results were in, step 6b part 3) is refused the same way: the ruling
// keeps it out (`keeps.absent`).

export interface Correction {
  episode: number;
  at: string;
  decisionId: string;
  name: string;
  /** "Found an idol", "Voted Out". */
  label: string;
  change: "removed" | "changed" | "added";
  /** What it says now, when it changed ("Brady Booker · Quit"). */
  to: string | null;
  /** Your points in each game it changed. */
  you: { game: string; delta: number }[];
  /** Each game it reached, with everyone whose points moved. */
  games: { leagueId: string; name: string; deltas: { name: string; delta: number }[] }[];
  /** The house ruling that keeps the old result, if one does. */
  ruling: { by: string | null; at: string } | null;
}

interface CorrectionRow {
  league_id: string;
  league_name: string;
  episode: number;
  created_at: Date;
  detail: { facts: CorrectedFact[]; deltas: Record<string, number> };
}

/**
 * The corrections that reached these games, newest first, for episodes up to `seen` (they name who and what). Only one
 * still true: a result taken out that hasn't come back, or one changed that hasn't changed again.
 */
export async function couchCorrections(leagueIds: string[], seen: number, viewerId: string): Promise<Correction[]> {
  if (!leagueIds.length) return [];
  const { rows } = await pool.query<CorrectionRow>(
    `SELECT c.league_id, l.name AS league_name, c.episode, c.created_at, c.detail
       FROM league_changes c JOIN leagues l ON l.id = c.league_id
      WHERE c.league_id = ANY($1::uuid[]) AND c.kind = 'results.correction' AND c.episode <= $2
      ORDER BY c.created_at DESC LIMIT 100`,
    [leagueIds, Number.isFinite(seen) ? seen : 100000]
  );
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((r) => r.detail.facts.map((f) => f.id)))];
  const { rows: now } = await pool.query<{ id: string; status: string; method: string; castaway_name: string }>(
    "SELECT id, status, method, castaway_name FROM season_decisions WHERE id = ANY($1::uuid[])",
    [ids]
  );
  const current = new Map(now.map((d) => [d.id, d]));
  const { rows: rulings } = await pool.query<{ league_id: string; decision_id: string; created_at: Date; who: string | null }>(
    `SELECT r.league_id, r.decision_id, r.created_at, COALESCE(u.username, u.name) AS who FROM league_rulings r LEFT JOIN "user" u ON u.id = r.ruled_by
      WHERE r.league_id = ANY($1::uuid[]) AND r.decision_id = ANY($2::uuid[])`,
    [leagueIds, ids]
  );
  const { rows: seats } = await pool.query<{ league_id: string; player_id: string }>(
    "SELECT league_id, player_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND user_id = $2 AND player_id IS NOT NULL",
    [leagueIds, viewerId]
  );
  const mine = new Map(seats.map((s) => [s.league_id, s.player_id]));
  const states = await leagueStates(leagueIds);
  const playerName = (leagueId: string, playerId: string) => (states.get(leagueId) as LeagueState | undefined)?.players.find((p) => p.id === playerId)?.name ?? "someone";

  const out = new Map<string, Correction>();
  for (const r of rows) {
    for (const f of r.detail.facts) {
      const d = current.get(f.id);
      const stillTrue = f.change === "removed" ? d?.status !== "accepted" : d?.status === "accepted";
      // An addition is still true while the result is in; a later answer can only take it out again.
      if (!stillTrue) continue;
      const key = `${r.episode}|${f.id}`;
      let c = out.get(key);
      if (!c) {
        const ruled = rulings.find((x) => x.decision_id === f.id);
        c = {
          episode: r.episode,
          at: r.created_at.toISOString(),
          decisionId: f.id,
          name: f.name,
          label: f.label,
          change: f.change,
          to: f.to,
          you: [],
          games: [],
          ruling: ruled ? { by: ruled.who, at: ruled.created_at.toISOString() } : null,
        };
        out.set(key, c);
      }
      // One game's newest correction of this result is the one that counts there.
      if (c.games.some((g) => g.leagueId === r.league_id)) continue;
      const deltas = Object.entries(r.detail.deltas ?? {}).map(([p, delta]) => ({ name: playerName(r.league_id, p), delta, player: p }));
      c.games.push({ leagueId: r.league_id, name: r.league_name, deltas: deltas.map(({ name, delta }) => ({ name, delta })) });
      const me = deltas.find((x) => x.player === mine.get(r.league_id));
      if (me) c.you.push({ game: r.league_name, delta: me.delta });
    }
  }
  return [...out.values()];
}

/** The result as it was before the correction, in the games of yours it reached: what a ruling keeps. */
async function kept(scope: BackstageScope, decisionId: string) {
  const ids = scope.games.map((g) => g.leagueId);
  const { rows } = await pool.query<CorrectionRow & { batch: string }>(
    `SELECT DISTINCT ON (c.league_id) c.league_id, l.name AS league_name, c.episode, c.created_at, c.detail, c.batch
       FROM league_changes c JOIN leagues l ON l.id = c.league_id
      WHERE c.league_id = ANY($1::uuid[]) AND c.kind = 'results.correction' AND c.detail->'facts' @> $2::jsonb
      ORDER BY c.league_id, c.created_at DESC`,
    [ids, JSON.stringify([{ id: decisionId }])]
  );
  if (!rows.length) throw new HttpError(404, "That correction didn't reach your games");
  const fact = rows[0].detail.facts.find((f) => f.id === decisionId)!;
  return { rows, fact, episode: rows[0].episode };
}

/**
 * Keeps the old result as a house ruling, in every game of yours the correction reached (tier 2): `preview` says what it
 * does to each game first and writes nothing.
 */
export async function keepOldResult(scope: BackstageScope, decisionId: string, opts: { preview?: boolean } = {}): Promise<{ lines: PreviewLine[]; games: number } | { games: number; batch: string }> {
  const { rows, fact, episode } = await kept(scope, decisionId);
  const { rows: already } = await pool.query("SELECT 1 FROM league_rulings WHERE decision_id = $1 AND league_id = ANY($2::uuid[])", [decisionId, rows.map((r) => r.league_id)]);
  if (already.length) throw new HttpError(409, "Your games already keep the old result");
  const keeps = fact.was as DecisionFact;
  if (opts.preview) {
    const states = await leagueStates(rows.map((r) => r.league_id));
    const { rows: seats } = await pool.query("SELECT player_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND player_id IS NOT NULL", [rows.map((r) => r.league_id)]);
    const users = new Map(seats.map((s) => [s.player_id, s.user_id]));
    const client = await pool.connect();
    try {
      const refs = await seasonCastRefs(client, scope.seasonId);
      // First the result itself, as your games will count it again (or, for one the check added, won't).
      const any = states.get(rows[0].league_id) as LeagueState | undefined;
      const who = any?.castaways.find((c) => c.name === fact.name);
      const absent = (keeps as { absent?: boolean }).absent === true;
      const lines: PreviewLine[] = [{ face: { kind: "castaway", name: fact.name, photo: publicMediaSrc(who?.photoUrl) }, label: `${fact.name.split(" ")[0]} · ${fact.label} · Episode ${episode}`, change: absent ? "Not counted here" : "Counts here", dir: null }];
      const { rows: ledger } = absent
        ? await client.query("SELECT league_id, detail FROM league_applied_decisions WHERE decision_id = $1 AND league_id = ANY($2::uuid[])", [decisionId, rows.map((r) => r.league_id)])
        : { rows: [] as { league_id: string; detail: LedgerDetail }[] };
      for (const r of rows) {
        const before = states.get(r.league_id) as LeagueState | undefined;
        if (!before) continue;
        const after = structuredClone(before);
        if (absent) {
          const entry = ledger.find((x) => x.league_id === r.league_id);
          if (entry) undoDetail(after, entry.detail);
        } else applyDecision(after, keeps, refs);
        if (keeps.kind === "elimination") orderPlacementsByEpisode(after);
        const game = scope.games.find((g) => g.leagueId === r.league_id);
        lines.push(...previewLines(before, after, game?.gameName ?? r.league_name, (p) => users.get(p) ?? null));
      }
      return { lines, games: rows.length };
    } finally {
      client.release();
    }
  }
  const batch = crypto.randomUUID();
  for (const r of rows) {
    await withLeagueLock(
      r.league_id,
      async (s, client) => {
        await client.query("INSERT INTO league_rulings (league_id, decision_id, keeps, ruled_by) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT DO NOTHING", [
          r.league_id,
          decisionId,
          JSON.stringify(keeps),
          scope.user.id,
        ]);
        await syncLeagueDecisions(client, r.league_id, s, { noCorrections: true });
      },
      {
        userId: scope.user.id,
        kind: "results.ruling",
        tier: 2,
        episode,
        text: (keeps as { absent?: boolean }).absent ? `House ruling: Episode ${episode}'s added result doesn't count here` : `House ruling: kept Episode ${episode}'s old result`,
        batch,
        detail: { decisionId, name: fact.name, label: fact.label },
        undo: { type: "ruling", decisionId, episode },
      }
    );
  }
  return { games: rows.length, batch };
}

/** Drops a house ruling in your games: the correction applies there again. */
export async function dropRuling(scope: BackstageScope, decisionId: string): Promise<{ games: number }> {
  const ids = scope.games.map((g) => g.leagueId);
  const { rows } = await pool.query<{ league_id: string; episode: number }>(
    "SELECT r.league_id, (r.keeps->>'episode_number')::int AS episode FROM league_rulings r WHERE r.decision_id = $1 AND r.league_id = ANY($2::uuid[])",
    [decisionId, ids]
  );
  if (!rows.length) throw new HttpError(404, "There's no ruling on that here");
  const batch = crypto.randomUUID();
  for (const r of rows) {
    await withLeagueLock(
      r.league_id,
      async (s, client) => {
        await client.query("DELETE FROM league_rulings WHERE league_id = $1 AND decision_id = $2", [r.league_id, decisionId]);
        await syncLeagueDecisions(client, r.league_id, s, { noCorrections: true });
        // The ruling's own line can't be undone any more: there's nothing left to drop.
        await client.query(
          "UPDATE league_changes SET undone_at = now(), undone_by = $3 WHERE league_id = $1 AND kind = 'results.ruling' AND undone_at IS NULL AND undo->>'decisionId' = $2",
          [r.league_id, decisionId, scope.user.id]
        );
      },
      { userId: scope.user.id, kind: "results.ruling", tier: 2, episode: r.episode, text: `Dropped the house ruling on Episode ${r.episode}`, batch, detail: { decisionId }, undo: null }
    );
  }
  return { games: rows.length };
}

/** A league's rulings for an episode, for its page: "House ruling (alex): Brady's idol still counts here". */
export async function rulingsFor(leagueIds: string[], episode: number): Promise<{ decisionId: string; leagueId: string; by: string | null; name: string; label: string; absent: boolean }[]> {
  if (!leagueIds.length) return [];
  const { rows } = await pool.query(
    `SELECT r.decision_id, r.league_id, COALESCE(u.username, u.name) AS who, r.keeps
       FROM league_rulings r LEFT JOIN "user" u ON u.id = r.ruled_by
      WHERE r.league_id = ANY($1::uuid[]) AND (r.keeps->>'episode_number')::int = $2`,
    [leagueIds, episode]
  );
  const states = await leagueStates([...new Set(rows.map((r) => r.league_id as string))]);
  return rows.map((r) => {
    const state = states.get(r.league_id) as LeagueState | undefined;
    const k = r.keeps as DecisionFact;
    const label =
      k.kind === "event"
        ? ((state ? StateLogic.formatOf(state).events.find((e) => e.id === k.event_type)?.label : null) ?? k.event_type)
        : k.kind === "noexit"
          ? "Nobody went home"
          : k.method || k.kind;
    return { decisionId: r.decision_id, leagueId: r.league_id, by: r.who, name: k.castaway_name, label, absent: (r.keeps as { absent?: boolean }).absent === true };
  });
}
