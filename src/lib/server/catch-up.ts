import { compileChain, getRulebook, inForceEdits, saveChain } from "@db/rulebooks.js";
import { buildPasteImportPrompt, researchFromPaste } from "@db/episode-research.js";
import { parseRulebookAnswer } from "@/lib/game/formats/rulebook-research.js";
import { askBot, askBotSlots, tellBotClock } from "./ask-bot";
import type { SessionUser } from "./auth-helpers";
import { factsOfRun } from "./bot-results";
import { sendResults, tryResults, type SubmitInput, type Tried, type TriedGame } from "./community-results";
import { pool, HttpError } from "./db";
import { SEASON_NAME, logDesk } from "./desk";
import { askCastNow, fillCastDetails } from "./desk-cast-page";
import { askRulebookNow } from "./desk-rulebooks";
import { latestEnded, seasonSchedules } from "./schedule";

// The catch-up (docs/PLAN-cast-properties.md chunk 6c; db/migrations/0441). A season played before cast properties, bios and
// holdings existed is asked again by our bot, by itself, on the bot's clock (cron/bot-research: when no research run or Getting
// it ready job is due), in order:
//   show      its rulebook asked Check for changes; the properties go in when it has none (they never score), and it's
//             compiled again so research asks its holdings and property questions. Every other difference stays on the
//             rulebook's desk page as the check's card: how a game scores never changes here.
//   cast      our bot's cast answer staged, and only details we lack sent (fillCastDetails); a new spelling, a starting
//             group, a changed value or someone new waits in the cast review.
//   episodes  every aired episode (a catchup_episodes row each), its full research a source of its own ('catchup') beside the
//             original. Tried first (community-results.ts tryResults: filed and every game synced in a transaction that's
//             rolled back): no game's total moves, it's sent; any does, it's held for the desk (catchup_holds) with who moves
//             and by how much.
// Side by side (the user, 2026-11-16: "parallel bots"): each clock call runs as many items as the bots answer at once
// (askBotSlots: Codex's three a bot, run kind 'catchup'), spread over every bot; a season's show and cast go one at a time, its
// episodes together. Only the asks overlap: a season's try-and-send is one at a time (an advisory lock), so two episodes never
// sync the same games at once. Our bot only: never the site's paid keys (docs/HOSTING.md). Never throws to the clock.

type Step = "show" | "cast" | "episodes";
const STEPS: Step[] = ["show", "cast", "episodes"];
const ASK_STALE_MS = 8 * 60_000;
const BUDGET_MS = 280_000;
/** An ask isn't started with less than this left: the next call carries on. */
const STEP_NEEDS_MS = 100_000;
/** Patient: the bot's away for a while now and then, and nobody's waiting on a catch-up. A failed item is tried again after 5,
 *  15 and 45 minutes, then every 2 hours, and stops (the desk's Inbox, Try again) only after this many, about half a day. */
const TRIES = 6;
const retryMs = (tries: number) => Math.min(5 * 3 ** Math.max(0, tries - 1), 120) * 60_000;
const AWAY_MS = 3 * 60_000;
const CARRY_MS = 30_000;
const AWAY = "Our bot's away right now. It carries on when it's back.";

interface Row {
  season_id: string;
  step: Step;
  tries: number;
  asking_at: Date | null;
  tried_at: Date | null;
  message: string | null;
  stuck_at: Date | null;
  done_at: Date | null;
  created_at: Date;
}

interface EpisodeRow {
  season_id: string;
  episode_number: number;
  status: "waiting" | "sent" | "held" | "stopped";
  tries: number;
  asking_at: Date | null;
  tried_at: Date | null;
  message: string | null;
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
const asking = (at: Date | null, now: number) => !!at && now - at.getTime() < ASK_STALE_MS;

/** When a season's show or cast step runs again (null: asking now, on its episodes, done or stuck). */
function dueAt(r: Row, now = Date.now()): Date | null {
  if (r.done_at || r.stuck_at || r.step === "episodes" || asking(r.asking_at, now)) return null;
  if (!r.tried_at) return r.created_at;
  const wait = r.message === AWAY ? AWAY_MS : r.tries > 0 ? retryMs(r.tries) : CARRY_MS;
  return new Date(r.tried_at.getTime() + wait);
}

/** When an episode is asked (again): at once, or after a failed try's wait. */
function episodeDueAt(e: EpisodeRow, now = Date.now()): Date | null {
  if (e.status !== "waiting" || asking(e.asking_at, now)) return null;
  if (!e.tried_at || !e.tries) return new Date(0);
  return new Date(e.tried_at.getTime() + (e.message === AWAY ? AWAY_MS : retryMs(e.tries)));
}

/** A season on its episodes: a row for every aired one (new ones as they air), and done once none waits. */
async function settleSeason(seasonId: string): Promise<void> {
  // Only once its show and cast steps are behind it: the rulebook's research questions are compiled first, so every episode is
  // asked them (holdings, a property's change).
  const { rows: at } = await pool.query("SELECT step FROM season_catchups WHERE season_id = $1", [seasonId]);
  if (at[0]?.step !== "episodes") return;
  const aired = await airedOf(seasonId);
  if (aired > 0) {
    await pool.query("INSERT INTO catchup_episodes (season_id, episode_number) SELECT $1, n FROM generate_series(1, $2::int) n ON CONFLICT DO NOTHING", [seasonId, aired]);
  }
  const { rows } = await pool.query<{ waiting: number; stopped: number }>(
    "SELECT count(*) FILTER (WHERE status = 'waiting')::int AS waiting, count(*) FILTER (WHERE status = 'stopped')::int AS stopped FROM catchup_episodes WHERE season_id = $1",
    [seasonId]
  );
  if (rows[0].waiting) return;
  // Every episode in, or stopped: done, or stuck for the desk (Try again asks the stopped ones again).
  const stopped = rows[0].stopped;
  if (stopped) {
    await pool.query("UPDATE season_catchups SET stuck_at = now(), message = $2, updated_at = now() WHERE season_id = $1 AND step = 'episodes' AND done_at IS NULL AND stuck_at IS NULL", [
      seasonId,
      `${stopped === 1 ? "An episode" : `${stopped} episodes`} stopped after ${TRIES} tries`,
    ]);
  } else {
    await pool.query("UPDATE season_catchups SET done_at = now(), message = NULL, updated_at = now() WHERE season_id = $1 AND step = 'episodes' AND done_at IS NULL AND stuck_at IS NULL", [seasonId]);
  }
}

type Item = { kind: "season"; seasonId: string; at: number } | { kind: "episode"; seasonId: string; n: number; at: number };

/** Everything due now, the show and cast steps first (they open a season's episodes), then episodes oldest first. */
async function dueItems(only?: string): Promise<Item[]> {
  const now = Date.now();
  const { rows } = await pool.query<Row>("SELECT * FROM season_catchups WHERE done_at IS NULL AND stuck_at IS NULL AND ($1::uuid IS NULL OR season_id = $1)", [only ?? null]);
  for (const r of rows.filter((x) => x.step === "episodes")) await settleSeason(r.season_id);
  const seasons: Item[] = rows.flatMap((r) => {
    const d = dueAt(r, now);
    return d && d.getTime() <= now ? [{ kind: "season" as const, seasonId: r.season_id, at: d.getTime() }] : [];
  });
  const { rows: eps } = await pool.query<EpisodeRow>(
    `SELECT e.* FROM catchup_episodes e JOIN season_catchups c ON c.season_id = e.season_id
      WHERE e.status = 'waiting' AND c.done_at IS NULL AND c.stuck_at IS NULL AND ($1::uuid IS NULL OR e.season_id = $1)
      ORDER BY e.episode_number, e.season_id`,
    [only ?? null]
  );
  const episodes: Item[] = eps.flatMap((e) => {
    const d = episodeDueAt(e, now);
    return d && d.getTime() <= now ? [{ kind: "episode" as const, seasonId: e.season_id, n: e.episode_number, at: d.getTime() }] : [];
  });
  return [...seasons, ...episodes];
}

/** When the earliest open item comes due (the clock's `next`). */
export async function catchUpsNextAt(): Promise<Date | null> {
  const now = Date.now();
  const { rows } = await pool.query<Row>("SELECT * FROM season_catchups WHERE done_at IS NULL AND stuck_at IS NULL");
  const { rows: eps } = await pool.query<EpisodeRow>(
    "SELECT e.* FROM catchup_episodes e JOIN season_catchups c ON c.season_id = e.season_id WHERE e.status = 'waiting' AND c.done_at IS NULL AND c.stuck_at IS NULL"
  );
  const due = [...rows.map((r) => dueAt(r, now)), ...eps.map((e) => episodeDueAt(e, now))].filter((d): d is Date => !!d);
  return due.length ? new Date(Math.max(now, Math.min(...due.map((d) => d.getTime())))) : null;
}

/**
 * The clock's turn: as many due items as the bots answer at once (`slots`, else askBotSlots for the catch-up's kind), side by
 * side, each ask starting at a different bot. `only`: one season (the desk's step now). The seasons it ran.
 */
export async function runDueCatchUp(o: { bot?: string; budgetMs?: number; slots?: number; only?: string }): Promise<string[]> {
  const items = await dueItems(o.only);
  if (!items.length) return [];
  const slots = o.slots ?? (await askBotSlots({ bot: o.bot, kind: "catchup" }));
  if (slots < 1) {
    const waiting = items.filter((i) => i.kind === "season").map((i) => i.seasonId);
    if (waiting.length) await pool.query("UPDATE season_catchups SET message = $2, tried_at = now(), updated_at = now() WHERE season_id = ANY($1::uuid[])", [waiting, AWAY]);
    return [];
  }
  const t0 = Date.now();
  const left = () => (o.budgetMs ?? BUDGET_MS) - (Date.now() - t0);
  const run = items.slice(0, slots);
  await Promise.allSettled(run.map((it, i) => (it.kind === "season" ? runSeasonStep(it.seasonId, o.bot, left) : runEpisode(it.seasonId, it.n, o.bot, left, i))));
  const seasons = [...new Set(run.map((i) => i.seasonId))];
  for (const s of seasons) await settleSeason(s).catch(() => undefined);
  const due = await catchUpsNextAt().catch(() => null);
  if (due) await tellBotClock(due).catch(() => undefined);
  return seasons;
}

/** A season's show or cast step. Never throws. */
async function runSeasonStep(seasonId: string, bot: string | undefined, left: () => number): Promise<void> {
  const { rows } = await pool.query<Row>(
    `UPDATE season_catchups SET asking_at = now(), updated_at = now()
      WHERE season_id = $1 AND done_at IS NULL AND stuck_at IS NULL AND step <> 'episodes'
        AND (asking_at IS NULL OR asking_at < now() - make_interval(secs => $2)) RETURNING *`,
    [seasonId, ASK_STALE_MS / 1000]
  );
  const row = rows[0];
  if (!row) return;
  const set = (fields: string, values: unknown[] = []) => pool.query(`UPDATE season_catchups SET ${fields}, updated_at = now() WHERE season_id = $1`, [seasonId, ...values]);
  try {
    if (left() < STEP_NEEDS_MS) return;
    const s = await seasonOf(seasonId);
    if (row.step === "show") {
      await showStep(s, bot, left() - 5_000);
      await set("step = 'cast', tries = 0, message = NULL");
    } else {
      await castStep(s, bot, left() - 5_000);
      await set("step = 'episodes', tries = 0, message = NULL");
      await settleSeason(seasonId);
    }
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[catch-up]", seasonId, row.step, message);
    await set(`tries = tries + 1, message = $2, stuck_at = CASE WHEN tries + 1 >= $3 THEN now() END`, [message, TRIES]).catch(() => undefined);
  } finally {
    await set("asking_at = NULL, tried_at = now()").catch(() => undefined);
  }
}

/** One episode: asked (the slow part, side by side), then tried and sent or held under the season's lock. Never throws. */
async function runEpisode(seasonId: string, n: number, bot: string | undefined, left: () => number, spread: number): Promise<void> {
  const { rows } = await pool.query(
    `UPDATE catchup_episodes SET asking_at = now(), updated_at = now()
      WHERE season_id = $1 AND episode_number = $2 AND status = 'waiting' AND (asking_at IS NULL OR asking_at < now() - make_interval(secs => $3))
      RETURNING episode_number`,
    [seasonId, n, ASK_STALE_MS / 1000]
  );
  if (!rows[0]) return;
  const set = (fields: string, values: unknown[] = []) =>
    pool.query(`UPDATE catchup_episodes SET ${fields}, updated_at = now() WHERE season_id = $1 AND episode_number = $2`, [seasonId, n, ...values]);
  try {
    if (left() < STEP_NEEDS_MS) return;
    const s = await seasonOf(seasonId);
    const { status, line } = await episodeStep(s, n, bot, left() - 5_000, spread);
    await set("status = $3, tries = 0, message = $4", [status, line]);
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[catch-up]", seasonId, "episode", n, message);
    await set(`tries = tries + 1, message = $3, status = CASE WHEN tries + 1 >= $4 THEN 'stopped' ELSE 'waiting' END`, [message, TRIES]).catch(() => undefined);
  } finally {
    await set("asking_at = NULL, tried_at = now()").catch(() => undefined);
  }
}

/** A season's try-and-send one at a time, across every process (a session advisory lock on its own connection). */
async function underSeasonLock<T>(seasonId: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [`catchup:${seasonId}`]);
    return await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`catchup:${seasonId}`]).catch(() => undefined);
    client.release();
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
  // Check for changes: the rulebook as our bot reads the show now, left on the rulebook's page as its card for the desk. Asked as
  // the catch-up's own kind (Codex by default). Optional: if it can't be asked, the desk can ask it later, and the season goes
  // on to its episodes anyway (a flaky bot never holds up what matters; the research questions need no AI, below).
  const asked = await askRulebookNow(id, "check", null, bot, budgetMs, null, "catchup");
  if (!asked.ok) {
    await recompile(id);
    await logDesk(pool, { entity: "rulebook", entityId: id, action: "catchup", text: `Catch-up: research questions brought up to date; Check for changes didn't answer (${asked.message.slice(0, 120)}): ask it from this page`, userId: null });
    return;
  }
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
  // Optional too: people's details can be asked from the desk's cast page later; the episodes don't need them.
  const asked = await askCastNow(s.id, null, bot, budgetMs, "catchup");
  if (!asked.ok) {
    await logDesk(pool, { entity: "season", entityId: s.id, action: "cast", text: `Catch-up: our bot's cast didn't answer (${asked.message.slice(0, 120)}): ask it from Who's in it`, userId: null });
    return;
  }
  await fillCastDetails(s.id);
}

/** One episode: researched, tried, then sent or held. The line the desk shows for it. */
async function episodeStep(s: Season, n: number, bot: string | undefined, budgetMs: number, spread: number): Promise<{ status: "sent" | "held"; line: string }> {
  const { prompt } = await buildPasteImportPrompt(pool, s.slug, s.season_number, n, { structured: true });
  if (!prompt) return { status: "sent", line: `Episode ${n}: nothing to ask` };
  // The catch-up's own kind (Codex by default: several at once), starting at a different bot for each ask going at once. Codex
  // needs the ChatGPT Plus plan: if it can't answer (the plan lapsed, its limit reached), the free ChatGPT bot asks instead.
  const until = Date.now() + budgetMs;
  const answer = await askBot(prompt, { bot, budgetMs, kind: "catchup", spread })
    .catch(() => askBot(prompt, { bot, budgetMs: until - Date.now(), provider: "chatgpt", spread }))
    .then((a) => a.answer);
  // Dry: read and checked, nothing stored or staged; the original answer stays as it was.
  const run = await researchFromPaste(pool, s.slug, s.season_number, n, answer, { structured: true, dry: true, via: "bot", checkEpisode: true });
  const input = await inputOf(s.id, n, run);
  return underSeasonLock(s.id, async () => {
    const tried = await tryResults(input);
    if (!tried.games.length) {
      const sent = await sendResults(input, { kind: "results.catchup", text: (count) => `The catch-up asked Episode ${n} again (${count})`, detail: { own: true, via: "catchup" } });
      return { status: "sent" as const, line: `Episode ${n}: sent, no score moves (${sent.count} in every game)` };
    }
    await hold(s.id, n, input, tried);
    return { status: "held" as const, line: `Episode ${n}: held, it would change scores in ${tried.games.length === 1 ? "a game" : `${tried.games.length} games`}` };
  });
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
  if (r.stuck_at) return { line: `The catch-up stopped at ${r.step === "episodes" ? "its episodes" : r.step === "cast" ? "its cast" : "its rulebook"}: ${r.message ?? "it failed"}`, stuck: true, waiting };
  if (r.step !== "episodes") return { line: `Catching up: ${r.step === "cast" ? "its cast" : "its rulebook"}${wait}`, stuck: false, waiting };
  const { rows: eps } = await pool.query<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM catchup_episodes WHERE season_id = $1 GROUP BY status", [seasonId]);
  const count = (st: string) => eps.find((e) => e.status === st)?.n ?? 0;
  const all = eps.reduce((t, e) => t + e.n, 0);
  return { line: `Catching up: ${count("sent") + count("held")} of ${all} episodes in${wait}`, stuck: false, waiting };
}

/** Start one (the desk, any season) or try again after it stopped. */
export async function startCatchUp(user: SessionUser, seasonId: string): Promise<{ text: string }> {
  await seasonOf(seasonId);
  await pool.query(
    `INSERT INTO season_catchups (season_id) VALUES ($1)
     ON CONFLICT (season_id) DO UPDATE SET stuck_at = NULL, tries = 0, message = NULL, tried_at = NULL,
       step = CASE WHEN season_catchups.done_at IS NULL THEN season_catchups.step ELSE 'show' END,
       done_at = NULL, updated_at = now()`,
    [seasonId]
  );
  // Try again: the episodes that stopped are asked again; a finished one started over asks every episode again.
  await pool.query(
    "UPDATE catchup_episodes SET status = 'waiting', tries = 0, message = NULL, tried_at = NULL, updated_at = now() WHERE season_id = $1 AND (status = 'stopped' OR (SELECT step FROM season_catchups WHERE season_id = $1) = 'show')",
    [seasonId]
  );
  await logDesk(pool, { entity: "season", entityId: seasonId, action: "catchup", text: "Started the catch-up", userId: user.id });
  const due = await catchUpsNextAt();
  if (due) await tellBotClock(due).catch(() => undefined);
  return { text: "The catch-up starts on the bot's next call" };
}

export const CATCH_UP_STEPS = STEPS;
