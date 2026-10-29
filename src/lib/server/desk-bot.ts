import { after } from "next/server";
import { normalizeSchedule, planRuns, type BotScheduleRun } from "@db/bot-research.js";
import { autoLine, cap, changeLine, type Run } from "@/lib/desk-bot-words";
import type { SessionUser } from "./auth-helpers";
import { tellBotClock } from "./ask-bot";
import { pool, HttpError } from "./db";
import { logDesk } from "./desk";

// The bot on the desk (docs/PLAN-new-design.md step 6c part 2; the mock's community.js admSettings): each season's
// schedule, which is Autopilot's trial (the runs an admin switches on for a season are what Autopilot will be: Backstage
// says "Autopilot · On for this season" while one has a quick or full run), and what the desk's tie-break switch reaches.
// Classic's Admin › season › Setup edits the same columns (show_seasons.bot_research_*, 0065) until cutover.
//
// Survivor 51's schedule runs only the schedule check (the user's decision, 2026-10-24): nothing here changes a season
// unless an admin does it on its page.

export interface SeasonBot {
  on: boolean;
  /** When it was switched on: runs timed before it are never picked up. */
  since: string | null;
  /** How long its episodes run (the runs count from the end); null: an hour. */
  episodeMinutes: number | null;
  /** Its runs, each on or off (the schedule is kept while the bot is off). */
  schedule: BotScheduleRun[];
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

/** One season's bot: its schedule and its latest runs. */
export async function seasonBot(seasonId: string): Promise<SeasonBot> {
  const { rows } = await pool.query("SELECT bot_research_on, bot_research_since, bot_research_schedule, episode_minutes FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const s = rows[0];
  let schedule: BotScheduleRun[];
  try {
    schedule = normalizeSchedule(s.bot_research_schedule);
  } catch {
    schedule = normalizeSchedule(null);
  }
  const { rows: runs } = await pool.query(
    "SELECT episode_number, kind, slot, ok, message, started_at FROM bot_research_runs WHERE season_id = $1 ORDER BY started_at DESC LIMIT 6",
    [seasonId]
  );
  return {
    on: !!s.bot_research_on,
    since: s.bot_research_since ? s.bot_research_since.toISOString() : null,
    episodeMinutes: s.episode_minutes ?? null,
    schedule,
    recent: runs.map((r) => ({ episode: r.episode_number, kind: r.kind, slot: r.slot, ok: r.ok, message: r.message, at: r.started_at.toISOString() })),
  };
}

/** The seasons whose bot is on, and what each one checks: the desk's Settings (Autopilot's trial). */
export async function autopilotSeasons(): Promise<{ id: string; name: string; line: string }[]> {
  const { rows } = await pool.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.bot_research_schedule
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on ORDER BY s.name, ss.season_number`
  );
  return rows.map((r) => {
    let schedule: BotScheduleRun[] = [];
    try {
      schedule = normalizeSchedule(r.bot_research_schedule);
    } catch {
      schedule = [];
    }
    return { id: r.id, name: r.name, line: cap(autoLine(schedule as Run[])) };
  });
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

/** What setSeasonBot changes, and puts back on Undo. `episodeMinutes` null: an hour. */
interface BotBefore {
  on: boolean;
  schedule: BotScheduleRun[];
  episodeMinutes: number | null;
}

async function writeBot(seasonId: string, next: BotBefore, was: boolean): Promise<void> {
  // Switched on, the clock starts now, so runs timed before it are never picked up (as classic's Setup does); off, it's
  // cleared; left on, it stays.
  await pool.query(
    `UPDATE show_seasons SET bot_research_on = $2, bot_research_schedule = $3::jsonb, episode_minutes = $5,
            bot_research_since = CASE WHEN NOT $2 THEN NULL WHEN $4 THEN bot_research_since ELSE now() END
      WHERE id = $1`,
    [seasonId, next.on, JSON.stringify(next.schedule), was, next.episodeMinutes]
  );
}

const words = (b: BotBefore) => ({ on: b.on, runs: b.schedule as Run[], minutes: b.episodeMinutes ?? 60 });

/**
 * Changes one season's bot: `on` (Autopilot: its schedule runs or not), `schedule` (each run's kind, its minutes, and on or
 * off), `reset: true` (our usual five) and/or `episodeMinutes` (how long its episodes run: every run but trivia's and bingo's counts from the end; 5 to 600,
 * null an hour). A line in the season's History with Undo; the bot's clock is told. `changeId` null: nothing changed.
 */
export async function setSeasonBot(
  user: SessionUser,
  seasonId: string,
  body: { on?: unknown; schedule?: unknown; episodeMinutes?: unknown; reset?: unknown }
): Promise<{ bot: SeasonBot; changeId: string | null; text: string }> {
  const before = await seasonBot(seasonId);
  const was: BotBefore = { on: before.on, schedule: before.schedule, episodeMinutes: before.episodeMinutes };
  const next: BotBefore = { ...was };
  if (body.on !== undefined) {
    if (typeof body.on !== "boolean") throw new HttpError(400, "on is true or false");
    next.on = body.on;
  }
  if (body.schedule !== undefined) {
    try {
      next.schedule = normalizeSchedule(body.schedule);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Bad schedule");
    }
  }
  // Reset to our usual five (the page's Reset), said as that whatever it changes.
  if (body.reset === true) next.schedule = normalizeSchedule(null);
  if (body.episodeMinutes !== undefined) {
    const n = body.episodeMinutes === null ? null : Number(body.episodeMinutes);
    if (n !== null && (!Number.isInteger(n) || n < 5 || n > 600)) throw new HttpError(400, "An episode runs 5 minutes to 10 hours");
    next.episodeMinutes = n === 60 ? null : n;
  }
  if (next.on === was.on && JSON.stringify(next.schedule) === JSON.stringify(was.schedule) && (next.episodeMinutes ?? 60) === (was.episodeMinutes ?? 60))
    return { bot: before, changeId: null, text: "Nothing changed" };
  await writeBot(seasonId, next, before.on);
  const text = body.reset === true ? "Schedule reset to our usual five" : changeLine(words(was), words(next));
  const changeId = await logDesk(pool, {
    entity: "season",
    entityId: seasonId,
    action: "bot",
    text,
    before: was,
    after: next,
    // The length goes back only with a line that changed it: another line's Undo leaves a length set since.
    undo: { type: "bot", id: seasonId, on: was.on, schedule: was.schedule, ...(next.episodeMinutes !== was.episodeMinutes ? { episodeMinutes: was.episodeMinutes } : {}) },
    userId: user.id,
  });
  nudgeBotClock();
  return { bot: await seasonBot(seasonId), changeId, text };
}

/** History's Undo: the season's bot as it was (its episode length too, when the line kept it). */
export async function restoreSeasonBot(seasonId: string, was: { on: boolean; schedule: BotScheduleRun[]; episodeMinutes?: number | null }): Promise<void> {
  const now = await seasonBot(seasonId);
  await writeBot(seasonId, { on: !!was.on, schedule: normalizeSchedule(was.schedule), episodeMinutes: was.episodeMinutes === undefined ? now.episodeMinutes : was.episodeMinutes }, now.on);
  nudgeBotClock();
}
