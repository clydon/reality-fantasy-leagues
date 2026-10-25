import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { researchItems } from "@db/episode-research.js";
import { canonicalName, seasonCastState } from "@db/season-decisions.js";
import { seasonFormat } from "@db/season-rule-changes.js";
import { settleEpisode, sourcesLine, type Covers, type FactInput, type FactOutcome, type FactStatus, type Flag, type Submission } from "@/lib/game/fact-status";
import type { LeagueState } from "@/lib/game/types";
import { isUuid, type SessionUser } from "./auth-helpers";
import { logChange } from "./change-log";
import { requireCouch } from "./couches";
import { pool, HttpError } from "./db";
import { seenThrough } from "./guard";
import { syncSeasonLeagues } from "./season-decisions";

// Results from everyone (docs/PLAN-new-design.md step 6b; db/migrations/0112). Facts are shared per season, one
// answer per fact whichever couch asks; points stay each game's own. Every answer anyone sends (a couch's paste, who
// went home, entered by hand, a ticked result) is a submission of its own in episode_research, and a source for each
// fact it reports (fact_sources). After each one, the episode's facts are settled again from all their sources and
// flags (fact-status.ts) and every league on the season is brought in line (the season sync, season-decisions.ts): what's
// trusted reaches every couch on its own, a correction comes out everywhere with a line, and a house ruling keeps the old
// result in one couch's games. Taking your answer back (Undo) withdraws the submission and settles everything again.

export type SubmissionSource = "paste" | "quick" | "hand" | "bot" | "autopilot" | "tiebreak";

/** One result a submission reports. `noexit`: nobody went home in the episode (no castaway: castawayName ''). */
export interface SubmittedFact {
  kind: "elimination" | "event" | "exiled" | "role" | "group" | "noexit";
  castawayName: string;
  method?: string | null;
  eventType?: string | null;
  confidence?: "high" | "medium" | "low";
  sources?: string[];
  units?: number | null;
  juryVotes?: number | null;
  postMerge?: boolean;
}

export interface SubmitInput {
  seasonId: string;
  episode: number;
  source: SubmissionSource;
  userId: string | null;
  couchId: string | null;
  covers: Covers;
  facts: SubmittedFact[];
  payload?: unknown;
  provenance?: Record<string, unknown>;
}

/** What settling an episode moved: facts that now reach every league, ones that came out, ones whose content changed. */
export interface Settled {
  live: string[];
  out: string[];
  changed: string[];
}

const lockKey = (seasonId: string, episode: number) => `facts:${seasonId}:${episode}`;

/**
 * A full answer's facts, with "nobody went home" when it names nobody who left (step 6c): a full answer speaks for every
 * kind of result, so its silence about exits is an answer, and it's what lets an episode with no elimination settle. Only
 * for a show people leave (its format has ways out).
 */
export function withNobodyOut(facts: SubmittedFact[], format: { exitMethods?: string[] } | null | undefined): SubmittedFact[] {
  if (!format?.exitMethods?.length || facts.some((f) => f.kind === "elimination")) return facts;
  return [...facts, { kind: "noexit", castawayName: "", confidence: "high" }];
}

/** How many sources confirm a fact (the desk's Settings, app_settings 'confirm_at'; 2 by default). */
export async function confirmAt(db: { query: PoolClient["query"] } = pool): Promise<number> {
  const { rows } = await db.query("SELECT value FROM app_settings WHERE key = 'confirm_at'");
  const n = Number(rows[0]?.value);
  return Number.isInteger(n) && n >= 2 ? n : 2;
}

async function seasonKey(client: PoolClient, seasonId: string): Promise<{ showId: string; season: number }> {
  const { rows } = await client.query("SELECT show_id, season_number FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  return { showId: rows[0].show_id, season: rows[0].season_number };
}

/** Files one submission and its facts, then settles the episode again. In its own transaction. */
export async function submit(input: SubmitInput): Promise<{ researchId: string; settled: Settled; facts: string[] }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey(input.seasonId, input.episode)]);
    const key = await seasonKey(client, input.seasonId);
    const { rows } = await client.query(
      `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb) RETURNING id`,
      [
        key.showId,
        key.season,
        input.episode,
        JSON.stringify(input.payload ?? { facts: input.facts }),
        JSON.stringify({ provider: input.source, researchedAt: new Date().toISOString(), ...(input.provenance ?? {}) }),
        input.source,
        input.userId,
        input.couchId,
        JSON.stringify(input.covers),
      ]
    );
    const researchId: string = rows[0].id;
    const facts = await fileFacts(client, input.seasonId, input.episode, researchId, input.facts);
    const settled = await settle(client, input.seasonId, key, input.episode);
    await client.query("COMMIT");
    return { researchId, settled, facts };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Files the facts one submission reports and its sources for them (a fact new to the season is reported; a result staged
 *  before and never reviewed takes this version; one an admin decided keeps its decision). Inside the caller's transaction. */
async function fileFacts(client: PoolClient, seasonId: string, episode: number, researchId: string, given: SubmittedFact[]): Promise<string[]> {
  const seen = new Set<string>();
  const facts: string[] = [];
  // The season cast's own spelling, so the same person from any couch lands on one fact.
  const castState = await seasonCastState(client, seasonId);
  for (const one of given) {
    const f = { ...one, castawayName: one.kind === "noexit" ? "" : canonicalName(castState, one.castawayName) };
    const identity = `${f.kind}|${f.castawayName.toLowerCase()}|${f.eventType ?? ""}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    // A result staged before and never reviewed (no fact_status) takes this source's version; one an admin decided
    // keeps its decision (canonical or removed, locked).
    const { rows: d } = await client.query(
      `INSERT INTO season_decisions
         (season_id, episode_number, post_merge, kind, castaway_name, method, event_type, confidence, from_research, research_id,
          sources, jury_votes, units, status, fact_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12, 'pending', 'reported', clock_timestamp())
       ON CONFLICT (season_id, episode_number, kind, castaway_name, event_type) DO UPDATE SET
         method = CASE WHEN season_decisions.fact_status IS NULL AND season_decisions.status = 'pending' THEN EXCLUDED.method ELSE season_decisions.method END,
         confidence = CASE WHEN season_decisions.fact_status IS NULL AND season_decisions.status = 'pending' THEN EXCLUDED.confidence ELSE season_decisions.confidence END,
         jury_votes = COALESCE(season_decisions.jury_votes, EXCLUDED.jury_votes),
         units = COALESCE(season_decisions.units, EXCLUDED.units),
         post_merge = season_decisions.post_merge OR EXCLUDED.post_merge,
         from_research = true,
         locked_at = CASE WHEN season_decisions.fact_status IS NULL AND season_decisions.status <> 'pending' THEN COALESCE(season_decisions.decided_at, now()) ELSE season_decisions.locked_at END,
         fact_status = COALESCE(season_decisions.fact_status,
           CASE season_decisions.status WHEN 'accepted' THEN 'canonical' WHEN 'rejected' THEN 'removed' ELSE 'reported' END)
       RETURNING id`,
      [
        seasonId,
        episode,
        !!f.postMerge,
        f.kind,
        f.castawayName,
        f.method ?? "",
        f.eventType ?? "",
        f.confidence ?? "high",
        researchId,
        f.sources ?? [],
        Number.isInteger(f.juryVotes) ? f.juryVotes : null,
        f.units != null && Number.isFinite(f.units) && f.units > 0 ? f.units : null,
      ]
    );
    facts.push(d[0].id);
    await client.query(
      `INSERT INTO fact_sources (decision_id, research_id, method, confidence) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [d[0].id, researchId, f.method ?? "", f.confidence ?? "high"]
    );
  }
  return facts;
}

interface FactRow {
  id: string;
  kind: string;
  castaway_name: string;
  method: string;
  event_type: string;
  status: string;
  fact_status: FactStatus | null;
  locked: boolean;
}

/** Everything one episode's facts are settled from: the facts, the submissions that count, their sources and flags. */
async function inputsFor(db: PoolClient | typeof pool, seasonId: string, key: { showId: string; season: number }, episode: number, opts: { locked?: boolean } = {}) {
  const { rows: facts } = await db.query<FactRow>(
    `SELECT id, kind, castaway_name, method, event_type, status, fact_status, locked_at IS NOT NULL AS locked
       FROM season_decisions
      WHERE season_id = $1 AND episode_number = $2 AND fact_status IS NOT NULL ${opts.locked ? "" : "AND locked_at IS NULL"}
      ORDER BY (kind = 'elimination') DESC, created_at`,
    [seasonId, episode]
  );
  const { rows: subs } = await db.query<{ id: string; key: string; at: Date; covers: Covers | null; source: string; submitted_by: string | null; couch_id: string | null }>(
    `SELECT id, COALESCE(submitted_by, 'bot:' || source) AS key, researched_at AS at, covers, source, submitted_by, couch_id
       FROM episode_research
      WHERE show_id = $1 AND season_number = $2 AND episode_number = $3 AND source <> 'combined' AND withdrawn_at IS NULL
      ORDER BY researched_at`,
    [key.showId, key.season, episode]
  );
  const ids = facts.map((f) => f.id);
  const { rows: sources } = ids.length
    ? await db.query<{ decision_id: string; research_id: string; method: string; confidence: string }>(
        "SELECT decision_id, research_id, method, confidence FROM fact_sources WHERE decision_id = ANY($1::uuid[])",
        [ids]
      )
    : { rows: [] };
  const { rows: flags } = await db.query<{ id: string; decision_id: string | null; status: Flag["status"]; created_at: Date; user_id: string | null; couch_id: string | null; reason: string; note: string }>(
    "SELECT id, decision_id, status, created_at, user_id, couch_id, reason, note FROM fact_disputes WHERE season_id = $1 AND episode_number = $2 ORDER BY created_at",
    [seasonId, episode]
  );
  const submissions: Submission[] = subs.map((s) => ({ id: s.id, key: s.key, at: s.at.getTime(), covers: s.covers ?? { only: true } }));
  const inputs: FactInput[] = facts.map((f) => ({
    id: f.id,
    kind: f.kind,
    castawayName: f.castaway_name,
    method: f.method,
    live: f.status === "accepted",
    factStatus: f.fact_status,
    locked: f.locked,
    sources: sources.filter((s) => s.decision_id === f.id).map((s) => ({ researchId: s.research_id, method: s.method, confidence: s.confidence })),
    flags: flags.filter((x) => x.decision_id === f.id).map((x) => ({ id: x.id, status: x.status, at: x.created_at.getTime() })),
  }));
  return { facts, subs, submissions, inputs, flags };
}

/** Settles one episode's facts again from their sources and flags, and writes what moved. Inside the caller's transaction. */
async function settle(client: PoolClient, seasonId: string, key: { showId: string; season: number }, episode: number): Promise<Settled> {
  const { facts, submissions, inputs, flags } = await inputsFor(client, seasonId, key, episode);
  const outcomes = settleEpisode(inputs, submissions, { confirmAt: await confirmAt(client) });
  const out: Settled = { live: [], out: [], changed: [] };
  for (const o of outcomes) {
    const f = facts.find((x) => x.id === o.id)!;
    const status = o.live ? "accepted" : o.factStatus === "removed" ? "rejected" : "pending";
    const method = o.method ?? f.method;
    if (status === f.status && o.factStatus === f.fact_status && method === f.method) continue;
    // A new version for the leagues (decided_at is what the season sync's ledger compares): when it goes in or comes
    // out, or what it says changes. Only its status moving (reported to confirmed) changes nothing anywhere.
    const moved = status !== f.status || method !== f.method;
    await client.query(
      `UPDATE season_decisions SET fact_status = $2, status = $3, method = $4,
              decided_at = CASE WHEN $5 THEN clock_timestamp() ELSE decided_at END, decided_by = CASE WHEN $5 THEN NULL ELSE decided_by END
        WHERE id = $1`,
      [o.id, o.factStatus, status, method, moved]
    );
    if (status === "accepted" && f.status !== "accepted") out.live.push(o.id);
    else if (status !== "accepted" && f.status === "accepted") out.out.push(o.id);
    else if (method !== f.method && status === "accepted") out.changed.push(o.id);
  }
  for (const o of outcomes) {
    for (const s of o.settle) await client.query("UPDATE fact_disputes SET status = $2, settled_at = now() WHERE id = $1 AND status = 'open'", [s.id, s.status]);
  }
  // "Something's missing": looked at again once a full answer for the episode comes in after it.
  const full = submissions.filter((s) => !("only" in s.covers) && s.covers.kinds === null);
  for (const x of flags.filter((f) => !f.decision_id && f.status === "open")) {
    if (full.some((s) => s.at > x.created_at.getTime())) await client.query("UPDATE fact_disputes SET status = 'checked', settled_at = now() WHERE id = $1", [x.id]);
  }
  return out;
}

/** Settles one episode again on its own (a flag, a withdrawal), in a transaction under the episode's lock. */
export async function settleNow(seasonId: string, episode: number, before?: (client: PoolClient) => Promise<void>): Promise<Settled> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey(seasonId, episode)]);
    if (before) await before(client);
    const settled = await settle(client, seasonId, await seasonKey(client, seasonId), episode);
    await client.query("COMMIT");
    return settled;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Sends an answer: files it, settles the episode, and brings every league on the season in line. `log` is the line the
 * sender's couch gets in Recent changes (its Undo takes the answer back). Returns how many of the couch's games changed.
 */
export async function sendResults(
  input: SubmitInput,
  log: { kind: string; text: (count: number) => string; detail?: Record<string, unknown> }
): Promise<{ researchId: string; batch: string; games: number; leagues: number; settled: Settled; facts: string[]; count: number }> {
  const sent = await submit(input);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM season_decisions WHERE id = ANY($1::uuid[]) AND status = 'accepted'", [sent.facts]);
  const count: number = rows[0].n;
  const batch = crypto.randomUUID();
  const synced = await syncSeasonLeagues(input.seasonId, input.userId, {
    log: {
      kind: log.kind,
      text: log.text(count),
      detail: { count, ...(log.detail ?? {}) },
      couchId: input.couchId,
      episode: input.episode,
      userId: input.userId,
      batch,
      undo: { type: "submission", researchId: sent.researchId, episode: input.episode },
    },
  });
  const games = synced.filter((s) => s.couchId === input.couchId && s.episodes.includes(input.episode)).length;
  const leagues = synced.filter((s) => s.episodes.includes(input.episode)).length;
  return { ...sent, batch, games, leagues, count };
}

/** Takes an answer back: it stops counting, the episode settles again, and every league follows. */
export async function withdrawResults(researchId: string, couchId: string | null, actorId: string): Promise<Settled> {
  const { rows } = await pool.query(
    `SELECT er.episode_number, ss.id AS season_id FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE er.id = $1 AND er.source <> 'combined'`,
    [researchId]
  );
  if (!rows.length) throw new HttpError(404, "That answer isn't here any more");
  const { episode_number: episode, season_id: seasonId } = rows[0];
  const settled = await settleNow(seasonId, episode, async (client) => {
    await client.query("UPDATE episode_research SET withdrawn_at = now() WHERE id = $1 AND withdrawn_at IS NULL", [researchId]);
  });
  await syncSeasonLeagues(seasonId, actorId, {
    log: { couchId, episode, userId: actorId, kind: "results", text: "", batch: crypto.randomUUID(), withdrawal: true },
  });
  return settled;
}

/**
 * Re-derives what every answer for the season from `fromEpisode` on says, under the season's rules now (a rulebook
 * fixed, or changed from that episode): each submission's own answers are read again into facts and sources, each
 * episode settled again, then every league brought in line, with a correction line wherever a result came out. Who
 * went home and hand entries say only what they said, so they stay; results an admin decided stay as decided.
 */
export async function restageSeason(seasonId: string, fromEpisode: number, actorId: string | null): Promise<{ episodes: number[]; answers: number }> {
  // Full answers only (they cover every kind of result): a quick check, the bot's included, says only who went home.
  const { rows: subs } = await pool.query<{ id: string; episode_number: number; payload: unknown; show_id: string; season_number: number }>(
    `SELECT er.id, er.episode_number, er.payload, er.show_id, er.season_number FROM episode_research er
       JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE ss.id = $1 AND er.episode_number >= $2 AND er.withdrawn_at IS NULL AND er.source IN ('paste', 'bot', 'autopilot', 'tiebreak')
        AND er.covers IS NOT NULL AND NOT (er.covers ? 'only') AND jsonb_typeof(er.covers->'kinds') = 'null'
      ORDER BY er.episode_number, er.researched_at`,
    [seasonId, Math.max(1, fromEpisode)]
  );
  const episodes = [...new Set(subs.map((s) => s.episode_number))];
  for (const n of episodes) {
    const format = await seasonFormat(pool, seasonId, { episode: n });
    const items = new Map<string, SubmittedFact[]>();
    for (const s of subs.filter((x) => x.episode_number === n)) {
      const read = await researchItems(pool, seasonId, { showId: s.show_id, season: s.season_number, episodeNumber: n, format }, s.payload);
      items.set(
        s.id,
        withNobodyOut(
          read.map((i) => ({ kind: i.kind, castawayName: i.name, method: i.method, eventType: i.eventType, units: i.units, juryVotes: i.juryVotes, postMerge: i.postMerge, confidence: i.confidence, sources: i.sources })),
          format
        )
      );
    }
    await settleNow(seasonId, n, async (client) => {
      for (const [id, facts] of items) {
        await client.query("DELETE FROM fact_sources WHERE research_id = $1", [id]);
        await fileFacts(client, seasonId, n, id, facts);
      }
    });
  }
  if (episodes.length) await syncSeasonLeagues(seasonId, actorId);
  return { episodes, answers: subs.length };
}

/**
 * Settles again every episode with facts the community still has a say in (the Confirmed threshold changed; a canonical
 * one is the admin's), and syncs only the seasons where something went in, came out or changed.
 */
export async function settleEverything(actorId: string | null): Promise<{ seasons: number; episodes: number }> {
  const { rows } = await pool.query<{ season_id: string; episode_number: number }>(
    `SELECT DISTINCT d.season_id, d.episode_number FROM season_decisions d
      WHERE d.fact_status IN ('reported', 'confirmed', 'disputed', 'removed') AND d.locked_at IS NULL ORDER BY 1, 2`
  );
  const moved = new Set<string>();
  for (const r of rows) {
    const settled = await settleNow(r.season_id, r.episode_number);
    if (settled.live.length || settled.out.length || settled.changed.length) moved.add(r.season_id);
  }
  for (const s of moved) await syncSeasonLeagues(s, actorId);
  return { seasons: moved.size, episodes: rows.length };
}

// ---- reading the shared facts ----

export interface FactView {
  id: string;
  kind: string;
  name: string;
  method: string;
  eventType: string;
  status: FactStatus;
  live: boolean;
  /** "1 source", "2 sources agree", "Disputed". */
  line: string;
  sources: number;
  /** Open flags on it, and whether one is yours. */
  flags: number;
  yours: boolean;
}

/** One episode's shared facts as everyone sees them, with their status. `viewerId`: to mark your own flags. */
export async function episodeFacts(seasonId: string, episode: number, viewerId: string | null): Promise<{ facts: FactView[]; missing: number; yoursMissing: boolean }> {
  const client = await pool.connect();
  try {
    const key = await seasonKey(client, seasonId);
    const { facts, submissions, inputs, flags } = await inputsFor(client, seasonId, key, episode, { locked: true });
    const outcomes = new Map<string, FactOutcome>(settleEpisode(inputs, submissions, { confirmAt: await confirmAt(client) }).map((o) => [o.id, o]));
    // Results an admin decided before 0112 (or a fixture's) carry no fact_status: canonical when accepted.
    const { rows: legacy } = await client.query<FactRow>(
      `SELECT id, kind, castaway_name, method, event_type, status, 'canonical'::text AS fact_status, true AS locked
         FROM season_decisions WHERE season_id = $1 AND episode_number = $2 AND fact_status IS NULL AND status = 'accepted'`,
      [seasonId, episode]
    );
    // What counts in the games: the facts in every league (a removed one is out; one still waiting isn't in yet).
    const views: FactView[] = [...facts, ...legacy]
      .filter((f) => f.status === "accepted")
      .map((f) => {
        const o = outcomes.get(f.id);
        const status = (o?.factStatus ?? f.fact_status ?? "canonical") as FactStatus;
        const open = flags.filter((x) => x.decision_id === f.id && x.status === "open");
        const shown = open.length && status !== "canonical" && status !== "removed" ? "disputed" : status;
        return {
          id: f.id,
          kind: f.kind,
          name: f.castaway_name,
          method: f.method,
          eventType: f.event_type,
          status: shown as FactStatus,
          live: f.status === "accepted",
          line: sourcesLine({ factStatus: shown as FactStatus, yes: o?.yes ?? 1 }),
          sources: o?.yes ?? 0,
          flags: open.length,
          yours: !!viewerId && open.some((x) => x.user_id === viewerId),
        };
      });
    const missing = flags.filter((x) => !x.decision_id && x.status === "open");
    return { facts: views, missing: missing.length, yoursMissing: !!viewerId && missing.some((x) => x.user_id === viewerId) };
  } finally {
    client.release();
  }
}

/** Every live fact on the season that has only one source or is disputed, by episode and person: the "1 source" marks.
 *  Never a role (the Traitors' faction is a secret while someone's still in). */
export async function unsettledFacts(seasonId: string, through: number): Promise<Map<number, Map<string, "reported" | "disputed">>> {
  const { rows } = await pool.query<{ episode_number: number; castaway_name: string; fact_status: string; flags: number }>(
    `SELECT d.episode_number, d.castaway_name, d.fact_status,
            (SELECT count(*)::int FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open') AS flags
       FROM season_decisions d
      WHERE d.season_id = $1 AND d.status = 'accepted' AND d.episode_number <= $2 AND d.kind NOT IN ('role', 'noexit') AND d.fact_status IN ('reported', 'disputed', 'confirmed')`,
    [seasonId, Number.isFinite(through) ? through : 100000]
  );
  const out = new Map<number, Map<string, "reported" | "disputed">>();
  for (const r of rows) {
    const mark = r.fact_status === "disputed" || r.flags > 0 ? "disputed" : r.fact_status === "reported" ? "reported" : null;
    if (!mark) continue;
    const ep = out.get(r.episode_number) ?? new Map();
    if (ep.get(r.castaway_name) !== "disputed") ep.set(r.castaway_name, mark);
    out.set(r.episode_number, ep);
  }
  return out;
}

/** Who sent each episode's full answers, and how far they agree: Backstage's "filled in by riley · Confirmed". `bot`: the first
 *  was the bot's own (Autopilot, or a tie-break run), with nobody to name. */
export async function fillState(seasonId: string, episodes: number[]): Promise<Map<number, { by: string | null; byCouch: string | null; bot: boolean; sources: number }>> {
  const out = new Map<number, { by: string | null; byCouch: string | null; bot: boolean; sources: number }>();
  if (!episodes.length) return out;
  const { rows } = await pool.query<{ episode_number: number; key: string; who: string | null; couch_id: string | null; source: string; submitted_by: string | null }>(
    `SELECT er.episode_number, COALESCE(er.submitted_by, 'bot:' || er.source) AS key, COALESCE(u.username, u.name) AS who, er.couch_id, er.source, er.submitted_by
       FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
       LEFT JOIN "user" u ON u.id = er.submitted_by
      WHERE ss.id = $1 AND er.episode_number = ANY($2::int[]) AND er.source <> 'combined' AND er.withdrawn_at IS NULL
        AND er.covers IS NOT NULL AND NOT (er.covers ? 'only') AND jsonb_typeof(er.covers->'kinds') = 'null'
      ORDER BY er.researched_at`,
    [seasonId, episodes]
  );
  const keys = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!out.has(r.episode_number)) out.set(r.episode_number, { by: r.who, byCouch: r.couch_id, bot: !r.submitted_by && r.source !== "paste", sources: 0 });
    keys.set(r.episode_number, (keys.get(r.episode_number) ?? new Set()).add(r.key));
  }
  for (const [n, k] of keys) out.get(n)!.sources = k.size;
  return out;
}

// ---- "Something wrong?" ----

const REASONS = ["didnt-happen", "wrong-person", "wrong-episode", "other", "missing"] as const;
export type FlagReason = (typeof REASONS)[number];

/**
 * Flags a result (or something missing from an episode). Anyone on a couch who has seen the episode; the flag goes to a
 * shared check, so nothing changes in anyone's games until it's settled. Returns how many others flagged it too.
 */
export async function flagResult(user: SessionUser, seasonId: string, couchId: string | null, body: { episode?: unknown; decisionId?: unknown; reason?: unknown; note?: unknown; link?: unknown }): Promise<{ others: number; status: FactStatus | null }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (couchId) await requireCouch(user, couchId);
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode required");
  if ((await seenThrough(user.id, seasonId)) < episode) throw new HttpError(403, `Reveal Episode ${episode} first`);
  const reason = String(body.reason ?? "") as FlagReason;
  if (!REASONS.includes(reason)) throw new HttpError(400, "Say what's wrong");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const link = typeof body.link === "string" && body.link.trim() ? body.link.trim().slice(0, 500) : null;
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "A link starts with https://");
  const decisionId = reason === "missing" ? null : typeof body.decisionId === "string" && isUuid(body.decisionId) ? body.decisionId : null;
  if (reason === "missing" && !note) throw new HttpError(400, "Say what happened");
  if (reason !== "missing") {
    if (!decisionId) throw new HttpError(400, "Which result?");
    const { rows } = await pool.query("SELECT 1 FROM season_decisions WHERE id = $1 AND season_id = $2 AND episode_number = $3 AND status = 'accepted'", [decisionId, seasonId, episode]);
    if (!rows.length) throw new HttpError(404, "That result isn't in this episode");
  }
  await settleNow(seasonId, episode, async (client) => {
    if (decisionId) {
      await client.query(
        `INSERT INTO fact_disputes (season_id, episode_number, decision_id, user_id, couch_id, reason, note, link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (decision_id, user_id) WHERE status = 'open' AND decision_id IS NOT NULL DO UPDATE SET reason = EXCLUDED.reason, note = EXCLUDED.note, link = EXCLUDED.link`,
        [seasonId, episode, decisionId, user.id, couchId, reason, note, link]
      );
    } else {
      await client.query("INSERT INTO fact_disputes (season_id, episode_number, user_id, couch_id, reason, note, link) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
        seasonId,
        episode,
        user.id,
        couchId,
        reason,
        note,
        link,
      ]);
    }
  });
  if (!decisionId) return { others: 0, status: null };
  const { rows } = await pool.query(
    `SELECT d.fact_status, (SELECT count(*)::int FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open' AND x.user_id IS DISTINCT FROM $2) AS others
       FROM season_decisions d WHERE d.id = $1`,
    [decisionId, user.id]
  );
  return { others: rows[0]?.others ?? 0, status: rows[0]?.fact_status ?? null };
}

/** The episodes of a season with a question open: a disputed result, or a flag no answer has checked yet. */
export async function openQuestions(seasonId: string): Promise<Map<number, number>> {
  const { rows } = await pool.query<{ episode_number: number; n: number }>(
    `SELECT episode_number, count(*)::int AS n FROM (
        SELECT d.episode_number FROM season_decisions d WHERE d.season_id = $1 AND d.fact_status = 'disputed' AND d.locked_at IS NULL
        UNION ALL
        SELECT x.episode_number FROM fact_disputes x
         WHERE x.season_id = $1 AND x.status = 'open'
           AND (x.decision_id IS NULL OR NOT EXISTS (SELECT 1 FROM season_decisions d WHERE d.id = x.decision_id AND (d.fact_status = 'disputed' OR d.locked_at IS NOT NULL)))
      ) q GROUP BY episode_number`,
    [seasonId]
  );
  return new Map(rows.map((r) => [r.episode_number, r.n]));
}

/** The flags sent from a couch, newest first, with how each stands. */
export async function couchFlags(
  seasonId: string,
  couchId: string,
  seen: number,
  label: (f: { kind: string; method: string; eventType: string }) => string = (f) => (f.kind === "event" ? f.eventType : f.method || f.kind)
): Promise<{ id: string; episode: number; who: string; what: string | null; reason: string; status: string; at: string }[]> {
  const { rows } = await pool.query(
    `SELECT x.id, x.episode_number, COALESCE(u.username, u.name) AS who, x.reason, x.status, x.created_at, d.castaway_name, d.kind, d.method, d.event_type
       FROM fact_disputes x LEFT JOIN "user" u ON u.id = x.user_id LEFT JOIN season_decisions d ON d.id = x.decision_id
      WHERE x.season_id = $1 AND x.couch_id = $2 AND x.episode_number <= $3
      ORDER BY x.created_at DESC LIMIT 20`,
    [seasonId, couchId, Number.isFinite(seen) ? seen : 100000]
  );
  return rows.map((r) => ({
    id: r.id,
    episode: r.episode_number,
    who: r.who ?? "someone",
    what: r.castaway_name ? `${r.castaway_name} · ${label({ kind: r.kind, method: r.method, eventType: r.event_type })}` : null,
    reason: r.reason,
    status: r.status,
    at: r.created_at.toISOString(),
  }));
}

/** Who can fill in results on a couch: anyone on it, or only people who run games. */
export async function couchFillsResults(couchId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT results_by_anyone FROM couches WHERE id = $1", [couchId]);
  return rows[0]?.results_by_anyone ?? true;
}

/** A league's results for an episode as a label each, for the plate and the dispute sheet ("Found an idol"). */
export function factLabel(state: LeagueState, f: { kind: string; method: string; eventType: string }): string {
  if (f.kind === "event") return StateLogic.formatOf(state).events.find((e) => e.id === f.eventType)?.label ?? f.eventType;
  if (f.kind === "group") return `Moved to ${f.method}`;
  if (f.kind === "exiled") return "Exiled";
  if (f.kind === "noexit") return "Nobody went home";
  return f.method || f.kind;
}

/** Sets who can fill in results on a couch; a line in Recent changes for the couch's games the setter runs on this season. */
export async function setWhoFills(userId: string, couchId: string, leagueIds: string[], anyone: boolean): Promise<{ anyone: boolean }> {
  await pool.query("UPDATE couches SET results_by_anyone = $2 WHERE id = $1", [couchId, anyone]);
  const batch = crypto.randomUUID();
  const text = anyone ? "Anyone on the couch can fill in results" : "Only people who run games fill in results";
  for (const id of leagueIds) await logChange(pool, id, { userId, kind: "settings.fill", tier: 1, text, batch });
  return { anyone };
}
