import crypto from "crypto";
import type { Pool, PoolClient } from "pg";
import { resultsDiff, type ResultsUndo } from "@/lib/game/results-changes";
import type { LeagueState } from "@/lib/game/types";

// Writing Recent changes (docs/PLAN-new-design.md step 5; db/migrations/0111): every change someone makes to a game for
// others appends a line in the same transaction as the change: withLeagueLock's `change` (db.ts), or recordChange with
// the write's own client. Reading them and Undo are league-changes.ts. Guards by blast radius: tier 1 (affects others,
// reversible) and tier 2 (moves standings) carry their undo, open until the next episode airs; tier 3 (hard to undo:
// someone taken out of the games, or leaving them) is restorable for 30 days. A player's own moves (their lineup, their pick) are tier 0 and aren't logged. Lines are written to give nothing
// away: "Applied Episode 6's results to 3 games", never who went home. Kept apart from db.ts's imports' other way round.

export type Tier = 0 | 1 | 2 | 3;

/** A settings field put back (tier 1): only fields whose change does nothing else (SIDE_EFFECTS). */
export interface SettingsUndo {
  type: "settings";
  field: string;
  before: unknown;
  after: unknown;
}

/** A role handed back (tier 1). */
export interface RoleUndo {
  type: "role";
  userId: string;
  before: string;
  after: string;
}

/** Several settings put back at once (a waiver feel, Reset to recommended, Fine-tune). A field absent before is removed. */
export interface SettingsSetUndo {
  type: "settingsSet";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** A waiver run taken back (tier 2), while its free agency is still open (WaiverLogic.undo). */
export interface WaiverRunUndo {
  type: "waivers";
  periodId: string;
}

/** Someone taken out of a game, or who left it (tier 3): their seat and membership come back. */
export interface MemberUndo {
  type: "member";
  userId: string;
  playerId: string;
  name: string;
  role: string;
  seen: number | null;
  /** Before the draft the seat went entirely (a new one comes back); after it, it was disabled and is reclaimed. */
  removed: boolean;
}

export type ChangeUndo = ResultsUndo | SettingsUndo | RoleUndo | SettingsSetUndo | WaiverRunUndo | MemberUndo;

export interface ChangeSpec {
  /** Who did it; null when it applied on its own. */
  userId: string | null;
  /** results.quick (who went home), results.full, results (entered another way), settings, role, waivers, ... */
  kind: string;
  tier: Tier;
  /** The line everyone on the couch reads: names nobody who went home. */
  text: string;
  episode?: number | null;
  detail?: Record<string, unknown> | null;
  undo?: ChangeUndo | null;
  /** One action across several games shares a batch (one line on the page). */
  batch?: string;
  /** Until when Undo is open, when it isn't the next episode's airtime (tier 3: 30 days). */
  undoUntil?: Date;
}

/** A change worked out once the write has run, from the league before and after it; null when there's nothing to log. */
export type ChangeOf = ChangeSpec | ((before: LeagueState, after: LeagueState) => ChangeSpec | null);

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Until when a change can be undone: the next episode's airtime (after `episode`, else the next to air), else a week. */
function undoUntil(state: Pick<LeagueState, "episodes"> | null, episode: number | null | undefined): Date {
  const now = Date.now();
  const airs = (state?.episodes ?? [])
    .filter((e) => e.airsAt && (episode != null ? e.number > episode : Date.parse(e.airsAt) > now))
    .map((e) => Date.parse(e.airsAt!))
    .filter((t) => t > now);
  return new Date(airs.length ? Math.min(...airs) : now + WEEK_MS);
}

/**
 * Appends one change, inside the write's own transaction. Its own savepoint: a line that can't be written is logged and
 * left out, and never takes the write down with it (the classic app's writes go through here too).
 */
export async function recordChange(client: PoolClient, leagueId: string, state: Pick<LeagueState, "episodes"> | null, spec: ChangeSpec): Promise<void> {
  await client.query("SAVEPOINT league_change");
  try {
    await client.query(
      `INSERT INTO league_changes (batch, league_id, user_id, kind, tier, episode, text, detail, undo, undo_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
      [
        spec.batch ?? crypto.randomUUID(),
        leagueId,
        spec.userId,
        spec.kind,
        spec.tier,
        spec.episode ?? null,
        spec.text,
        spec.detail ? JSON.stringify(spec.detail) : null,
        spec.undo ? JSON.stringify(spec.undo) : null,
        spec.undo ? (spec.undoUntil ?? undoUntil(state, spec.episode)) : null,
      ]
    );
    await client.query("RELEASE SAVEPOINT league_change");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT league_change");
    console.error(`[league-changes] league ${leagueId}: couldn't log "${spec.text}":`, e);
  }
}

// ---- what the routes pass ----

/** A results change to the episode `epId` (or numbered `episode`): the line, and the exact undo from the diff. */
export function resultsChange(
  userId: string | null,
  episode: { epId: string } | { number: number },
  text: (n: number) => string,
  more: Partial<Pick<ChangeSpec, "kind" | "batch" | "detail">> = {}
): ChangeOf {
  return (before, after) => {
    const n = "number" in episode ? episode.number : (after.episodes.find((e) => e.id === episode.epId) ?? before.episodes.find((e) => e.id === episode.epId))?.number;
    if (n == null) return null;
    const undo = resultsDiff(before, after, n);
    if (!undo) return null;
    return { userId, kind: more.kind ?? "results", tier: 2, episode: n, text: text(n), undo, batch: more.batch, detail: more.detail };
  };
}

// Settings whose change does more than set a value (a show, a season, the reveal pointer, the waiver suggestion sync
// casts, results and rules): logged, but put back by hand, not by Undo.
const SIDE_EFFECTS = new Set(["showId", "wikiSeason", "revealedThroughEpisode", "waiverRecommendation"]);
const words = (field: string) => field.replace(/([A-Z])/g, " $1").toLowerCase().trim();

/** A settings change (tier 1), with Undo where putting the old value back does nothing else. */
export function settingsChange(userId: string, field: string): ChangeOf {
  return (before, after) => {
    const was = (before.settings as unknown as Record<string, unknown>)[field];
    const now = (after.settings as unknown as Record<string, unknown>)[field];
    if (JSON.stringify(was) === JSON.stringify(now)) return null;
    return {
      userId,
      kind: "settings",
      tier: SIDE_EFFECTS.has(field) ? 2 : 1,
      text: `Changed the game's settings (${words(field)})`,
      detail: { field },
      undo: SIDE_EFFECTS.has(field) ? null : { type: "settings", field, before: was ?? null, after: now ?? null },
    };
  };
}

// Settings Backstage never changes as a set, and the big ones a settings diff shouldn't carry.
const NOT_A_SETTING = new Set(["showFormat", "showFormatData", "leagueRulesetData", "seasonRuleChanges", "adoptedRuleChanges", "declinedRuleChanges", "rulebook", "eventPoints"]);

/** Several settings changed at once (tier 1): the line, and an Undo that puts every changed field back as it was. */
export function settingsSetChange(userId: string, text: string, opts: { kind?: string; batch?: string } = {}): ChangeOf {
  return (before, after) => {
    const was = before.settings as unknown as Record<string, unknown>;
    const now = after.settings as unknown as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => !NOT_A_SETTING.has(k) && JSON.stringify(was[k]) !== JSON.stringify(now[k]));
    if (!fields.length) return null;
    const pick = (o: Record<string, unknown>) => Object.fromEntries(fields.map((k) => [k, o[k] === undefined ? null : o[k]]));
    return { userId, kind: opts.kind ?? "settings", tier: 1, text, batch: opts.batch, detail: { fields }, undo: { type: "settingsSet", before: pick(was), after: pick(now) } };
  };
}

/** A change made for the game that isn't results or settings: the line only (`tier` 1 unless it moves standings). */
export function plainChange(userId: string, kind: string, text: string, tier: Tier = 1): ChangeSpec {
  return { userId, kind, tier, text };
}

/** A change to one episode that isn't its results (its lineups locked, the episode edited or deleted): the line only. */
export function episodeChange(userId: string, epId: string, kind: string, text: (n: number) => string, tier: Tier = 1): ChangeOf {
  return (before, after) => {
    const n = (before.episodes.find((e) => e.id === epId) ?? after.episodes.find((e) => e.id === epId))?.number;
    return n == null ? null : { userId, kind, tier, text: text(n) };
  };
}

/** Something done for one player (their lineup, their pick, their draft pick): a change only when it's someone else's seat. */
export function forPlayerChange(userId: string, actorPlayerId: string | null, playerId: string, kind: string, text: (name: string) => string): ChangeOf {
  return (_before, after) => {
    if (actorPlayerId && actorPlayerId === playerId) return null;
    const name = after.players.find((p) => p.id === playerId)?.name ?? "someone";
    return { userId, kind, tier: 1, text: text(name) };
  };
}

const ROLE_WORDS: Record<string, string> = { commissioner: "a Commissioner", admin: "a Game admin", member: "a player" };

/** A role change (tier 1), written inside setLeagueRole's transaction, with Undo that hands the old role back. */
export async function roleChange(client: PoolClient, leagueId: string, actorId: string, userId: string, before: string, after: string, batch?: string): Promise<void> {
  if (before === after) return;
  const { rows } = await client.query(
    `SELECT COALESCE(u.username, u.name) AS name, (SELECT state->'episodes' FROM leagues WHERE id = $1) AS episodes FROM "user" u WHERE u.id = $2`,
    [leagueId, userId]
  );
  await recordChange(client, leagueId, { episodes: rows[0]?.episodes ?? [] }, {
    userId: actorId,
    kind: "role",
    tier: 1,
    text: `Made ${rows[0]?.name ?? "someone"} ${ROLE_WORDS[after] ?? after}`,
    undo: { type: "role", userId, before, after },
    batch,
  });
}

/**
 * A change made outside withLeagueLock (scoring rules, the game's name, the cast from the season, linking games): its
 * line in a transaction of its own, right after the write. Best effort, as recordChange.
 */
export async function logChange(db: Pool, leagueId: string, spec: ChangeSpec): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state->'episodes' AS episodes FROM leagues WHERE id = $1", [leagueId]);
    await recordChange(client, leagueId, { episodes: rows[0]?.episodes ?? [] }, spec);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[league-changes] league ${leagueId}: couldn't log "${spec.text}":`, e);
  } finally {
    client.release();
  }
}
