import { compileChain, getRulebook, inForceEdits, saveChain } from "@db/rulebooks.js";
import { buildPasteImportPrompt, researchFromPaste } from "@db/episode-research.js";
import { parseRulebookAnswer } from "@/lib/game/formats/rulebook-research.js";
import { askBot, askBotStatus, tellBotClock } from "./ask-bot";
import type { SessionUser } from "./auth-helpers";
import { factsOfRun } from "./bot-results";
import { sendResults, tryResults, type SubmitInput, type Tried, type TriedGame } from "./community-results";
import { pool, HttpError } from "./db";
import { SEASON_NAME, logDesk } from "./desk";
import { askCastNow, fillCastDetails } from "./desk-cast-page";
import { askRulebookNow } from "./desk-rulebooks";
import { latestEnded, seasonSchedules } from "./schedule";

// The catch-up (docs/PLAN-cast-properties.md chunk 6c; db/migrations/0441). A season played before cast properties, bios and
// holdings existed is asked again by our bot, by itself, on the bot's clock (cron/bot-research: one due job a call, when no
// research run or Getting it ready job is due), a step a call:
//   show      its rulebook asked Check for changes; the properties go in when it has none (they never score), and it's
//             compiled again so research asks its holdings and property questions. Every other difference stays on the
//             rulebook's desk page as the check's card: how a game scores never changes here.
//   cast      our bot's cast answer staged, and only details we lack sent (fillCastDetails); a new spelling, a starting
//             group, a changed value or someone new waits in the cast review.
//   episodes  each aired episode from 1, its full research a source of its own ('catchup') beside the original. Tried first
//             (community-results.ts tryResults: filed and every game synced in a transaction that's rolled back): no game's
//             total moves, it's sent; any does, it's held for the desk (catchup_holds) with who moves and by how much.
// Our bot only: never the site's paid keys (docs/HOSTING.md). Never throws to the clock.

type Step = "show" | "cast" | "episodes";
const STEPS: Step[] = ["show", "cast", "episodes"];
const ASK_STALE_MS = 8 * 60_000;
const BUDGET_MS = 280_000;
/** An ask isn't started with less than this left: the next call carries on. */
const STEP_NEEDS_MS = 100_000;
/** Patient: the bot's away for a while now and then, and nobody's waiting on a catch-up. A failed step is tried again after 5,
 *  15 and 45 minutes, then every 2 hours, and stops (the desk's Inbox, Try again) only after this many, about half a day. */
const TRIES = 6;
const retryMs = (tries: number) => Math.min(5 * 3 ** Math.max(0, tries - 1), 120) * 60_000;
const AWAY_MS = 3 * 60_000;
const CARRY_MS = 30_000;
const AWAY = "Our bot's away right now. It carries on when it's back.";

interface Row {
  season_id: string;
  step: Step;
  episode: number;
  tries: number;
  asking_at: Date | null;
  tried_at: Date | null;
  message: string | null;
  stuck_at: Date | null;
  done_at: Date | null;
  created_at: Date;
}

interface Season {
  id: string;
  slug: string;
  season_number: number;
  name: string;
}

const seasonOf = async (id: string): Promise<Season> => {
  const { rows } = await pool.query(`SELECT ss.id, s.slug, ss.season_number, ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Season not found");
  return rows[0];
};

const airedOf = async (id: string): Promise<number> => latestEnded((await seasonSchedules([id])).get(id)) ?? 0;

/** When an open job runs again (null: asking now, done or stuck). */
function dueAt(r: Row, now = Date.now()): Date | null {
  if (r.done_at || r.stuck_at) return null;
  if (r.asking_at && now - r.asking_at.getTime() < ASK_STALE_MS) return null;
  if (!r.tried_at) return r.created_at;
  const wait = r.message === AWAY ? AWAY_MS : r.tries > 0 ? retryMs(r.tries) : CARRY_MS;
  return new Date(r.tried_at.getTime() + wait);
}

/** When the earliest open job comes due (the clock's `next`). */
export async function catchUpsNextAt(): Promise<Date | null> {
  const { rows } = await pool.query<Row>("SELECT * FROM season_catchups WHERE done_at IS NULL AND stuck_at IS NULL");
  const due = rows.map((r) => dueAt(r)).filter((d): d is Date => !!d);
  return due.length ? new Date(Math.min(...due.map((d) => d.getTime()))) : null;
}

/** The clock's turn: the earliest due job, one step. The season it ran, or null. */
export async function runDueCatchUp(o: { bot?: string; budgetMs?: number }): Promise<string | null> {
  const { rows } = await pool.query<Row>("SELECT * FROM season_catchups WHERE done_at IS NULL AND stuck_at IS NULL");
  const now = Date.now();
  const due = rows.filter((r) => (dueAt(r, now)?.getTime() ?? Infinity) <= now).sort((a, b) => dueAt(a)!.getTime() - dueAt(b)!.getTime())[0];
  if (!due) return null;
  await runOne(due.season_id, o);
  return due.season_id;
}

/** One step of one season's catch-up, as far as the time allows. Never throws. */
export async function runOne(seasonId: string, o: { bot?: string; budgetMs?: number }): Promise<void> {
  const t0 = Date.now();
  const left = () => (o.budgetMs ?? BUDGET_MS) - (Date.now() - t0);
  const { rows } = await pool.query<Row>(
    `UPDATE season_catchups SET asking_at = now(), updated_at = now()
      WHERE season_id = $1 AND done_at IS NULL AND stuck_at IS NULL AND (asking_at IS NULL OR asking_at < now() - make_interval(secs => $2))
      RETURNING *`,
    [seasonId, ASK_STALE_MS / 1000]
  );
  const row = rows[0];
  if (!row) return;
  const set = (fields: string, values: unknown[] = []) =>
    pool.query<Row>(`UPDATE season_catchups SET ${fields}, updated_at = now() WHERE season_id = $1 RETURNING *`, [seasonId, ...values]);
  try {
    if (left() < STEP_NEEDS_MS) return;
    if (!(await askBotStatus({ bot: o.bot })).available) return void (await set("message = $2", [AWAY]));
    const s = await seasonOf(seasonId);
    const budget = left() - 5_000;
    if (row.step === "show") {
      await showStep(s, o.bot, budget);
      await set("step = 'cast', tries = 0, message = NULL");
    } else if (row.step === "cast") {
      await castStep(s, o.bot, budget);
      await set("step = 'episodes', episode = 1, tries = 0, message = NULL");
    } else {
      const aired = await airedOf(seasonId);
      if (row.episode > aired) return void (await set("done_at = now(), message = NULL"));
      const line = await episodeStep(s, row.episode, o.bot, budget);
      const next = row.episode + 1;
      await set(`episode = $2::int, tries = 0, message = $3, done_at = CASE WHEN $2::int > $4::int THEN now() END`, [next, line, aired]);
    }
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[catch-up]", seasonId, row.step, row.episode, message);
    await set(`tries = tries + 1, message = $2, stuck_at = CASE WHEN tries + 1 >= $3 THEN now() END`, [message, TRIES]).catch(() => undefined);
  } finally {
    const { rows: after } = await set("asking_at = NULL, tried_at = now()").catch(() => ({ rows: [] as Row[] }));
    const due = after[0] ? dueAt(after[0]) : null;
    if (due) await tellBotClock(due).catch(() => undefined);
  }
}

// ---------- the steps ----------

/** The season's own rulebook (a show on a built-in format with none reads its format, which compiles its questions already). */
async function rulebookOf(seasonId: string): Promise<string | null> {
  const { rows } = await pool.query("SELECT id FROM rulebooks WHERE season_id = $1 AND owner_kind = 'season' AND status <> 'archived' ORDER BY created_at LIMIT 1", [seasonId]);
  return rows[0]?.id ?? null;
}

async function showStep(s: Season, bot: string | undefined, budgetMs: number): Promise<void> {
  const id = await rulebookOf(s.id);
  if (!id) return;
  const row = await getRulebook(pool, id);
  const has = Array.isArray(row?.blocks?.cast?.properties) && row.blocks.cast.properties.length > 0;
  let added = 0;
  // Check for changes: the rulebook as our bot reads the show now, left on the rulebook's page as its card for the desk.
  const asked = await askRulebookNow(id, "check", null, bot, budgetMs);
  if (!asked.ok) throw new Error(`Check for changes: ${asked.message}`);
  if (!has) {
    const { rows } = await pool.query("SELECT answer FROM rulebook_answers WHERE rulebook_id = $1 AND kind = 'check' ORDER BY created_at DESC LIMIT 1", [id]);
    let props: unknown[] = [];
    try {
      props = (parseRulebookAnswer(rows[0]?.answer ?? "") as { cast?: { properties?: unknown[] } }).cast?.properties ?? [];
    } catch {
      props = [];
    }
    if (props.length) {
      const fresh = await getRulebook(pool, id);
      if (!fresh) return;
      const blocks = { ...fresh.blocks, cast: { ...fresh.blocks.cast, properties: props } } as typeof fresh.blocks;
      const saved = await saveChain(pool, id, { blocks, userId: null });
      if (saved && !("refused" in saved)) added = props.length;
    }
  }
  // Compiled again, so research asks its holdings and property questions (an edited rulebook doesn't follow the compiler by
  // itself). Its games keep the copy they play by until the desk pushes one: nothing they score moves here.
  if (!added) await recompile(id);
  const text = added ? `Catch-up: ${added === 1 ? "a property" : `${added} properties`} from our bot's Check for changes` : "Catch-up: Check for changes asked, and its research questions brought up to date";
  await logDesk(pool, { entity: "rulebook", entityId: id, action: "catchup", text, userId: null });
}

async function recompile(id: string): Promise<void> {
  const row = await getRulebook(pool, id);
  if (!row) return;
  const edits = await inForceEdits(pool, id);
  const r = compileChain(row, row.blocks, edits, row.phaseStarts || {});
  if (!r.data) return;
  await saveChain(pool, id, { userId: null });
}

async function castStep(s: Season, bot: string | undefined, budgetMs: number): Promise<void> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [s.id]);
  if (!rows[0].n) return;
  const asked = await askCastNow(s.id, null, bot, budgetMs);
  if (!asked.ok) throw new Error(`The cast: ${asked.message}`);
  await fillCastDetails(s.id);
}

/** One episode: researched, tried, then sent or held. The line the desk shows for it. */
async function episodeStep(s: Season, n: number, bot: string | undefined, budgetMs: number): Promise<string> {
  const { prompt } = await buildPasteImportPrompt(pool, s.slug, s.season_number, n, { structured: true });
  if (!prompt) return `Episode ${n}: nothing to ask`;
  const { answer } = await askBot(prompt, { bot, budgetMs });
  // Dry: read and checked, nothing stored or staged; the original answer stays as it was.
  const run = await researchFromPaste(pool, s.slug, s.season_number, n, answer, { structured: true, dry: true, via: "bot", checkEpisode: true });
  const input = await inputOf(s.id, n, run);
  const tried = await tryResults(input);
  if (!tried.games.length) {
    const sent = await sendResults(input, { kind: "results.catchup", text: (count) => `The catch-up asked Episode ${n} again (${count})`, detail: { own: true, via: "catchup" } });
    return `Episode ${n}: sent, no score moves (${sent.count} in every game)`;
  }
  await hold(s.id, n, input, tried);
  return `Episode ${n}: held, it would change scores in ${tried.games.length === 1 ? "a game" : `${tried.games.length} games`}`;
}

async function inputOf(seasonId: string, n: number, run: unknown): Promise<SubmitInput> {
  const r = run as { castNames: string[]; submitted: unknown; provenance: Record<string, unknown> };
  const facts = await factsOfRun(seasonId, run);
  const { pastedNotes, ...provenance } = r.provenance ?? {};
  return {
    seasonId,
    episode: n,
    source: "catchup",
    userId: null,
    couchId: null,
    covers: { people: r.castNames, kinds: null },
    facts,
    // A second try at the same episode replaces the first.
    replaces: true,
    payload: r.submitted,
    provenance: { ...provenance, run: "catchup", pasted: typeof pastedNotes === "string" ? pastedNotes.length : null },
  };
}

async function hold(seasonId: string, n: number, input: SubmitInput, moves: Tried): Promise<void> {
  const { facts, ...answer } = input;
  await pool.query("DELETE FROM catchup_holds WHERE season_id = $1 AND episode_number = $2 AND decided_at IS NULL", [seasonId, n]);
  await pool.query("INSERT INTO catchup_holds (season_id, episode_number, answer, facts, moves) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)", [
    seasonId,
    n,
    JSON.stringify(answer),
    JSON.stringify(facts),
    JSON.stringify(moves),
  ]);
}

// ---------- the desk ----------

export interface CatchUpHold {
  id: string;
  seasonId: string;
  season: string;
  episode: number;
  at: string;
  /** The results it puts in, takes out or changes ("Bo · Voted Out"). */
  changes: Tried["changes"];
  games: TriedGame[];
}

/** Held answers waiting for the desk, a season's or every season's. */
export async function holdsWaiting(seasonId?: string, episode?: number): Promise<CatchUpHold[]> {
  const { rows } = await pool.query(
    `SELECT h.id, h.season_id, h.episode_number, h.created_at, h.moves, ${SEASON_NAME} AS season
       FROM catchup_holds h JOIN show_seasons ss ON ss.id = h.season_id JOIN shows s ON s.id = ss.show_id
      WHERE h.decided_at IS NULL AND ($1::uuid IS NULL OR h.season_id = $1) AND ($2::int IS NULL OR h.episode_number = $2)
      ORDER BY season, h.episode_number`,
    [seasonId ?? null, episode ?? null]
  );
  // `moves` is { changes, games } (a bare list of games from a hand-made row: scripts/dev-test/check-catch-up.js).
  return rows.map((r) => ({
    id: r.id,
    seasonId: r.season_id,
    season: r.season,
    episode: r.episode_number,
    at: r.created_at.toISOString(),
    changes: Array.isArray(r.moves) ? [] : (r.moves.changes ?? []),
    games: Array.isArray(r.moves) ? r.moves : (r.moves.games ?? []),
  }));
}

/** "Andrew +4, Joanna −2" for a game, or what changed in a game the try can't price. */
export function movesLine(g: TriedGame): string {
  if (!g.players.length) return g.outside ? "its results change (scored outside what the try can add up)" : "no total moves";
  const fmt = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d * 100) / 100)}`;
  return g.players.map((p) => `${p.name} ${fmt(p.after - p.before)}`).join(", ");
}

/** Send it (the held answer goes in as it would have) or Leave it out. */
export async function decideHold(user: SessionUser, holdId: string, decision: unknown): Promise<{ text: string }> {
  if (decision !== "sent" && decision !== "left") throw new HttpError(400, "decision is sent or left");
  const { rows } = await pool.query("SELECT * FROM catchup_holds WHERE id = $1 AND decided_at IS NULL", [holdId]);
  const h = rows[0];
  if (!h) throw new HttpError(404, "That isn't waiting");
  if (decision === "sent") {
    const input = { ...(h.answer as Omit<SubmitInput, "facts">), facts: h.facts } as SubmitInput;
    await sendResults(input, { kind: "results.catchup", text: (count) => `The catch-up's Episode ${h.episode_number}, sent from the desk (${count})`, detail: { own: true, via: "catchup" } });
  }
  await pool.query("UPDATE catchup_holds SET decided_at = now(), decided_by = $2, decision = $3 WHERE id = $1", [holdId, user.id, decision]);
  const text = decision === "sent" ? `Sent the catch-up's Episode ${h.episode_number}` : `Left out the catch-up's Episode ${h.episode_number}`;
  await logDesk(pool, { entity: "season", entityId: h.season_id, action: "catchup", text, userId: user.id });
  return { text };
}

/** Where a season's catch-up is: "Catching up: cast done, Episode 4 of 8", or null with none. */
export async function catchUpLine(seasonId: string): Promise<{ line: string; stuck: boolean; waiting: number } | null> {
  const { rows } = await pool.query<Row>("SELECT * FROM season_catchups WHERE season_id = $1", [seasonId]);
  const r = rows[0];
  if (!r) return null;
  const waiting = (await holdsWaiting(seasonId)).length;
  const wait = waiting ? ` · ${waiting === 1 ? "1 episode waits" : `${waiting} episodes wait`} for you` : "";
  if (r.done_at) return { line: `Caught up${wait}`, stuck: false, waiting };
  if (r.stuck_at) return { line: `The catch-up stopped at ${where(r)}: ${r.message ?? "it failed"}`, stuck: true, waiting };
  const aired = await airedOf(seasonId);
  const at = r.step === "episodes" ? `Episode ${Math.min(r.episode, aired)} of ${aired}` : r.step === "cast" ? "its cast" : "its rulebook";
  return { line: `Catching up: ${at}${wait}`, stuck: false, waiting };
}

const where = (r: Row) => (r.step === "episodes" ? `Episode ${r.episode}` : r.step === "cast" ? "its cast" : "its rulebook");

/** Start one (the desk, any season) or try again after it stopped. */
export async function startCatchUp(user: SessionUser, seasonId: string): Promise<{ text: string }> {
  await seasonOf(seasonId);
  await pool.query(
    `INSERT INTO season_catchups (season_id) VALUES ($1)
     ON CONFLICT (season_id) DO UPDATE SET stuck_at = NULL, tries = 0, message = NULL, tried_at = NULL,
       step = CASE WHEN season_catchups.done_at IS NULL THEN season_catchups.step ELSE 'show' END,
       episode = CASE WHEN season_catchups.done_at IS NULL THEN season_catchups.episode ELSE 1 END,
       done_at = NULL, updated_at = now()`,
    [seasonId]
  );
  await logDesk(pool, { entity: "season", entityId: seasonId, action: "catchup", text: "Started the catch-up", userId: user.id });
  const due = await catchUpsNextAt();
  if (due) await tellBotClock(due).catch(() => undefined);
  return { text: "The catch-up starts on the bot's next call" };
}

export const CATCH_UP_STEPS = STEPS;
