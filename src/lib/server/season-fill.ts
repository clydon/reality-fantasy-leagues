import { after } from "next/server";
import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { publicMediaSrc } from "@/lib/game/selectors";
import { showWords } from "@/lib/game/show-words";
import { EXPECT_MS, FILL_STEPS, stepAction, stepsShown, tileState, type FillFacts, type FillStep, type StepState, type TileState } from "@/lib/season-fill";
import { askBotStatus, tellBotClock } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { gamesOn } from "./desk-cast";
import { castByItself, castPastedByItself, castQuestion } from "./desk-cast-page";
import { mayFill, pasteRecaps, recapPromptFor, recapsByItself, recapsMissing } from "./episode-recaps";
import { autoMake, makePrompt, pasteMake } from "./make-game";
import { notifyReady } from "./push-events";
import { askResults, resultsResearch } from "./research-asks";
import { isTvmaze } from "./listings";
import { latestEnded, seasonSchedules } from "./schedule";
import { fillCastPhotos } from "./show-art";
import { seasonHeaders } from "./show-space";

// Getting it ready (docs/PLAN-getting-it-ready.md, db/migrations/0160): a season someone adds gets ready by itself, in order:
//   rules     how it's played: a show that's a game plays by its rulebook (ensureSeasonRulebook, no bot); a brand-new show is made
//             a game by our bot (make-game.ts autoMake: how it works, then who's in it), applied when our check passes, else it
//             waits for a person in Make it a game;
//   cast      who's in it, for a show that's a game with nobody in this season's cast and no game on it (desk-cast-page.ts
//             castByItself: our bot's answer, sent);
//   episodes  each aired episode's results queued when they're ours to look up (research-asks.ts: one at a time on the bot's
//             clock), then what happened in each (episode-recaps.ts: one ask), unless whoever added it switched them off.
// What's done is read from the data each time (season-fill.ts in lib, stepAction); the row is the job: the step it's on, the ask
// going now, tries at this step. Runs: after Add's answer (POST .../fill start), the page that's open when a run stopped partway
// (POST go), and the bot's clock (cron/bot-research: one due job a call, when no research run is due), which also fills seasons
// nobody has open. Our bot only: never the site's paid keys (docs/HOSTING.md, paid services contained).

import { pasteScoresByItself, rulebookPrompt, scoreRulebookByItself } from "./desk-rulebooks";
const ASK_STALE_MS = 6 * 60_000;
const BUDGET_MS = 280_000;
/** A step that asks our bot isn't started with less than this left: the next run carries on. */
const STEP_NEEDS_MS = 100_000;
/** Tries at one step before it stops (Try again starts it over). */
const TRIES = 3;
const RETRY_MS = 3 * 60_000;
/** The bot was away: look again after this. */
const AWAY_MS = 2 * 60_000;
/** A run that stopped between steps (out of time, or waiting on someone's ask): carried on after this. */
const CARRY_MS = 30_000;

const AWAY = "Our bot's away right now. It carries on when it's back.";
const NEEDS_LOOK = "ChatGPT's answer needs a look before it's a game.";

interface FillRow {
  season_id: string;
  started_by: string | null;
  episodes: boolean;
  step: FillStep | null;
  tries: number;
  asking_at: Date | null;
  tried_at: Date | null;
  message: string | null;
  stuck_at: Date | null;
  done_at: Date | null;
  created_at: Date;
  updated_at: Date;
  /** When the step it's on began (0161: the call sheet's estimate). */
  step_at: Date | null;
  /** When whoever added it was told it's all in (0161). */
  told_at: Date | null;
}

const rowOf = async (seasonId: string): Promise<FillRow | null> => (await pool.query<FillRow>("SELECT * FROM season_fills WHERE season_id = $1", [seasonId])).rows[0] ?? null;
const askingNow = (r: FillRow, now = Date.now()) => !!r.asking_at && now - r.asking_at.getTime() < ASK_STALE_MS;

/** When an open job should run again (null: running now, or not open). */
function dueAt(r: FillRow): Date | null {
  if (r.done_at || r.stuck_at || askingNow(r)) return null;
  if (!r.tried_at) return r.created_at;
  const wait = r.message === AWAY ? AWAY_MS : r.tries > 0 ? RETRY_MS : CARRY_MS;
  return new Date(r.tried_at.getTime() + wait);
}

async function factsOf(seasonId: string, row: Pick<FillRow, "episodes">): Promise<FillFacts & { aired: number }> {
  const { rows } = await pool.query(
    `SELECT s.kind, s.set_up_at IS NOT NULL AS set_up, ss.rulebook_id IS NOT NULL AS has_rulebook,
            (SELECT r.provenance->>'ladderAt' FROM rulebooks r WHERE r.id = ss.rulebook_id) IS NOT NULL AS scored,
            (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id) AS cast
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  if (!rows[0]) throw new HttpError(404, "Season not found");
  const [games, missing, results, schedules] = await Promise.all([gamesOn(seasonId), recapsMissing(seasonId), resultsResearch(seasonId), seasonSchedules([seasonId])]);
  const r = rows[0];
  return {
    kind: r.kind,
    setUp: r.set_up,
    hasRulebook: r.has_rulebook,
    scored: r.scored,
    cast: r.cast,
    games,
    episodes: row.episodes,
    recapsMissing: missing.length,
    resultsMissing: results?.missing.length ?? 0,
    aired: latestEnded(schedules.get(seasonId)),
  };
}

// The bot's health, asked at most every 20 s (pages poll while a job's going). A check's stand-in listings with no stand-in bot
// never reach the real one (as add-show.ts keeps them from the real ESPN): it's away.
let health: { at: number; available: boolean } | null = null;
async function botUp(bot: string | undefined, base: string): Promise<boolean> {
  if (bot) return (await askBotStatus({ bot })).available;
  if (!isTvmaze(base)) return false;
  if (health && Date.now() - health.at < 20_000) return health.available;
  const { available } = await askBotStatus();
  health = { at: Date.now(), available };
  return available;
}

interface RunOpts {
  base: string;
  bot?: string;
  budgetMs?: number;
}

/** One step's work: on to the next, stop this run (the next carries on), or wait for a person. A failed ask throws. `ask`
 *  false: our bot's away, so only what needs none (what's been pasted goes in; anything else waits). */
async function doStep(step: FillStep, row: FillRow, f: FillFacts, o: RunOpts, left: () => number, ask = true): Promise<"next" | "stop" | "needs"> {
  const by = row.started_by;
  if (step === "rules") {
    if (f.setUp) {
      // Its rulebook is made as any game's would be later on: one that can't be made here never holds the cast back.
      await ensureSeasonRulebook(pool, row.season_id).catch((e: unknown) => console.error("[season-fill] rulebook:", row.season_id, e));
      return "next";
    }
    if (!by) return "needs";
    const made = await autoMake(by, row.season_id, o.base, o.bot, { ask });
    if (made === "done") await photos(row.season_id, o.base);
    return made === "done" ? "next" : made === "needs" ? "needs" : "stop";
  }
  if (step === "scores") {
    // Every moment priced on the ladder, applied by itself: nobody plays it yet (docs/PLAN-rulebook-research.md).
    if (!ask) return "stop";
    if (!by) return "needs";
    const rb = await rulebookIdOf(row.season_id);
    if (!rb) return "next";
    await scoreRulebookByItself(rb, by, o.bot, left() - 5_000);
    return "next";
  }
  if (step === "cast") {
    if (!ask) return "stop";
    if (!by) return "needs";
    await castByItself(row.season_id, { id: by } as SessionUser, o.bot, left() - 5_000, o.base);
    await photos(row.season_id, o.base);
    return "next";
  }
  // The results first (queued: the bot's clock asks them one at a time), then what happened, in one ask.
  // Quiet: one notification when everything's in (tellReady), not one an episode.
  if (f.resultsMissing > 0 && by) await askResults(by, row.season_id, new Date(), { quiet: true }).catch((e) => console.error("[season-fill] results:", row.season_id, e));
  if (f.recapsMissing > 0) {
    if (!ask) return "stop";
    const filled = await recapsByItself(row.season_id, by, o.bot, left() - 5_000);
    // Someone's own ask is going: theirs fills them in, and the next run sees it.
    if (filled === null) return "stop";
  }
  return "next";
}

const rulebookIdOf = async (seasonId: string): Promise<string | null> => (await pool.query("SELECT rulebook_id FROM show_seasons WHERE id = $1", [seasonId])).rows[0]?.rulebook_id ?? null;

/** The cast's photos, looked up before its step is checked (the user, 2026-11-01: a check with one photo of 30 read as done). What
 *  the credits don't have stays the person's initial; it never holds the job up. */
async function photos(seasonId: string, base: string): Promise<void> {
  await fillCastPhotos(seasonId, base).catch((e) => console.error("[season-fill] photos:", seasonId, e));
}

/**
 * Everything's in (the job's done, and no episode's results are still to come): whoever added it is told, once (notifyReady),
 * in place of a notification an episode. Called as a run ends and as each asked episode's run ends (cron/bot-research).
 */
export async function tellReady(seasonId: string): Promise<void> {
  const { rows } = await pool.query(
    `UPDATE season_fills f SET told_at = now()
      WHERE f.season_id = $1 AND f.done_at IS NOT NULL AND f.told_at IS NULL AND f.started_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM research_asks a WHERE a.season_id = f.season_id AND a.done_at IS NULL)
      RETURNING f.started_by, f.episodes`,
    [seasonId]
  );
  if (!rows[0]) return;
  const aired = rows[0].episodes ? latestEnded((await seasonSchedules([seasonId])).get(seasonId)) : 0;
  notifyReady({ userId: rows[0].started_by, seasonId, episodes: aired });
}

/** Every job that's all in and nobody's been told about (an episode given up after its tries ends without its own run's call):
 *  the bot clock's sweep, each call. */
export async function tellAllReady(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT f.season_id FROM season_fills f
      WHERE f.done_at IS NOT NULL AND f.told_at IS NULL AND f.started_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM research_asks a WHERE a.season_id = f.season_id AND a.done_at IS NULL)`
  );
  for (const r of rows) await tellReady(r.season_id);
}

/** Run the job as far as the time allows: each step in turn, skipping what's there. Never throws. */
async function run(seasonId: string, o: RunOpts): Promise<void> {
  const t0 = Date.now();
  const left = () => (o.budgetMs ?? BUDGET_MS) - (Date.now() - t0);
  const { rows } = await pool.query<FillRow>(
    `UPDATE season_fills SET asking_at = now(), step_at = COALESCE(step_at, now()), updated_at = now()
      WHERE season_id = $1 AND done_at IS NULL AND stuck_at IS NULL AND (asking_at IS NULL OR asking_at < now() - make_interval(secs => $2))
      RETURNING *`,
    [seasonId, ASK_STALE_MS / 1000]
  );
  let row = rows[0];
  if (!row) return;
  const set = (fields: string, values: unknown[] = []) =>
    pool.query<FillRow>(`UPDATE season_fills SET ${fields}, updated_at = now() WHERE season_id = $1 RETURNING *`, [seasonId, ...values]);
  try {
    for (;;) {
      const step = row.step ?? "rules";
      const f = await factsOf(seasonId, row);
      const action = stepAction(step, f);
      // Our bot's away (or there's no time left for an ask): what's been pasted still goes in, and the rest waits, saying so.
      const ask = action !== "bot" || (left() >= STEP_NEEDS_MS && (await botUp(o.bot, o.base)));
      if (action !== "skip") {
        let outcome: "next" | "stop" | "needs";
        try {
          outcome = await doStep(step, row, f, o, left, ask);
        } catch (e) {
          const message = (e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300);
          console.error("[season-fill]", seasonId, step, message);
          await set(`tries = tries + 1, message = $2, stuck_at = CASE WHEN tries + 1 >= $3 THEN now() END`, [message, TRIES]);
          return;
        }
        if (outcome === "stop") return void (await set("message = $2", [ask || left() < STEP_NEEDS_MS ? null : AWAY]));
        if (outcome === "needs") return void (await set("message = $2, stuck_at = now()", [NEEDS_LOOK]));
      }
      const next = FILL_STEPS[FILL_STEPS.indexOf(step) + 1] ?? null;
      row = (await set(`step = $2, step_at = now(), tries = 0, message = NULL, done_at = CASE WHEN $2::text IS NULL THEN now() END`, [next])).rows[0];
      if (row.done_at) return;
    }
  } catch (e) {
    console.error("[season-fill] run:", seasonId, e);
  } finally {
    const { rows: after_ } = await set("asking_at = NULL, tried_at = now()").catch(() => ({ rows: [] as FillRow[] }));
    // Not done: the bot's clock is told when to call again (production only), so nobody needs to have the page open.
    const due = after_[0] ? dueAt(after_[0]) : null;
    if (due) await tellBotClock(due).catch(() => undefined);
    await tellReady(seasonId).catch((e) => console.error("[season-fill] tell:", seasonId, e));
  }
}

// ---------- what the page reads ----------

export interface FillState {
  seasonId: string;
  /** "The Challenge 42", its art and its words, so the call sheet stands on its own (Add a show's, before any show read). */
  label: string;
  artUrl: string | null;
  backdropUrl: string | null;
  words: { people: string; episode: string; episodes: string };
  /** No job: nothing to get ready (or it was all here already). Going: still getting it; results still coming in count. */
  status: "none" | "going" | "stuck" | "done";
  /** A step is being worked on right now. */
  asking: boolean;
  /** The page that's open should carry it on (POST go): it's due, and nothing's running it. */
  due: boolean;
  /** Our bot isn't answering: it carries on when it's back. */
  away: boolean;
  /** The step it's on (a brand-new show's cast, while Make it a game asks for it, counts as the cast's). */
  step: FillStep | null;
  steps: { key: FillStep; state: StepState }[];
  /** The cast once it's in. */
  cast: { count: number; faces: { name: string; photo: string | null }[] };
  /** Each aired episode's tile, when the episodes are looked up. */
  episodes: { number: number; state: TileState }[];
  message: string | null;
  /** A brand-new show's answer needs a person: Make it a game shows the review. */
  needsLook: boolean;
  /** The step shown, as it's going: when it began (the call sheet's estimate, lib/season-fill.ts stepShare) and what it usually
   *  takes; `phase` "photos" once the cast is in and its photos are being looked up. */
  since: string | null;
  expectMs: number | null;
  phase: "photos" | null;
  /** The episodes' results still to come (each on the bot's clock, RESULT_MS), and the one being looked up now with how far its
   *  answer has got (0 to 1; null while it hasn't said). */
  resultsLeft: number;
  now: { episode: number; share: number | null } | null;
  /** Changes when anything here does. */
  v: string;
}

/** The job's state, for the page (no follow needed to read it: it says nothing that isn't public). */
export async function fillState(seasonId: string): Promise<FillState> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const [row, headers] = await Promise.all([rowOf(seasonId), seasonHeaders([seasonId])]);
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const w = showWords(h.show.terms);
  const show = {
    label: `${h.show.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || h.show.name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
    artUrl: h.show.artUrl,
    backdropUrl: h.show.backdropUrl,
    words: { people: w.people, episode: w.episode, episodes: w.episodes },
  };
  const none: FillState = { seasonId, ...show, status: "none", asking: false, due: false, away: false, step: null, steps: [], cast: { count: 0, faces: [] }, episodes: [], message: null, needsLook: false, since: null, expectMs: null, phase: null, resultsLeft: 0, now: null, v: "none" };
  if (!row) return none;
  const [f, { rows: cast }, { rows: sums }, { rows: recapAsk }, results] = await Promise.all([
    factsOf(seasonId, row),
    pool.query("SELECT name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]),
    pool.query("SELECT number FROM season_episodes WHERE season_id = $1 AND summary IS NOT NULL", [seasonId]),
    pool.query("SELECT asking_at FROM episode_fills WHERE season_id = $1", [seasonId]),
    resultsResearch(seasonId),
  ]);
  const summed = new Set(sums.map((s) => s.number as number));
  const recapAsking = !!recapAsk[0]?.asking_at && Date.now() - new Date(recapAsk[0].asking_at).getTime() < ASK_STALE_MS;
  const asks = new Map((results?.asked ?? []).map((a) => [a.episode, a.status]));
  const step = await shownStep(row, f);
  const settled = !!row.done_at || !!row.stuck_at;
  const tiles = f.episodes
    ? Array.from({ length: f.aired }, (_, i) => i + 1).map((n) => ({
        number: n,
        state: tileState({
          summary: summed.has(n),
          recapAsking,
          results: !!results,
          ask: results?.now?.episode === n ? "asking" : (asks.get(n) ?? null),
          settled,
        }),
      }))
    : [];
  const resultsGoing = [...asks.values()].some((s) => s === "waiting" || s === "asking");
  const status: FillState["status"] = row.stuck_at ? "stuck" : !row.done_at || resultsGoing ? "going" : "done";
  const shown = stepsShown(f, f.aired);
  const at = step ? FILL_STEPS.indexOf(step) : FILL_STEPS.length;
  const steps = shown.map((key) => {
    const i = FILL_STEPS.indexOf(key);
    const state: StepState =
      key === "episodes" && status === "going" && resultsGoing && !step ? "working" : i < at ? "done" : i > at ? "next" : row.stuck_at ? "stuck" : "working";
    return { key, state };
  });
  const asking = askingNow(row);
  const away = status === "going" && !asking && row.message === AWAY;
  const due = dueAt(row);
  // When the step shown began: a brand-new show's cast (Make it a game's second ask) from when its first answer came in, the
  // photos from when the cast did, else the step's own start.
  const phase = step === "cast" && cast.length > 0 ? "photos" : null;
  let since = row.step_at;
  if (phase) {
    const { rows: s } = await pool.query("SELECT cast_approved_at FROM show_seasons WHERE id = $1", [seasonId]);
    since = s[0]?.cast_approved_at ?? since;
  } else if (step === "cast" && !f.setUp) {
    const { rows: s } = await pool.query("SELECT updated_at FROM show_setups WHERE season_id = $1 AND done_at IS NULL", [seasonId]);
    since = s[0]?.updated_at ?? since;
  }
  const resultsLeft = [...asks.values()].filter((x) => x === "waiting" || x === "asking").length;
  return {
    seasonId,
    ...show,
    status,
    asking,
    due: !!due && due.getTime() <= Date.now(),
    away,
    step: status === "going" ? (step ?? "episodes") : step,
    steps,
    cast: { count: cast.length, faces: cast.map((c) => ({ name: c.name, photo: publicMediaSrc(c.photo_url) })) },
    episodes: tiles,
    message: row.stuck_at ? row.message : null,
    needsLook: !!row.stuck_at && row.message === NEEDS_LOOK,
    since: step && since ? new Date(since).toISOString() : null,
    expectMs: step ? (phase ? 20_000 : step === "rules" && f.setUp ? 5_000 : EXPECT_MS[step]) : null,
    phase,
    resultsLeft,
    now: results?.now ? { episode: results.now.episode, share: results.now.share } : null,
    v: [status, step, phase ?? "", cast.filter((c) => c.photo_url).length, asking ? 1 : 0, cast.length, tiles.map((t) => t.state[0]).join(""), row.updated_at.getTime()].join(":"),
  };
}

// ---------- what starts it ----------

/**
 * Get a season ready (POST .../fill { action: "start", episodes }): Add a show's, after it's added; the show's page's, when a
 * season someone follows, of a show that's a game, has nobody in its cast and no job yet (show-space.ts filling "missing"). A stopped job starts over (Try again: { action:
 * "retry" } is the same). Runs after the answer. Only someone who follows the season or plays it.
 */
export async function startFill(user: SessionUser, seasonId: string, body: { episodes?: unknown }, o: RunOpts): Promise<FillState> {
  await mayFill(user.id, seasonId);
  const row = await rowOf(seasonId);
  // Said (Add's switch), else as the job had it (Try again, the show's page), else on.
  const said = typeof body.episodes === "boolean" ? body.episodes : null;
  const f = await factsOf(seasonId, { episodes: said ?? row?.episodes ?? true });
  const todo = FILL_STEPS.some((s) => stepAction(s, f) !== "skip");
  // Nothing to get, and no job to start over: nothing's written.
  if (!todo && (!row || (!row.stuck_at && row.done_at))) return fillState(seasonId);
  await pool.query(
    `INSERT INTO season_fills (season_id, started_by, episodes) VALUES ($1, $2, COALESCE($3::boolean, true))
     ON CONFLICT (season_id) DO UPDATE SET
       started_by = COALESCE(season_fills.started_by, EXCLUDED.started_by),
       episodes = CASE WHEN $3::boolean IS NULL THEN season_fills.episodes ELSE season_fills.episodes OR $3::boolean END,
       step = CASE WHEN season_fills.asking_at IS NULL OR season_fills.asking_at < now() - make_interval(secs => $4) THEN NULL ELSE season_fills.step END,
       tries = 0, message = NULL, stuck_at = NULL, done_at = NULL, tried_at = NULL, step_at = NULL, told_at = NULL, updated_at = now()`,
    [seasonId, user.id, said, ASK_STALE_MS / 1000]
  );
  after(() => run(seasonId, o));
  return fillState(seasonId);
}

/** The page that's open carries a job on that stopped partway (POST .../fill { action: "go" }), when it's due. */
export async function goFill(seasonId: string, o: RunOpts): Promise<FillState> {
  const row = isUuid(seasonId) ? await rowOf(seasonId) : null;
  const due = row ? dueAt(row) : null;
  if (due && due.getTime() <= Date.now()) after(() => run(seasonId, o));
  return fillState(seasonId);
}

// ---------- copy and paste: the free way, for everyone ----------

/** The step a job is on as it's shown: a brand-new show's cast, while Make it a game waits for it, is the cast's. */
async function shownStep(row: FillRow, f: FillFacts): Promise<FillStep | null> {
  if (row.done_at) return null;
  const step = row.step ?? "rules";
  // A brand-new show made a game: its cast is in and its photos are being looked up, still the cast's step.
  if (step === "rules" && f.setUp && f.cast > 0) return "cast";
  if (step !== "rules" || f.setUp) return step;
  const { rows } = await pool.query("SELECT stage FROM show_setups WHERE season_id = $1 AND done_at IS NULL", [row.season_id]);
  return rows[0]?.stage === "cast" ? "cast" : "rules";
}

/** The step to copy and paste now, and whether it's a brand-new show's (Make it a game's answers) or its own. */
async function pasteStep(seasonId: string): Promise<{ row: FillRow; f: FillFacts; step: FillStep; made: boolean }> {
  const row = await rowOf(seasonId);
  if (!row || row.done_at) throw new HttpError(409, "It's all in already");
  const f = await factsOf(seasonId, row);
  const step = await shownStep(row, f);
  if (!step) throw new HttpError(409, "It's all in already");
  // Only what this job gets: never a cast a game already has, nor episodes switched off.
  const pastable = step === "episodes" || step === "scores" ? stepAction(step, f) !== "skip" : step === "rules" ? !f.setUp : !f.setUp || stepAction(step, f) !== "skip";
  if (!pastable) throw new HttpError(409, "Nothing to paste for that");
  return { row, f, step, made: !f.setUp && step !== "episodes" && step !== "scores" };
}

/** The question for the step it's on (GET .../fill?prompt=1), to ask in your own chat: free, always there, our bot or not. */
export async function fillPrompt(user: SessionUser, seasonId: string): Promise<{ prompt: string; task: string; step: FillStep }> {
  await mayFill(user.id, seasonId);
  const { step, made } = await pasteStep(seasonId);
  if (made) return { ...(await makePrompt(user, seasonId, step)), step };
  if (step === "scores") {
    const rb = await rulebookIdOf(seasonId);
    if (!rb) throw new HttpError(409, "Nothing to paste for that");
    const q = await rulebookPrompt(rb, "scores");
    return { prompt: q.prompt, task: q.task, step };
  }
  if (step === "cast") return { ...(await castQuestion(seasonId)), step };
  return { prompt: (await recapPromptFor(user, seasonId)).prompt, task: "finding out what happened in each episode", step };
}

/**
 * A pasted answer for the step it's on (POST .../fill { action: "paste", answer }): how it works or who's in it for a brand-new
 * show (Make it a game's, set up once both are in and our check passes), who's in it for a show that's a game (sent as its
 * cast), or what happened in each episode (the episodes are done with then: anything still missing is the card's). Then the job
 * carries on after the answer.
 */
export async function fillPaste(user: SessionUser, seasonId: string, answer: unknown, o: RunOpts): Promise<FillState> {
  await mayFill(user.id, seasonId);
  const { step, made } = await pasteStep(seasonId);
  if (made) await pasteMake(user, seasonId, null, { part: step, answer }, o.base);
  else if (step === "scores") {
    const rb = await rulebookIdOf(seasonId);
    if (!rb) throw new HttpError(409, "Nothing to paste for that");
    await pasteScoresByItself(rb, user, answer);
  } else if (step === "cast") await castPastedByItself(seasonId, user, answer, o.base);
  else {
    await pasteRecaps(user, seasonId, answer);
    await askResults(user.id, seasonId).catch((e) => console.error("[season-fill] results:", seasonId, e));
    await pool.query("UPDATE season_fills SET done_at = now(), updated_at = now() WHERE season_id = $1", [seasonId]);
  }
  await pool.query("UPDATE season_fills SET tries = 0, message = NULL, stuck_at = NULL, tried_at = NULL, updated_at = now() WHERE season_id = $1 AND done_at IS NULL", [seasonId]);
  after(() => run(seasonId, o));
  return fillState(seasonId);
}

// ---------- the bot's clock ----------

const openRows = async (): Promise<FillRow[]> => (await pool.query<FillRow>("SELECT * FROM season_fills WHERE done_at IS NULL AND stuck_at IS NULL ORDER BY created_at")).rows;

/** When the next job comes due (null: none), for the clock's `next`. */
export async function fillsNextAt(): Promise<Date | null> {
  let next: number | null = null;
  for (const r of await openRows()) {
    const at = dueAt(r);
    if (at && (next === null || at.getTime() < next)) next = at.getTime();
  }
  return next === null ? null : new Date(Math.max(next, Date.now()));
}

/** One run of the earliest job that's due, within `budgetMs` (a clock call that ran no research). The season it ran, or null. */
export async function runDueFill(o: RunOpts): Promise<string | null> {
  const now = Date.now();
  const due = (await openRows()).find((r) => {
    const at = dueAt(r);
    return !!at && at.getTime() <= now;
  });
  if (!due) return null;
  await run(due.season_id, o);
  return due.season_id;
}
