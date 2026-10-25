import crypto from "crypto";
import { after } from "next/server";
import { normalizeSchedule } from "@db/bot-research.js";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { backstageScope, fillScope, pasteResults, resultsPrompt, type BackstageScope, type PasteResult } from "./backstage";
import { logChange } from "./change-log";
import { couchFillsResults } from "./community-results";
import { pool, HttpError } from "./db";
import { couchGames } from "./league-changes";

// How results get in (docs/PLAN-new-design.md step 6c; mock bot.js; db/migrations/0115). Per couch and season, three
// ways: copy and paste (free, always: Ask an AI's question copied into your own chat), One tap ("Ask ChatGPT for me":
// our bot, bot.gameyourshow.com, asks and sends the answer; one person unlocks it for the whole couch) and Autopilot (the
// bot's own schedule; coming soon, so only an admin's schedule for a season runs it today: bot-results.ts). Who went
// home is always free, One tap included: it's what keeps whoever runs the games spoiler-safe. Every price shows what
// it will be with "Free during beta", and nothing is charged (results_plans.charged_cents stays 0).
//
// One tap runs on the bot like a scheduled run (bot_research_runs, slot 'tap', with the couch and who asked), after the
// request has answered (next/server `after`, within the route's maxDuration): the sheet polls the run, so it can be
// closed and opened again, and a second tap for the same episode joins the run in flight rather than asking twice. Its
// answer goes through Backstage's own paste path (backstage.ts pasteResults, `via: "tap"`), so it's a source counted as
// whoever tapped, exactly like their paste: what's trusted reaches every couch on the season, the rest waits.

/** What each way will cost after beta, in cents. Autopilot is cheaper for a couch that has One tap. */
export const PRICES = { tap: 100, autopilot: 500, autopilotAfterTap: 400 };

/** A One tap run still going counts as cut off after this (the route stops at 300 s). */
const RUN_STALE_MS = 6 * 60_000;

export interface AskRun {
  id: string;
  episode: number;
  kind: "quick" | "full";
  status: "running" | "done" | "failed";
  startedAt: string;
  seconds: number | null;
  /** Who asked, on their own couch (another couch's run: null). */
  by: string | null;
  /** Asked from this couch; by you. */
  here: boolean;
  mine: boolean;
  /** What came of it, for the couch that asked (no names: who went home is Show me's). */
  outcome: PasteResult | null;
  /** Why it failed, or a line about what it did. */
  message: string | null;
}

export interface Ways {
  /** One tap for this season: unlocked for the whole couch (by whom, when), else copy and paste. */
  tap: { unlocked: boolean; by: string | null; at: string | null };
  /** Whether you may unlock it: whoever runs a game here, or anyone who plays when the couch lets anyone fill in. */
  canUnlock: boolean;
  /** The bot's own schedule on this season (an admin's switch until Autopilot is ready): what it checks on its own. */
  autopilot: { quick: boolean; full: boolean };
  /** "Ask ChatGPT for me" can run right now (the bot answers its health check). */
  bot: { available: boolean; busy: boolean };
  prices: typeof PRICES;
  /** One tap runs on this season still going, newest first. */
  running: AskRun[];
}

// The bot's health, asked at most every 20 s (each sheet opening would otherwise wait on it).
let health: { key: string; at: number; v: { available: boolean; busy: boolean } } | null = null;
async function botStatus(bot?: string) {
  const key = bot ?? "";
  if (health && health.key === key && Date.now() - health.at < 20_000) return health.v;
  const v = await askBotStatus({ bot });
  health = { key, at: Date.now(), v };
  return v;
}

/** Anyone who plays or runs a game on this couch's season. */
async function waysScope(user: SessionUser, seasonId: string, couchId: string | null) {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId || !isUuid(couchId)) throw new HttpError(400, "couch required");
  const { here, runs } = await couchGames(user, seasonId, couchId);
  if (!here.some((g) => g.yourRole || runs.has(g.leagueId))) throw new HttpError(403, "Results are filled in by people who play here");
  return { here, runs, couchId };
}

async function tapPlan(couchId: string, seasonId: string): Promise<Ways["tap"]> {
  const { rows } = await pool.query(
    `SELECT p.unlocked_at, COALESCE(u.username, u.name) AS who FROM results_plans p LEFT JOIN "user" u ON u.id = p.unlocked_by
      WHERE p.couch_id = $1 AND p.season_id = $2 AND p.plan = 'tap'`,
    [couchId, seasonId]
  );
  return rows[0] ? { unlocked: true, by: rows[0].who ?? null, at: rows[0].unlocked_at.toISOString() } : { unlocked: false, by: null, at: null };
}

const RUN_COLUMNS = `r.id, r.episode_number, r.kind, r.started_at, r.finished_at, r.ok, r.message, r.result, r.seconds, r.couch_id, r.asked_by, COALESCE(u.username, u.name) AS who`;

interface RunRow {
  id: string;
  episode_number: number;
  kind: "quick" | "full";
  started_at: Date;
  finished_at: Date | null;
  ok: boolean | null;
  message: string | null;
  result: PasteResult | null;
  seconds: number | null;
  couch_id: string | null;
  asked_by: string | null;
  who: string | null;
}

function runView(r: RunRow, couchId: string, userId: string): AskRun {
  const here = r.couch_id === couchId;
  const cut = !r.finished_at && Date.now() - r.started_at.getTime() > RUN_STALE_MS;
  return {
    id: r.id,
    episode: r.episode_number,
    kind: r.kind,
    status: !r.finished_at ? (cut ? "failed" : "running") : r.ok ? "done" : "failed",
    startedAt: r.started_at.toISOString(),
    seconds: r.seconds,
    by: here ? r.who : null,
    here,
    mine: r.asked_by === userId,
    outcome: here && r.ok ? r.result : null,
    message: cut ? "It took too long. Ask again, or copy and paste it yourself." : r.message,
  };
}

/** How results get in for this couch's season: One tap's unlock, Autopilot, the bot, and any One tap running. */
export async function waysRead(user: SessionUser, seasonId: string, couchId: string | null, bot?: string): Promise<Ways> {
  const scope = await waysScope(user, seasonId, couchId);
  const { rows } = await pool.query("SELECT bot_research_on, bot_research_schedule FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  let schedule: { kind: string; on: boolean }[] = [];
  try {
    schedule = rows[0].bot_research_on ? normalizeSchedule(rows[0].bot_research_schedule) : [];
  } catch {
    schedule = [];
  }
  const { rows: running } = await pool.query<RunRow>(
    `SELECT ${RUN_COLUMNS} FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by
      WHERE r.season_id = $1 AND r.slot = 'tap' AND r.finished_at IS NULL AND r.started_at > now() - make_interval(secs => $2)
      ORDER BY r.started_at DESC`,
    [seasonId, RUN_STALE_MS / 1000]
  );
  return {
    tap: await tapPlan(scope.couchId, seasonId),
    canUnlock: scope.here.some((g) => scope.runs.has(g.leagueId)) || (scope.here.some((g) => g.yourRole) && (await couchFillsResults(scope.couchId))),
    autopilot: { quick: schedule.some((r) => r.on && r.kind === "quick"), full: schedule.some((r) => r.on && r.kind === "full") },
    bot: await botStatus(bot),
    prices: PRICES,
    running: running.map((r) => runView(r, scope.couchId, user.id)),
  };
}

/**
 * Unlocks One tap for the whole couch on this season (free during beta: nothing is charged). A line in Recent changes on
 * each of the couch's games here; there's nothing to undo.
 */
export async function unlockTap(user: SessionUser, seasonId: string, couchId: string | null, bot?: string): Promise<Ways> {
  const before = await waysRead(user, seasonId, couchId, bot);
  if (before.tap.unlocked) return before;
  if (!before.canUnlock) throw new HttpError(403, "On this couch, whoever runs the games fills in results");
  const { rowCount } = await pool.query(
    "INSERT INTO results_plans (couch_id, season_id, plan, unlocked_by, charged_cents) VALUES ($1, $2, 'tap', $3, 0) ON CONFLICT DO NOTHING",
    [couchId, seasonId, user.id]
  );
  if (rowCount) {
    const { rows } = await pool.query("SELECT s.name, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
    const season = rows[0] ? `${rows[0].name} ${rows[0].season_number}` : "this season";
    const { here } = await couchGames(user, seasonId, couchId!);
    const batch = crypto.randomUUID();
    for (const g of here) await logChange(pool, g.leagueId, { userId: user.id, kind: "settings.results", tier: 1, text: `Unlocked One tap for ${season} · free during beta`, batch });
  }
  return waysRead(user, seasonId, couchId, bot);
}

/** Why a One tap run failed, in a line for the sheet. */
function failure(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.status === 409) return "ChatGPT's answer reads like another episode's. Ask again in a minute, or copy and paste it yourself.";
    if (e.status === 502 || e.status === 404) return "ChatGPT didn't answer. Try again in a minute, or copy and paste it yourself.";
    if (e.status === 400) return `ChatGPT's answer couldn't be used: ${e.message} Ask again, or copy and paste it yourself.`;
    return e.message;
  }
  console.error("[one-tap]", e);
  return "Something went wrong asking ChatGPT. Copy and paste works.";
}

/** A line about what a One tap answer did, kept on the run row (the admin's bot runs list reads it). */
function outcomeLine(r: PasteResult): string {
  if (r.kind === "quick") return r.applied ? `Who went home applied to ${r.applied.games} game(s)` : `Waits: ${r.waiting?.line ?? ""}`;
  return `${r.applied} result(s) applied to ${r.games} game(s)${r.waiting ? `, ${r.waiting} waiting` : ""}`;
}

/** Asks the bot and sends its answer (after the request answered). Never throws: the run row says how it went. */
async function runAsk(runId: string, scope: BackstageScope, n: number, kind: "quick" | "full", prompt: string, bot?: string): Promise<void> {
  const started = Date.now();
  let ok = false;
  let message = "";
  let outcome: PasteResult | null = null;
  try {
    const { answer } = await askBot(prompt, { bot });
    outcome = await pasteResults(scope, n, kind, answer, { via: "tap" });
    ok = true;
    message = outcomeLine(outcome);
  } catch (e) {
    message = failure(e);
  }
  await pool
    .query("UPDATE bot_research_runs SET finished_at = now(), ok = $2, message = $3, result = $4::jsonb, seconds = $5 WHERE id = $1", [
      runId,
      ok,
      message.slice(0, 1000),
      outcome ? JSON.stringify(outcome) : null,
      Math.round((Date.now() - started) / 100) / 10,
    ])
    .catch((e) => console.error("[one-tap] couldn't record run", runId, e));
}

/**
 * One tap: asks the bot this episode's question for the couch, in the background, and answers the run to poll. Who went
 * home: whoever runs a game here, always free. The full results: whoever may fill them in, once One tap is unlocked for
 * the couch. A run for the same episode already going (from any couch: results are shared) is joined, not repeated.
 */
export async function startAsk(user: SessionUser, seasonId: string, couchId: string | null, body: { episode?: unknown; kind?: unknown }, bot?: string): Promise<AskRun> {
  const n = Number(body.episode);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "episode required");
  if (body.kind !== "quick" && body.kind !== "full") throw new HttpError(400, "kind must be quick or full");
  const kind = body.kind;
  const scope = kind === "full" ? await fillScope(user, seasonId, couchId, n) : await backstageScope(user, seasonId, couchId);
  if (kind === "full" && !(await tapPlan(scope.couchId, seasonId)).unlocked) throw new HttpError(403, "Unlock One tap for the couch first");
  if (!(await botStatus(bot)).available) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  const { prompt } = await resultsPrompt(scope, n, kind);
  if (!prompt) throw new HttpError(400, `There's nobody left to ask about in Episode ${n}.`);

  const client = await pool.connect();
  let row: RunRow;
  let fresh = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tap:${seasonId}:${n}:${kind}`]);
    const { rows: going } = await client.query<RunRow>(
      `SELECT ${RUN_COLUMNS} FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by
        WHERE r.season_id = $1 AND r.episode_number = $2 AND r.kind = $3 AND r.slot = 'tap' AND r.finished_at IS NULL
          AND r.started_at > now() - make_interval(secs => $4)
        ORDER BY r.started_at DESC LIMIT 1`,
      [seasonId, n, kind, RUN_STALE_MS / 1000]
    );
    if (going.length) row = going[0];
    else {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, couch_id, asked_by) VALUES ($1, $2, 'tap', $3, $4, $5) RETURNING id",
        [seasonId, n, kind, scope.couchId, user.id]
      );
      const { rows: made } = await client.query<RunRow>(`SELECT ${RUN_COLUMNS} FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by WHERE r.id = $1`, [rows[0].id]);
      row = made[0];
      fresh = true;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  if (fresh) after(() => runAsk(row.id, scope, n, kind, prompt, bot));
  return runView(row, scope.couchId, user.id);
}

/** One tap run, for the sheet polling it: anyone who plays or runs a game on the couch's season. */
export async function readRun(user: SessionUser, seasonId: string, couchId: string | null, runId: string | null): Promise<AskRun> {
  const scope = await waysScope(user, seasonId, couchId);
  if (!runId || !isUuid(runId)) throw new HttpError(400, "run required");
  const { rows } = await pool.query<RunRow>(
    `SELECT ${RUN_COLUMNS} FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by WHERE r.id = $1 AND r.season_id = $2 AND r.slot = 'tap'`,
    [runId, seasonId]
  );
  if (!rows.length) throw new HttpError(404, "That run isn't here");
  return runView(rows[0], scope.couchId, user.id);
}
