import { after } from "next/server";
import { carryWas, changeRun, normalizeEpisodes, normalizeSchedule, planRuns, usualSchedule, USUAL_KEY, type BotScheduleRun } from "@db/bot-research.js";
import type { PoolClient } from "pg";
import { autoLine, cap, changeLine, countWord, isUsual, KINDS, type Run, type RunKind } from "@/lib/desk-bot-words";
import type { SessionUser } from "./auth-helpers";
import { tellBotClock } from "./ask-bot";
import { pool, tx, HttpError } from "./db";
import { logDesk } from "./desk";

// The bot on the desk (docs/PLAN-new-design.md step 6c part 2; the mock's community.js admSettings): each season's
// schedule, which is Autopilot's trial (the runs an admin switches on for a season are what Autopilot will be: Backstage
// says "Autopilot · On for this season" while one has a quick or full run), and what the desk's tie-break switch reaches.
//
// Survivor 51's schedule runs only the schedule check (the user's decision, 2026-10-24): nothing here changes a season
// unless an admin does it on its page.
//
// The research pattern (the user, 2026-10-29): a season with no schedule of its own (bot_research_schedule NULL) follows our
// usual, which the desk can change ("Make this our usual": app_settings 'bot_usual', db/bot-research.js usualSchedule), and
// changes with it; a change to its runs gives it its own, and Reset makes it follow again. A change is for every episode
// (the season's runs, and each episode's own runs where it applies) or for one episode only (bot_research_episodes, 0431:
// its own runs over the season's, for it alone; "Back to the season's schedule" lets them go). Each is a History line with Undo.

export interface SeasonBot {
  on: boolean;
  /** When it was switched on: runs timed before it are never picked up. */
  since: string | null;
  /** How long its episodes run (the runs count from the end); null: an hour. */
  episodeMinutes: number | null;
  /** Its runs, each on or off (the schedule is kept while the bot is off): its own, or our usual's when it follows it. */
  schedule: BotScheduleRun[];
  /** It has no schedule of its own: it follows our usual, and changes with it. */
  follows: boolean;
  /** Our usual runs. */
  usual: BotScheduleRun[];
  /** The episodes with runs of their own, over the season's for that episode alone. */
  episodes: Record<number, BotScheduleRun[]>;
  /** The latest runs, newest first: scheduled, One taps and tie-breaks. */
  recent: { episode: number; kind: string; slot: string; ok: boolean | null; message: string | null; at: string }[];
}

const KIND_WORD: Record<string, string> = { quick: "who went home", full: "the full results", schedule: "when the next episode airs", trivia: "trivia questions", bingo: "bingo squares" };

/** "Checks who went home and the full results" (what a schedule's runs ask about, in a line). */
export function scheduleLine(schedule: BotScheduleRun[]): string {
  const kinds = [...new Set(schedule.filter((r) => r.on).map((r) => r.kind))];
  if (!kinds.length) return "Nothing switched on";
  const words = kinds.map((k) => KIND_WORD[k] ?? k);
  return `Checks ${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]}`;
}

/** A season's schedule from its column: its own (null: it follows our usual, `usual`); one that isn't sound reads as our usual. */
export function scheduleOf(column: unknown, usual: BotScheduleRun[]): BotScheduleRun[] {
  try {
    return normalizeSchedule(column, usual);
  } catch {
    return normalizeSchedule(null, usual);
  }
}

/** One season's bot: its schedule (its own or our usual), its episodes' own runs and its latest runs. */
export async function seasonBot(seasonId: string): Promise<SeasonBot> {
  const [{ rows }, { rows: own }, usual, { rows: runs }] = await Promise.all([
    pool.query("SELECT bot_research_on, bot_research_since, bot_research_schedule, episode_minutes FROM show_seasons WHERE id = $1", [seasonId]),
    pool.query("SELECT episode_number, schedule FROM bot_research_episodes WHERE season_id = $1", [seasonId]),
    usualSchedule(pool),
    pool.query("SELECT episode_number, kind, slot, ok, message, started_at FROM bot_research_runs WHERE season_id = $1 ORDER BY started_at DESC LIMIT 6", [seasonId]),
  ]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const s = rows[0];
  return {
    on: !!s.bot_research_on,
    since: s.bot_research_since ? s.bot_research_since.toISOString() : null,
    episodeMinutes: s.episode_minutes ?? null,
    schedule: scheduleOf(s.bot_research_schedule, usual),
    follows: s.bot_research_schedule == null,
    usual,
    episodes: normalizeEpisodes(Object.fromEntries(own.map((e) => [e.episode_number, e.schedule]))),
    recent: runs.map((r) => ({ episode: r.episode_number, kind: r.kind, slot: r.slot, ok: r.ok, message: r.message, at: r.started_at.toISOString() })),
  };
}

/** The seasons whose bot is on, and what each one checks: the desk's Settings (Autopilot's trial). */
export async function autopilotSeasons(): Promise<{ id: string; name: string; line: string }[]> {
  const [{ rows }, usual] = await Promise.all([
    pool.query(
      `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.bot_research_schedule
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on ORDER BY s.name, ss.season_number`
    ),
    usualSchedule(pool),
  ]);
  return rows.map((r) => ({ id: r.id, name: r.name, line: cap(autoLine(scheduleOf(r.bot_research_schedule, usual) as Run[])) }));
}

/**
 * Who our usual reaches, but `exceptId`: the seasons with Autopilot on that follow it (and change with it), and those with a
 * schedule of their own (which keep theirs). "Make this our usual" says both.
 */
export async function usualReach(exceptId: string): Promise<{ follow: string[]; own: string[] }> {
  const { rows } = await pool.query(
    `SELECT COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.bot_research_schedule IS NULL AS follows
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on AND ss.id <> $1 ORDER BY s.name, ss.season_number`,
    [exceptId]
  );
  return { follow: rows.filter((r) => r.follows).map((r) => r.name), own: rows.filter((r) => !r.follows).map((r) => r.name) };
}

/** The seasons a tie-break run could reach today: every airing season (results are shared on all of them). */
export async function tiebreakReach(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.status = 'airing' ORDER BY s.name, ss.season_number`
  );
  return rows.map((r) => r.name);
}

/**
 * The bot's clock calls only when it's told a run is due (db/bot-research.js), so anything that can bring one earlier (a
 * schedule, the tie-break switch, a flag) tells it after the response. Production only (tellBotClock).
 */
export function nudgeBotClock(): void {
  // tellBotClock tells only production's clock: anywhere else, planning the runs would be wasted.
  if (process.env.VERCEL_ENV !== "production") return;
  after(async () => {
    try {
      await tellBotClock((await planRuns(pool)).next);
    } catch (e) {
      console.error("[bot-research] couldn't tell the bot's clock:", e);
    }
  });
}

/** What setSeasonBot changes, and puts back on Undo. `schedule` null: it follows our usual. `episodeMinutes` null: an hour. */
interface BotBefore {
  on: boolean;
  schedule: BotScheduleRun[] | null;
  episodeMinutes: number | null;
}

type Db = PoolClient | typeof pool;

async function writeBot(db: Db, seasonId: string, next: BotBefore, was: boolean): Promise<void> {
  // Switched on, the clock starts now, so runs timed before it are never picked up (as classic's Setup did); off, it's
  // cleared; left on, it stays.
  await db.query(
    `UPDATE show_seasons SET bot_research_on = $2, bot_research_schedule = $3::jsonb, episode_minutes = $5,
            bot_research_since = CASE WHEN NOT $2 THEN NULL WHEN $4 THEN bot_research_since ELSE now() END
      WHERE id = $1`,
    [seasonId, next.on, next.schedule === null ? null : JSON.stringify(next.schedule), was, next.episodeMinutes]
  );
}

/** An episode's own runs written (null: it goes back to the season's). */
async function writeEpisode(db: Db, seasonId: string, episode: number, runs: BotScheduleRun[] | null, userId: string | null): Promise<void> {
  if (runs === null) await db.query("DELETE FROM bot_research_episodes WHERE season_id = $1 AND episode_number = $2", [seasonId, episode]);
  else
    await db.query(
      `INSERT INTO bot_research_episodes (season_id, episode_number, schedule, updated_by) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (season_id, episode_number) DO UPDATE SET schedule = EXCLUDED.schedule, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [seasonId, episode, JSON.stringify(runs), userId]
    );
}

/** Two lists of runs with the same runs, each on or off alike (what they were before they moved aside). */
const sameRuns = (a: BotScheduleRun[], b: BotScheduleRun[]) => isUsual(a as Run[], b as Run[]);

/** Our usual as app_settings keeps it (null: unset, DEFAULT_SCHEDULE), written or cleared. */
async function writeUsual(db: Db, usual: unknown): Promise<void> {
  if (usual == null) await db.query("DELETE FROM app_settings WHERE key = $1", [USUAL_KEY]);
  else
    await db.query(`INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [
      USUAL_KEY,
      JSON.stringify(usual),
    ]);
}

const words = (b: BotBefore, usual: BotScheduleRun[]) => ({ on: b.on, runs: (b.schedule ?? usual) as Run[], minutes: b.episodeMinutes ?? 60 });

/**
 * One run's change, from a request: `from` a run's slot ("full@720"), `to` a run ({ kind, after, on }), and `was` the slots
 * `from` moved from (an episode's own run, changed for every episode, finds the season's it came from by them).
 */
interface RunChange {
  from: string | null;
  to: BotScheduleRun | null;
  was: string[];
}
function runChange(raw: unknown): RunChange {
  const r = raw as { from?: unknown; to?: unknown; was?: unknown } | null;
  if (!r || typeof r !== "object") throw new HttpError(400, "run is { from, to }");
  const from = r.from == null ? null : String(r.from);
  if (from !== null && !/^(quick|full|schedule|trivia|bingo)@\d{1,5}$/.test(from)) throw new HttpError(400, "from is a run's slot, like full@60");
  let to: BotScheduleRun | null = null;
  if (r.to != null) {
    try {
      [to] = normalizeSchedule([r.to]);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Bad run");
    }
  }
  if (!from && !to) throw new HttpError(400, "Say which run to change, add or take off");
  const was = Array.isArray(r.was) ? r.was.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  return { from, to, was };
}

/** `changeRun`, its refusal a 400. A `from` the list hasn't is the run it moved from, when the list has that. */
function changed(list: BotScheduleRun[], c: RunChange, loose = false): BotScheduleRun[] {
  const has = (s: string) => list.some((r) => `${r.kind}@${r.after}` === s);
  const from = c.from && !has(c.from) ? (c.was.find(has) ?? c.from) : c.from;
  try {
    return changeRun(list, from, c.to, { loose });
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Bad run");
  }
}

/**
 * Changes one season's bot: `on` (Autopilot: its schedule runs or not), `schedule` (each run's kind, its minutes, and on or
 * off), `run` (one run changed for every episode: { from, to }, as changeRun), `addUsual` (a kind: our usual's runs of it that
 * it hasn't), `reset: true` (it follows our usual again) and/or `episodeMinutes` (how long its episodes run: every run but
 * trivia's and bingo's counts from the end; 5 to 600, null an hour). `episode` (with `run`, or `back: true`): that episode's
 * own runs instead (setEpisodeBot); `makeUsual: true`: its schedule becomes our usual (makeUsual). A run changed for every
 * episode reaches each episode's own runs too, where it applies. A line in the season's History with Undo; the bot's clock is
 * told. `changeId` null: nothing changed.
 */
export async function setSeasonBot(
  user: SessionUser,
  seasonId: string,
  body: { on?: unknown; schedule?: unknown; episodeMinutes?: unknown; reset?: unknown; run?: unknown; addUsual?: unknown; episode?: unknown; back?: unknown; makeUsual?: unknown }
): Promise<{ bot: SeasonBot; changeId: string | null; text: string }> {
  if (body.episode !== undefined) return setEpisodeBot(user, seasonId, body.episode, body);
  if (body.makeUsual === true) return makeUsual(user, seasonId);
  const before = await seasonBot(seasonId);
  const usual = before.usual;
  const was: BotBefore = { on: before.on, schedule: before.follows ? null : before.schedule, episodeMinutes: before.episodeMinutes };
  const next: BotBefore = { ...was };
  // The run changes for every episode, which each episode's own runs take too.
  const changes: RunChange[] = [];
  if (body.on !== undefined) {
    if (typeof body.on !== "boolean") throw new HttpError(400, "on is true or false");
    next.on = body.on;
  }
  if (body.schedule !== undefined) {
    try {
      next.schedule = normalizeSchedule(carryWas(before.schedule, normalizeSchedule(body.schedule)));
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Bad schedule");
    }
  }
  if (body.run !== undefined) changes.push(runChange(body.run));
  if (body.addUsual !== undefined) {
    if (typeof body.addUsual !== "string" || !(body.addUsual in KINDS)) throw new HttpError(400, "addUsual is a run's kind");
    for (const r of usual.filter((u) => u.kind === body.addUsual && !before.schedule.some((x) => x.kind === u.kind && x.after === u.after))) changes.push({ from: null, to: { kind: r.kind, after: r.after, on: r.on }, was: [] });
  }
  for (const c of changes) next.schedule = changed(next.schedule ?? before.schedule, c);
  // Reset: it follows our usual again (and changes with it), said as that whatever it changes.
  if (body.reset === true) next.schedule = null;
  if (body.episodeMinutes !== undefined) {
    const n = body.episodeMinutes === null ? null : Number(body.episodeMinutes);
    if (n !== null && (!Number.isInteger(n) || n < 5 || n > 600)) throw new HttpError(400, "An episode runs 5 minutes to 10 hours");
    next.episodeMinutes = n === 60 ? null : n;
  }
  // Each episode's own runs, with the same changes where they apply; any that come out as the season's runs now go back to
  // them (null).
  const episodes: Record<number, BotScheduleRun[] | null> = {};
  if (changes.length || body.schedule !== undefined || body.reset === true)
    for (const [n, own] of Object.entries(before.episodes)) {
      const now = changes.reduce((l, c) => changed(l, c, true), own);
      if (sameRuns(now, next.schedule ?? usual)) episodes[Number(n)] = null;
      else if (!sameRuns(now, own)) episodes[Number(n)] = now;
    }
  const same = next.on === was.on && JSON.stringify(next.schedule) === JSON.stringify(was.schedule) && (next.episodeMinutes ?? 60) === (was.episodeMinutes ?? 60);
  if (same && !Object.keys(episodes).length) return { bot: before, changeId: null, text: "Nothing changed" };
  const text =
    body.reset === true
      ? `Schedule reset to our usual ${countWord(usual.length)}`
      : changeLine(words(was, usual), words(next, usual), body.schedule !== undefined ? usual : []);
  // The episodes' own runs this changed, as they were (for its History line and Undo).
  const touched = Object.keys(episodes).length ? { episodes: Object.fromEntries(Object.keys(episodes).map((n) => [n, before.episodes[Number(n)]])) } : {};
  // The season, the episodes' own runs and the History line together, or none of them.
  const changeId = await tx(async (db) => {
    await writeBot(db, seasonId, next, before.on);
    for (const [n, runs] of Object.entries(episodes)) await writeEpisode(db, seasonId, Number(n), runs, user.id);
    return logDesk(db, {
      entity: "season",
      entityId: seasonId,
      action: "bot",
      text,
      before: { ...was, ...touched },
      after: { ...next, ...(Object.keys(episodes).length ? { episodes } : {}) },
      // The length goes back only with a line that changed it: another line's Undo leaves a length set since.
      // v 2: `schedule` null means it followed our usual (an older line's runs are what it had, our usual's when it followed it).
      undo: {
        type: "bot",
        v: 2,
        id: seasonId,
        on: was.on,
        schedule: was.schedule,
        ...(next.episodeMinutes !== was.episodeMinutes ? { episodeMinutes: was.episodeMinutes } : {}),
        ...touched,
      },
      userId: user.id,
    });
  });
  nudgeBotClock();
  return { bot: await seasonBot(seasonId), changeId, text };
}

/**
 * One episode's own runs (the desk's "Episode N only"): `run` changes one ({ from, to }, on the episode's own runs, or a copy
 * of the season's when it has none); `back: true` lets them go (the season's schedule again). Runs that come out the same as
 * the season's go back to it on their own. A History line with Undo.
 */
async function setEpisodeBot(user: SessionUser, seasonId: string, raw: unknown, body: { run?: unknown; back?: unknown }): Promise<{ bot: SeasonBot; changeId: string | null; text: string }> {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new HttpError(400, "Which episode?");
  const before = await seasonBot(seasonId);
  const own = before.episodes[n] ?? null;
  let next: BotScheduleRun[] | null;
  let text: string;
  if (body.back === true) {
    if (!own) return { bot: before, changeId: null, text: "Nothing changed" };
    next = null;
    text = `Episode ${n}: back to the season's schedule`;
  } else if (body.run !== undefined) {
    const base = own ?? before.schedule;
    const now = changed(base, runChange(body.run));
    next = sameRuns(now, before.schedule) ? null : now;
    if (JSON.stringify(next) === JSON.stringify(own)) return { bot: before, changeId: null, text: "Nothing changed" };
    const line = changeLine({ on: true, runs: base as Run[], minutes: 60 }, { on: true, runs: now as Run[], minutes: 60 }, []);
    text = `Episode ${n} only: ${line}${own && !next ? " (the season's schedule again)" : ""}`;
  } else throw new HttpError(400, "An episode's change is a run, or back: true");
  const changeId = await tx(async (db) => {
    await writeEpisode(db, seasonId, n, next, user.id);
    return logDesk(db, {
      entity: "season",
      entityId: seasonId,
      action: "bot",
      text,
      before: { episode: n, schedule: own },
      after: { episode: n, schedule: next },
      undo: { type: "botEpisode", id: seasonId, episode: n, schedule: own },
      userId: user.id,
    });
  });
  nudgeBotClock();
  return { bot: await seasonBot(seasonId), changeId, text };
}

/**
 * Make this our usual (tier 2, its sheet says who changes with it): the season's own runs become our usual (app_settings
 * 'bot_usual'), each run our usual moved remembering what it was (carryWas: the seasons that follow it aren't asked again
 * about an episode the old one already ran for), and the season follows it from now on. Seasons with their own schedule keep
 * theirs. A History line on the season, with Undo (our usual as it was, and its own runs).
 */
async function makeUsual(user: SessionUser, seasonId: string): Promise<{ bot: SeasonBot; changeId: string | null; text: string }> {
  const before = await seasonBot(seasonId);
  if (before.follows) throw new HttpError(409, "It follows our usual already");
  // Every season that follows our usual would run nothing.
  if (!before.schedule.some((r) => r.on)) throw new HttpError(400, "Our usual needs a run that's on");
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = $1", [USUAL_KEY]);
  const usual = normalizeSchedule(carryWas(before.usual, before.schedule));
  const line = changeLine({ on: true, runs: before.usual as Run[], minutes: 60 }, { on: true, runs: usual as Run[], minutes: 60 }, []);
  const text = `Made this our usual: ${line === "Nothing changed" ? "the same runs" : line}`;
  const changeId = await tx(async (db) => {
    await writeUsual(db, usual);
    await db.query("UPDATE show_seasons SET bot_research_schedule = NULL WHERE id = $1", [seasonId]);
    return logDesk(db, {
      entity: "season",
      entityId: seasonId,
      action: "bot",
      text,
      before: { usual: before.usual, schedule: before.schedule },
      after: { usual, schedule: null },
      undo: { type: "botUsual", id: seasonId, usual: rows[0]?.value ?? null, schedule: before.schedule },
      userId: user.id,
    });
  });
  nudgeBotClock();
  return { bot: await seasonBot(seasonId), changeId, text };
}

/** History's Undo: the season's bot as it was (its episode length too, when the line kept it; its episodes' own runs a change reached). */
export async function restoreSeasonBot(
  seasonId: string,
  was: { on: boolean; schedule: BotScheduleRun[] | null; episodeMinutes?: number | null; episodes?: Record<string, BotScheduleRun[] | null>; legacy?: boolean }
): Promise<void> {
  const now = await seasonBot(seasonId);
  let schedule = was.schedule === null ? null : normalizeSchedule(was.schedule);
  // A line from before seasons followed our usual saved our usual's runs for one that did: our usual's runs, it follows it.
  if (was.legacy && schedule && sameRuns(schedule, now.usual)) schedule = null;
  await tx(async (db) => {
    await writeBot(db, seasonId, { on: !!was.on, schedule, episodeMinutes: was.episodeMinutes === undefined ? now.episodeMinutes : was.episodeMinutes }, now.on);
    for (const [n, runs] of Object.entries(was.episodes ?? {})) await writeEpisode(db, seasonId, Number(n), runs ? normalizeSchedule(runs) : null, null);
  });
  nudgeBotClock();
}

/** History's Undo of an episode's own runs: as they were (null: the season's). */
export async function restoreEpisodeBot(seasonId: string, episode: number, runs: BotScheduleRun[] | null): Promise<void> {
  await writeEpisode(pool, seasonId, episode, runs ? normalizeSchedule(runs) : null, null);
  nudgeBotClock();
}

/** History's Undo of Make this our usual: our usual as it was (null: DEFAULT_SCHEDULE), and the season's own runs. */
export async function restoreUsual(seasonId: string, usual: unknown, schedule: BotScheduleRun[]): Promise<void> {
  await tx(async (db) => {
    await writeUsual(db, usual == null ? null : normalizeSchedule(usual));
    await db.query("UPDATE show_seasons SET bot_research_schedule = $2::jsonb WHERE id = $1", [seasonId, JSON.stringify(normalizeSchedule(schedule))]);
  });
  nudgeBotClock();
}

/** The airing seasons, Autopilot on, whose own schedule has no run of one of our usual's kinds (the Inbox, part 4). */
export async function lackingUsual(usual: BotScheduleRun[]): Promise<{ id: string; name: string; kind: RunKind; usual: BotScheduleRun[]; bank: boolean }[]> {
  const [{ rows }] = await Promise.all([
    pool.query(
      `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.bot_research_schedule AS schedule,
              EXISTS (SELECT 1 FROM bingo_squares b WHERE b.season_id = ss.id AND b.episode IS NULL AND b.status = 'live') AS bank
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
        WHERE ss.status = 'airing' AND ss.bot_research_on AND ss.bot_research_schedule IS NOT NULL AND s.archived = false
          AND (ss.finale_date IS NULL OR ss.finale_date >= current_date - 3)
        ORDER BY s.name, ss.season_number`
    ),
  ]);
  const kinds = [...new Set(usual.map((u) => u.kind))] as RunKind[];
  return rows.flatMap((r) => {
    const runs = scheduleOf(r.schedule, usual);
    return kinds.filter((k) => !runs.some((x) => x.kind === k)).map((kind) => ({ id: r.id, name: r.name, kind, usual: usual.filter((u) => u.kind === kind), bank: !!r.bank }));
  });
}
