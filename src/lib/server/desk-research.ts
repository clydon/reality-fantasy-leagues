import { after } from "next/server";
import { buildPasteImportPrompt, resolveSeasonResearchContext } from "@db/episode-research.js";
import { buildQuickPrompt, buildSchedulePrompt, dueAt, episodeAirTimes, episodeMinutesOf, loadSeasonForJob, runJob, RUNNING_STALE_MS, SEASON_BINGO_SLOT, triedAs } from "@db/bot-research.js";
import { castFor, buildTriviaPrompt } from "@db/trivia-research.js";
import { adminBingoBank } from "./bingo-bank";
import { KINDS, cap, dur, researchLine, sameRun, when, type Run, type RunKind } from "@/lib/desk-bot-words";
import { finalResultsAt } from "@/lib/game/final-results.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { askBot, askBotStatus } from "./ask-bot";
import { botSend } from "./bot-results";
import { pool, HttpError } from "./db";
import { SEASON_NAME, logDesk, type DeskLine } from "./desk";
import { seasonBot, usualReach } from "./desk-bot";
import { dayGap, fmt, mdIn, plural, timeIn, ymd } from "./desk-dates";
import { askCastNow } from "./desk-cast-page";
import { waitingEpisodes } from "./desk-episode";
import { deskSetup, type SeasonDelete } from "./desk-setup";

// A season's Research and the bot on the desk (docs/PLAN-desk-parity.md step 4, part 4a; the mock's desk-research.js): its
// lower third (Autopilot on or off, the next run or what it's asking now), Run now (five kinds, each saying what it does
// before it asks), its schedule drawn as the next episode's night (each run at the time db/bot-research.js dueAt gives it,
// the episode's length, Autopilot), its latest runs, History and the season's Delete. Schedule changes are desk-bot.ts's
// setSeasonBot (a History line with Undo).
//
// Run now is queued (desk_runs, 0424), not run inside the request as classic's is: the request answers at once, and the
// request driving the queue (drainDeskRuns, after its answer) waits while the bot is asking anything else (it answers one
// question at a time), then asks, then hands the next queued run to a request of its own (POST /api/desk/runs/next), so each
// run has a request's whole budget (300 s). A request that waited long gets a fresh one the same way. A driver cut off (a
// redeploy) lets go after 6 minutes; the page's read, which polls while anything's queued, takes over then.

const MIN = 60_000;
const DRIVE_STALE_MS = 6 * MIN;
const WAIT_MS = 240_000;
const POLL_MS = 4_000;
/** How long each kind usually takes (seconds), for "in about N minutes". */
const TYPICAL: Record<string, number> = { full: 200, tiebreak: 200, quick: 30, schedule: 40, trivia: 120, bingo: 220, cast: 90 };

type Progress = { stage?: string; done?: number; of?: number } | null;

/** One run in Runs: a bot_research_runs row (scheduled, One tap, a tie-break, asked, Run now), or a Run now still queued. */
export interface ResearchRun {
  id: string;
  kind: RunKind | "tiebreak";
  episode: number;
  /** The season's bingo bank, not the episode's. */
  forSeason: boolean;
  title: string;
  /** Who or what asked, and when: "Run now, by alex · Yesterday, 8:10 PM". */
  line: string;
  /** null: asking (or queued); true done; false failed. */
  ok: boolean | null;
  queued: boolean;
  /** What it found, why it failed, or how far it's got. */
  result: string;
  /** How far it's got, 0 to 1, while it asks. */
  share: number | null;
  seconds: number | null;
  /** How many tries a run like it gets. */
  tries: string;
  /** Run now's own row in the queue (its question is rebuilt from the run). */
  runId: string | null;
}

/** One row of the next episode's night. */
export interface RailRow {
  key: string;
  /** final: players' final results (12:00 noon the day after it airs, final-results.js), which the runs land before. */
  type: "start" | "end" | "run" | "final" | "now";
  /** The day, on a day's first row ("Tonight", "Fri", "Nov 4"). */
  day: string;
  hm: string;
  ap: string;
  title: string;
  line: string;
  /** The run's place in the rail's runs (the episode's own, or the season's). */
  i?: number;
  on?: boolean;
  /** The episode's own: a run the season's schedule hasn't, or has switched the other way ("Episode N only"). */
  mine?: boolean;
  /** How it went, for a run whose time has passed. */
  done?: { ok: boolean; line: string } | null;
}

/** An episode Run now can ask about. */
export interface NowEpisode {
  n: number;
  /** "The latest", "Oct 14", "Tomorrow". */
  label: string;
  /** Non-bot answers in so far ("riley's paste"), and when our bot last answered. */
  others: string[];
  botAt: string | null;
  /** Its bingo squares that are live (null: none of its own). */
  squares: number | null;
}

export interface DeskResearch {
  id: string;
  name: string;
  show: { id: string; name: string };
  on: boolean;
  since: string | null;
  minutes: number;
  /** Its runs: its own schedule, or our usual's while it follows it. */
  runs: Run[];
  /** It has no schedule of its own: it follows our usual (and changes with it). */
  follows: boolean;
  /** Our usual runs (Reset's, Not in its schedule's, Make this our usual's). */
  usual: Run[];
  /** Who our usual reaches (Make this our usual says): the seasons, Autopilot on, that follow it, and those with their own. */
  reach: { follow: string[]; own: string[] };
  /** The lower third's line. */
  next: string;
  meta: string;
  games: number;
  /** Around Episode N: its start, its end and each run; null with why. */
  rail: {
    n: number;
    airs: string;
    rows: RailRow[];
    /** The runs its rows are: the episode's own when it has them, else the season's. */
    runs: Run[];
    /** The episode has runs of its own; `gone`, the season's it has taken off. */
    own: boolean;
    gone: Run[];
    note: string | null;
    /** For a run's sheet, which works out a new timing's time: the episode's start and end, the next one's start, the zone. */
    airAt: string;
    endAt: string;
    nextAt: string | null;
    tz: string;
  } | null;
  railNote: string | null;
  log: ResearchRun[];
  logTotal: number;
  /** The bot is asking anything now (any season), and how long Run now would wait. */
  waits: string | null;
  now: { aired: NowEpisode[]; bingo: NowEpisode[]; seasonSquares: number | null; scheduleEpisode: number | null; timeByHand: string | null };
  /** Not in the games yet: the episodes with results one source wasn't sure of, or a name not in the cast (part 4b). */
  waiting: { n: number; count: number; line: string }[];
  history: DeskLine[];
  delete: SeasonDelete;
  /** Run now's line on the season page ("Autopilot on · 5 runs after each episode"). */
  line: string;
}

interface SeasonJob {
  id: string;
  show_id: string;
  slug: string;
  season_number: number;
  status: string;
  air_tz: string | null;
  schedule: unknown;
  wikiAirDates: Record<string, string>;
  bot_research_since: Date | null;
}

const job = async (id: string): Promise<SeasonJob> => {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const s = (await loadSeasonForJob(pool, id)) as SeasonJob | undefined;
  if (!s) throw new HttpError(404, "Season not found");
  return s;
};

// ---------- words ----------

/** "Tonight", "Today", "Tomorrow", "Yesterday", a weekday this week, else "Nov 4" (the mock's rsDay). */
function dayWord(t: Date, tz: string, now: Date, short = false): string {
  const k = dayGap(ymd(now, tz), ymd(t, tz));
  if (k === 0) return Number(fmt(t, tz, { hour: "numeric", hour12: false })) >= 17 ? "Tonight" : "Today";
  if (k === 1) return "Tomorrow";
  if (k === -1) return "Yesterday";
  if (k > 1 && k < 7) return fmt(t, tz, { weekday: "short" });
  return short ? fmt(t, tz, { month: "short", day: "numeric" }) : fmt(t, tz, { weekday: "short", month: "short", day: "numeric" });
}
const at = (t: Date, tz: string, now: Date) => `${dayWord(t, tz, now)}, ${timeIn(t, tz)}`;
const low = (t: string) => (/^(Tonight|Today|Tomorrow|Yesterday)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

const STAGE: Record<string, string> = { waiting: "Waiting its turn at the bot", opening: "Opening ChatGPT", sending: "Opening ChatGPT", asking: "Searching the recaps", writing: "Writing it up" };
const STAGE_SHARE: Record<string, number> = { waiting: 0.04, opening: 0.08, sending: 0.12, asking: 0.35, writing: 0.7 };

function progressOf(kind: string, p: Progress): { result: string; share: number | null } {
  if (p && p.of) return { result: `${p.done ?? 0} of ${p.of} people written up`, share: Math.min(1, (p.done ?? 0) / p.of) };
  const stage = p?.stage ?? "opening";
  const writing = kind === "bingo" ? "Writing 30 squares" : kind === "trivia" ? "Writing 6 questions" : STAGE[stage];
  return { result: stage === "writing" || (stage === "asking" && (kind === "bingo" || kind === "trivia")) ? writing : (STAGE[stage] ?? "Asking"), share: STAGE_SHARE[stage] ?? 0.1 };
}

const KIND_T = (k: string) => (k === "tiebreak" ? "Tie-break" : (KINDS[k as RunKind]?.t ?? cap(k)));
const KIND_SHORT = (k: string) => (k === "tiebreak" ? "a tie-break" : (KINDS[k as RunKind]?.short ?? k));
/** "Episode 5", "after Episode 5" (the schedule check and trivia ask after it), "the season's bank". */
const epName = (kind: string, ep: number, forSeason: boolean) => (forSeason ? "the season's bank" : kind === "schedule" || kind === "trivia" ? `after Episode ${ep}` : `Episode ${ep}`);

/** How many tries a run gets, by who asked (db/bot-research.js nextTryAt, results-ways.ts, askedNext). */
function triesOf(slot: string, kind: string): string {
  if (slot === "now") return "Run now asks once: Try again asks again.";
  if (slot === "tap") return "A One tap tries twice, two minutes apart.";
  if (slot === "asked") return "Asked for by someone filling in what happened: two tries, two minutes apart.";
  if (kind === "quick") return "On its schedule, who went home is asked every 5 minutes for half an hour, then every 15, for up to 3 hours.";
  return "A run on the schedule tries three times, 20 minutes apart.";
}

// ---------- what the bot is asking now ----------

interface Going {
  season_id: string;
  season: string;
  kind: string;
  episode_number: number;
  slot: string;
  started_at: Date;
}

/** The run the bot is asking now, any season (a row still running, under 10 minutes old; a cast ask is the queue's own row). */
async function going(): Promise<Going | null> {
  const { rows } = await pool.query<Going>(
    `SELECT * FROM (
       SELECT r.season_id, ${SEASON_NAME} AS season, r.kind, r.episode_number, r.slot, r.started_at
         FROM bot_research_runs r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id
        WHERE r.finished_at IS NULL AND r.ok IS NULL AND r.started_at > now() - make_interval(secs => $1)
       UNION ALL
       SELECT d.season_id, ${SEASON_NAME}, d.kind, d.episode_number, 'now', d.started_at
         FROM desk_runs d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
        WHERE d.kind = 'cast' AND d.done_at IS NULL AND d.started_at > now() - make_interval(secs => $1)
     ) g ORDER BY started_at LIMIT 1`,
    [RUNNING_STALE_MS / 1000]
  );
  return rows[0] ?? null;
}

/** "It starts after full results for Episode 5, in about a minute" when the bot's asking anything or Run nows are queued. */
async function waitLine(seasonId: string): Promise<string | null> {
  const [g, { rows: queued }] = await Promise.all([going(), pool.query("SELECT kind FROM desk_runs WHERE done_at IS NULL AND started_at IS NULL")]);
  if (!g && !queued.length) return null;
  let secs = queued.reduce((a, q) => a + (TYPICAL[q.kind] ?? 120), 0);
  let what: string;
  if (g) {
    secs += Math.max(20, (TYPICAL[g.kind] ?? 120) - (Date.now() - g.started_at.getTime()) / 1000);
    what =
      g.kind === "cast"
        ? `${g.season_id === seasonId ? "its" : `${g.season}${/s$/i.test(g.season) ? "'" : "'s"}`} cast`
        : `${KIND_SHORT(g.kind)} for ${g.season_id === seasonId ? "" : `${g.season} `}${epName(g.kind, g.episode_number, g.slot === SEASON_BINGO_SLOT)}`;
    if (queued.length) what += ` and ${plural(queued.length, "more run")} waiting`;
  } else what = plural(queued.length, "run") + " already waiting";
  const m = Math.ceil(secs / 60);
  return `One question at a time: it starts after ${what}, in about ${m <= 1 ? "a minute" : `${m} minutes`}.`;
}

// ---------- the page ----------

interface RunRow {
  id: string;
  episode_number: number;
  slot: string;
  kind: string;
  started_at: Date;
  ok: boolean | null;
  message: string | null;
  result: { forSeason?: boolean } | null;
  seconds: number | null;
  progress: Progress;
  couch: string | null;
  who: string | null;
  /** Still marked running past RUNNING_STALE_MS: cut off (a redeploy, the route's ceiling), never to finish. */
  stale?: boolean;
}

function runView(r: RunRow, tz: string, now: Date): ResearchRun {
  const forSeason = r.slot === SEASON_BINGO_SLOT || !!r.result?.forSeason;
  const by =
    r.slot === "tap"
      ? `One tap${r.couch ? ` for ${r.couch}` : ""}${r.who ? `, by ${r.who}` : ""}`
      : r.slot === "now"
        ? `Run now${r.who ? `, by ${r.who}` : ""}`
        : r.slot === "asked"
          ? "Fill in what happened"
          : r.slot === "tiebreak"
            ? "A tie-break"
            : "On its schedule";
  // A run cut off mid-ask stays marked running in the table: it reads as failed (nothing closes those rows).
  const ok = r.ok === null && r.stale ? false : r.ok;
  const p = ok === null ? progressOf(r.kind, r.progress) : null;
  return {
    id: r.id,
    kind: r.kind as ResearchRun["kind"],
    episode: r.episode_number,
    forSeason,
    title: `${KIND_T(r.kind)} · ${epName(r.kind, r.episode_number, forSeason)}`,
    line: `${by} · ${ok === null ? "now" : at(r.started_at, tz, now)}`,
    ok,
    queued: false,
    result: p ? p.result : r.ok === null ? "Cut off before it finished: ask again" : (r.message ?? (r.ok ? "Done" : "Failed")),
    share: p ? p.share : null,
    seconds: r.seconds,
    tries: triesOf(r.slot, r.kind),
    runId: r.id,
  };
}

async function runsOf(seasonId: string, tz: string, now: Date, limit: number): Promise<{ log: ResearchRun[]; total: number; wait: string | null }> {
  const [{ rows }, { rows: count }, { rows: queued }, wait] = await Promise.all([
    pool.query<RunRow>(
      `SELECT r.id, r.episode_number, r.slot, r.kind, r.started_at, r.ok, r.message, r.result, r.seconds, r.progress, c.name AS couch,
              r.ok IS NULL AND r.started_at < now() - make_interval(secs => $3) AS stale,
              COALESCE(u.username, u.name, q.who) AS who
         FROM bot_research_runs r LEFT JOIN couches c ON c.id = r.couch_id LEFT JOIN "user" u ON u.id = r.asked_by
         -- A Run now still asking: who asked is on its queued row until it ends.
         LEFT JOIN LATERAL (
           SELECT COALESCE(du.username, du.name) AS who FROM desk_runs d LEFT JOIN "user" du ON du.id = d.asked_by
            WHERE r.slot = 'now' AND r.asked_by IS NULL AND r.finished_at IS NULL AND d.season_id = r.season_id AND d.kind = r.kind
              AND d.episode_number = r.episode_number AND d.started_at IS NOT NULL AND d.done_at IS NULL
            LIMIT 1
         ) q ON true
        WHERE r.season_id = $1 ORDER BY r.started_at DESC LIMIT $2`,
      [seasonId, limit, RUNNING_STALE_MS / 1000]
    ),
    pool.query("SELECT count(*)::int AS n FROM bot_research_runs WHERE season_id = $1", [seasonId]),
    pool.query(
      `SELECT d.id, d.kind, d.episode_number, d.for_season, COALESCE(u.username, u.name) AS who
         FROM desk_runs d LEFT JOIN "user" u ON u.id = d.asked_by WHERE d.season_id = $1 AND d.done_at IS NULL AND d.started_at IS NULL AND d.kind <> 'cast' ORDER BY d.asked_at DESC`,
      [seasonId]
    ),
    waitLine(seasonId),
  ]);
  const waiting: ResearchRun[] = queued.map((q) => ({
    id: q.id,
    kind: q.kind,
    episode: q.episode_number,
    forSeason: q.for_season,
    title: `${KIND_T(q.kind)} · ${epName(q.kind, q.episode_number, q.for_season)}`,
    line: `Run now${q.who ? `, by ${q.who}` : ""} · waiting`,
    ok: null,
    queued: true,
    result: wait ? wait.replace("One question at a time: it starts", "Starts") : "Starts in a moment",
    share: 0.02,
    seconds: null,
    tries: triesOf("now", q.kind),
    runId: null,
  }));
  return { log: [...waiting, ...rows.map((r) => runView(r, tz, now))], total: count[0].n + waiting.length, wait };
}

/**
 * The next episode's night (the mock's rsCycle and rsRundown): the episode whose runs are still to come, else the next. Its
 * runs are its own when it has them (`episodes`), each one the season's hasn't marked as its own.
 */
function railOf(season: SeasonJob, schedule: Run[], episodes: Record<number, Run[]>, minutes: number, history: RunRow[], now: Date, tz: string, count: number | null): DeskResearch["rail"] {
  const times = episodeAirTimes(season).filter((e) => !count || e.episode <= count);
  const t = now.getTime();
  const runsOf = (e: { episode: number }) => episodes[e.episode] ?? schedule;
  const endOf = (e: { at: Date; minutes?: number }) => e.at.getTime() + (e.minutes ?? minutes) * MIN;
  const dues = (e: { episode: number; at: Date; minutes?: number }) => {
    const next = times.find((x) => x.episode === e.episode + 1);
    return runsOf(e).map((r) => dueAt(r, endOf(e), next ? next.at : null, e.at.getTime()));
  };
  const aired = times.filter((e) => e.at.getTime() <= t);
  const last = aired[aired.length - 1];
  let ep = last && runsOf(last).some((r, i) => r.on && (dues(last)[i]?.getTime() ?? 0) > t) ? last : times.find((e) => e.at.getTime() > t);
  if (!ep && last && endOf(last) > t) ep = last;
  if (!ep) return null;
  const runs = runsOf(ep);
  const own = !!episodes[ep.episode];
  const end = new Date(endOf(ep));
  const d = dues(ep);
  type Item = { t: Date; row: Omit<RailRow, "day" | "hm" | "ap"> };
  const items: Item[] = [
    { t: ep.at, row: { key: "start", type: "start", title: `Episode ${ep.episode} starts`, line: ep.episode === 1 ? "The premiere" : count === ep.episode ? "The finale" : fmt(ep.at, tz, { weekday: "long", month: "long", day: "numeric" }) } },
    { t: end, row: { key: "end", type: "end", title: "It ends", line: `Episodes run ${dur(ep.minutes ?? minutes)}${ep.minutes && ep.minutes !== minutes ? " (this one, by its research)" : ""}` } },
  ];
  // Players' final results: the push and "Final results are in" (the user, 2026-10-29). The runs before it land in them.
  const final = finalResultsAt(ep.at, tz);
  if (final)
    items.push({ t: final, row: { key: "final", type: "final", title: "Final results for players", line: "Their push, and “Final results are in”: what's in by now" } });
  const seen = new Set<string>();
  runs.forEach((r, i) => {
    const due = d[i];
    if (!due) return;
    const again = seen.has(r.kind);
    seen.add(r.kind);
    const title = r.kind === "trivia" ? `Trivia about Episode ${ep.episode}` : r.kind === "bingo" ? `Bingo squares for Episode ${ep.episode}` : again ? `${KINDS[r.kind].t}, again` : KINDS[r.kind].t;
    // Its tries: the planner's (db/bot-research.js triedAs: its slot's, and the slots it moved from).
    const slots = triedAs(r, runs);
    const tried = due.getTime() <= t ? history.find((h) => h.episode_number === ep.episode && slots.includes(h.slot) && h.ok !== null) : null;
    const mine = own && !schedule.some((x) => sameRun(x, r) && x.on === r.on);
    const line = `${cap(when(r))}${r.kind === "schedule" ? `: when Episode ${ep.episode + 1} airs` : ""}${r.kind === "full" && again ? " · merged into the first" : ""}${r.on ? "" : " · off"}`;
    items.push({ t: due, row: { key: `${r.kind}@${r.after}`, type: "run", title, line, i, on: r.on, mine, done: tried ? { ok: !!tried.ok, line: tried.ok ? (tried.message ?? "Done") : "Failed" } : null } });
  });
  // Starts before ends before runs before players' final results at the same minute; Now goes before the first thing still
  // to come.
  const order = { start: 0, end: 1, run: 2, final: 3, now: 4 };
  items.sort((a, b) => a.t.getTime() - b.t.getTime() || order[a.row.type] - order[b.row.type]);
  const nowAt = items.findIndex((x) => x.t.getTime() > t);
  items.splice(nowAt < 0 ? items.length : nowAt, 0, { t: now, row: { key: "now", type: "now", title: "Now", line: "" } });
  let day = "";
  const rows = items.map(({ t: when, row }) => {
    const w = dayWord(when, tz, now, true);
    const hmAp = timeIn(when, tz);
    const [hm, ap] = hmAp.split(" ");
    const out = { ...row, day: w !== day ? w : "", hm, ap: ap ?? "" };
    if (row.type !== "now") day = w;
    return out;
  });
  const following = times.find((x) => x.episode === ep.episode + 1);
  return {
    n: ep.episode,
    airs: at(ep.at, tz, now),
    rows,
    runs,
    own,
    // The season's runs it hasn't (not one it moved: that one's marked where it is now).
    gone: own ? schedule.filter((x) => !runs.some((r) => sameRun(r, x) || (r.was ?? []).includes(`${x.kind}@${x.after}`))) : [],
    airAt: ep.at.toISOString(),
    endAt: end.toISOString(),
    nextAt: following ? following.at.toISOString() : null,
    tz,
    note: season.status === "upcoming" ? "It's Upcoming: nothing runs on its own until it's Airing (Setup's Status). Run now still works." : null };
}


/** A season's Research and the bot. */
export async function deskResearch(id: string, origin: string | null = null, now = new Date()): Promise<DeskResearch> {
  const season = await job(id);
  const tz = season.air_tz || "America/New_York";
  const [bot, setup, history, { rows: hist }, { rows: week }, { rows: answers }, { rows: banks }, { rows: head }, { log, total, wait }, waiting, reach] = await Promise.all([
    seasonBot(id),
    deskSetup(id, now),
    pool.query(
      `SELECT c.id, c.text, c.created_at, c.undo IS NOT NULL AND c.undone_at IS NULL AS undoable, c.undone_at IS NOT NULL AS undone, COALESCE(u.username, u.name) AS who
         FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
        WHERE c.entity = 'season' AND c.entity_id = $1 AND c.action IN ('bot', 'run') ORDER BY c.created_at DESC LIMIT 40`,
      [id]
    ),
    pool.query<RunRow>("SELECT id, episode_number, slot, kind, started_at, ok, message, NULL AS result, seconds, NULL AS progress, NULL AS couch, NULL AS who FROM bot_research_runs WHERE season_id = $1 ORDER BY started_at DESC LIMIT 200", [id]),
    pool.query("SELECT count(*)::int AS n FROM bot_research_runs WHERE season_id = $1 AND started_at > now() - interval '7 days'", [id]),
    pool.query(
      `SELECT er.episode_number, er.source, er.researched_at, COALESCE(u.username, u.name) AS who, c.name AS couch
         FROM episode_research er LEFT JOIN "user" u ON u.id = er.submitted_by LEFT JOIN couches c ON c.id = er.couch_id
        WHERE er.show_id = $1 AND er.season_number = $2 AND er.source <> 'combined' AND er.withdrawn_at IS NULL ORDER BY er.researched_at`,
      [season.show_id, season.season_number]
    ),
    pool.query("SELECT episode, count(*) FILTER (WHERE status = 'live')::int AS live FROM bingo_squares WHERE season_id = $1 GROUP BY episode", [id]),
    pool.query("SELECT driven_at FROM desk_runs WHERE done_at IS NULL ORDER BY asked_at, id LIMIT 1"),
    runsOf(id, tz, now, 30),
    waitingEpisodes(id),
    usualReach(id),
  ]);
  // A queue nobody's driving (its driver was cut off): this read takes over, after its answer.
  if (origin && head[0] && (!head[0].driven_at || now.getTime() - head[0].driven_at.getTime() > DRIVE_STALE_MS)) after(() => drainDeskRuns(origin));
  const minutes = bot.episodeMinutes ?? episodeMinutesOf(season);
  const runs = bot.schedule as Run[];
  const count = setup.count;
  const rail = setup.scheduled && setup.status !== "completed" ? railOf(season, runs, bot.episodes as Record<number, Run[]>, minutes, hist, now, tz, count) : null;
  const railNote = rail ? null : !setup.scheduled ? "No schedule yet, so nothing runs: Setup gives it one." : "No episode coming up, so nothing runs on its own. Run now still works.";
  const asking = log.find((l) => l.ok === null && !l.queued);
  const nextRun =
    rail && bot.on && season.status === "airing"
      ? rail.rows.find((r, k) => r.type === "run" && r.on && k > rail.rows.findIndex((x) => x.type === "now"))
      : null;
  const nextAt = nextRun ? `${low(nextRun.day || rail!.rows.slice(0, rail!.rows.indexOf(nextRun)).reverse().find((x) => x.day && x.type !== "now")?.day || "")}, ${nextRun.hm} ${nextRun.ap}` : null;
  const times = episodeAirTimes(season).filter((e) => !count || e.episode <= count);
  const airedN = times.filter((e) => e.at.getTime() <= now.getTime()).map((e) => e.episode);
  const squares = (e: number | null) => banks.find((b) => (b.episode ?? null) === e)?.live ?? null;
  const epInfo = (n: number, label: string): NowEpisode => {
    const mine = answers.filter((a) => a.episode_number === n);
    const others = mine
      .filter((a) => a.source === "paste" || a.source === "quick" || a.source === "hand")
      .map((a) => `${a.who ?? a.couch ?? "someone"}'s ${a.source === "quick" ? "quick check" : a.source === "hand" ? "answer" : "paste"}`);
    const botA = mine.filter((a) => a.source === "autopilot" || a.source === "bot").pop();
    return { n, label, others: [...new Set(others)], botAt: botA ? at(botA.researched_at, tz, now) : null, squares: squares(n) };
  };
  const latest = airedN.slice(-6).reverse();
  const nextN = times.find((e) => e.at.getTime() > now.getTime());
  const bingo = times.filter((e) => e.at.getTime() > now.getTime()).slice(0, 2).map((e) => epInfo(e.episode, dayWord(e.at, tz, now, true)));
  return {
    id,
    name: setup.name,
    show: setup.show,
    on: bot.on,
    since: bot.since ? mdIn(new Date(bot.since), tz, now) : null,
    minutes,
    runs,
    follows: bot.follows,
    usual: bot.usual as Run[],
    reach,
    next: asking ? `Asking now: ${asking.title.split(" · ")[1]}` : nextAt ? `Next: ${nextAt}` : bot.on ? "Nothing due" : "Nothing runs on its own",
    meta: `Asks ChatGPT · ${week[0].n ? `${plural(week[0].n, "run")} this week` : "nothing run this week"}`,
    games: setup.delete.games.length,
    rail,
    railNote,
    log,
    logTotal: total,
    waits: wait,
    now: {
      aired: latest.map((n, k) => epInfo(n, k === 0 ? "The latest" : mdIn(times.find((e) => e.episode === n)!.at, tz, now))),
      bingo,
      seasonSquares: squares(null),
      scheduleEpisode: airedN.length ? airedN[airedN.length - 1] : null,
      timeByHand: setup.timesHeld && nextN ? timeIn(nextN.at, tz) : null,
    },
    waiting,
    history: history.rows.map((r) => ({ id: r.id, text: r.text, at: r.created_at.toISOString(), who: r.who, undoable: r.undoable, undone: r.undone })),
    delete: setup.delete,
    line: researchLine({ on: bot.on, schedule: runs }),
  };
}

/** Every run of the season (Runs' All N), newest first. */
export async function allRuns(id: string, now = new Date()): Promise<ResearchRun[]> {
  const season = await job(id);
  return (await runsOf(id, season.air_tz || "America/New_York", now, 100)).log;
}

// ---------- Run now: queued ----------

/** A dev server's stand-in bot, kept on its queued row: next dev only, loopback only (ask-bot.ts botFor's rule). */
function storedBot(url: string | null): string | undefined {
  if (!url || process.env.NODE_ENV !== "development") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost") ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Run now (tier 2, said before it's asked): queued, then asked once the bot's free. `kind` and `episode` (an aired one; bingo's
 * an episode still to come, or with `scope: 'season'` the season's own bank; the schedule check, the latest aired). The same
 * run already queued or asking is joined. Answers the queued run, and what it waits behind.
 */
export async function runNow(
  user: SessionUser,
  id: string,
  body: { kind?: unknown; episode?: unknown; scope?: unknown },
  o: { bot?: string; origin: string; now?: Date }
): Promise<{ text: string; waits: string | null }> {
  const now = o.now ?? new Date();
  const season = await job(id);
  const kind = body.kind;
  if (kind !== "quick" && kind !== "full" && kind !== "schedule" && kind !== "trivia" && kind !== "bingo") throw new HttpError(400, "kind must be quick, full, schedule, trivia or bingo");
  if (body.scope !== undefined && (kind !== "bingo" || (body.scope !== "episode" && body.scope !== "season"))) throw new HttpError(400, "scope is bingo's: episode or season");
  const forSeason = body.scope === "season";
  const times = episodeAirTimes(season);
  const aired = times.filter((e) => e.at.getTime() <= now.getTime());
  let episode = Number(body.episode);
  if (kind === "schedule") {
    if (!aired.length) throw new HttpError(400, "Nothing has aired yet: the schedule check asks after an episode");
    episode = aired[aired.length - 1].episode;
  } else if (kind === "bingo" && forSeason) {
    episode = Number.isInteger(episode) && episode > 0 ? episode : (times.find((e) => e.at.getTime() > now.getTime())?.episode ?? (aired.length ? aired[aired.length - 1].episode + 1 : 1));
  } else {
    if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "Which episode?");
    const ep = times.find((e) => e.episode === episode);
    if (kind === "bingo") {
      if (ep && ep.at.getTime() <= now.getTime()) throw new HttpError(400, `Episode ${episode} has aired: bingo squares are for an episode still to come`);
    } else if (!ep || ep.at.getTime() > now.getTime()) throw new HttpError(400, `Episode ${episode} hasn't aired yet`);
  }
  if (!(await askBotStatus({ bot: o.bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Try again in a while.");
  const what = `${KINDS[kind].short}, ${epName(kind, episode, forSeason)}`;
  const { rows: dup } = await pool.query(
    "SELECT 1 FROM desk_runs WHERE season_id = $1 AND kind = $2 AND episode_number = $3 AND for_season = $4 AND done_at IS NULL",
    [id, kind, episode, forSeason]
  );
  if (dup.length) return { text: `Already asking: ${what}`, waits: await waitLine(id) };
  const waits = await waitLine(id);
  // Two asks at once: the queue's index (one open run per season, kind and episode) lets one in.
  const { rowCount } = await pool.query(
    `INSERT INTO desk_runs (season_id, episode_number, kind, for_season, asked_by, bot) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (season_id, kind, episode_number, for_season) WHERE done_at IS NULL DO NOTHING`,
    [id, episode, kind, forSeason, user.id, o.bot ?? null]
  );
  if (!rowCount) return { text: `Already asking: ${what}`, waits };
  await logDesk(pool, { entity: "season", entityId: id, action: "run", text: `${KINDS[kind].t}, ${epName(kind, episode, forSeason)}: Run now`, userId: user.id });
  after(() => drainDeskRuns(o.origin));
  return { text: waits ? `Queued: ${what}` : `Asking ChatGPT: ${what}`, waits };
}

/**
 * Ask our bot for a season's cast (the Cast page, part 5a): queued like Run now, behind whatever's asking (one question at a
 * time), as episode 0; its answer is staged for the page's review (desk-cast-page.ts askCastNow). The same ask already queued
 * is joined. Answers what it waits behind.
 */
export async function queueCast(user: SessionUser, id: string, o: { bot?: string; origin: string }): Promise<{ text: string; waits: string | null }> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows: season } = await pool.query(`SELECT ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`, [id]);
  if (!season.length) throw new HttpError(404, "Season not found");
  if (!(await askBotStatus({ bot: o.bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Try again in a while, or paste it.");
  const name: string = season[0].name;
  const what = `${name}${/s$/i.test(name) ? "'" : "'s"} cast`;
  // An ask the page stopped waiting on (its driver cut off long ago): failed, so this one goes in.
  await pool.query(
    "UPDATE desk_runs SET done_at = now(), ok = false, message = 'Cut off before it finished: ask again' WHERE season_id = $1 AND kind = 'cast' AND done_at IS NULL AND asked_at < now() - interval '15 minutes'",
    [id]
  );
  const waits = await waitLine(id);
  const { rowCount } = await pool.query(
    `INSERT INTO desk_runs (season_id, episode_number, kind, asked_by, bot) VALUES ($1, 0, 'cast', $2, $3)
     ON CONFLICT (season_id, kind, episode_number, for_season) WHERE done_at IS NULL DO NOTHING`,
    [id, user.id, o.bot ?? null]
  );
  if (!rowCount) return { text: `Already asking for ${what}`, waits };
  await logDesk(pool, { entity: "season", entityId: id, action: "cast", text: "Asked our bot for the cast", userId: user.id });
  after(() => drainDeskRuns(o.origin));
  return { text: waits ? `Queued: ${what}` : `Asking ChatGPT for ${what} · about a minute`, waits };
}

/** A queue nobody's driving (its driver was cut off): a page's read takes it over, after its answer (as Research's read does). */
export async function takeOverQueue(origin: string, now = new Date()): Promise<void> {
  const { rows } = await pool.query("SELECT driven_at FROM desk_runs WHERE done_at IS NULL ORDER BY asked_at, id LIMIT 1");
  if (rows[0] && (!rows[0].driven_at || now.getTime() - rows[0].driven_at.getTime() > DRIVE_STALE_MS)) after(() => drainDeskRuns(origin));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = async () => !!(await going());

/** Hands the queue to a request of its own (a fresh budget); with no cron secret (a dev server without one), drives it here. */
async function handOn(origin: string): Promise<void> {
  const { rows } = await pool.query("SELECT 1 FROM desk_runs WHERE done_at IS NULL LIMIT 1");
  if (!rows.length) return;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return drainDeskRuns(origin);
    console.error("[desk-runs] CRON_SECRET isn't set: the queue waits for the desk's next read");
    return;
  }
  try {
    await fetch(`${origin}/api/desk/runs/next`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch (e) {
    console.error("[desk-runs] couldn't hand the queue on:", e);
  }
}

/**
 * Drives the queue (after a request's answer): takes charge of its first run (unless another request has it), waits while the
 * bot is asking anything, asks, files it like a scheduled run's answer (a source: bot-results.ts), and hands on.
 */
export async function drainDeskRuns(origin: string): Promise<void> {
  const { rows } = await pool.query(
    `UPDATE desk_runs SET driven_at = now()
      WHERE id = (SELECT id FROM desk_runs WHERE done_at IS NULL ORDER BY asked_at, id LIMIT 1)
        AND (driven_at IS NULL OR driven_at < now() - make_interval(secs => $1))
      RETURNING *`,
    [DRIVE_STALE_MS / 1000]
  );
  const head = rows[0];
  if (!head) return;
  const done = (ok: boolean, message: string, runId: string | null = null) =>
    pool.query("UPDATE desk_runs SET done_at = now(), ok = $2, message = $3, run_id = $4 WHERE id = $1", [head.id, ok, message.slice(0, 1000), runId]);
  try {
    if (head.started_at) {
      // Its request was cut off (a redeploy) while it asked: a failed try.
      await done(false, "Cut off before it finished: ask again");
      return handOn(origin);
    }
    const from = Date.now();
    while (await busy()) {
      if (Date.now() - from > WAIT_MS) {
        await pool.query("UPDATE desk_runs SET driven_at = NULL WHERE id = $1", [head.id]);
        return handOn(origin);
      }
      await sleep(POLL_MS);
      await pool.query("UPDATE desk_runs SET driven_at = now() WHERE id = $1", [head.id]);
    }
    // Waited a while: a fresh request asks, with the whole of its budget.
    if (Date.now() - from > 15_000) {
      await pool.query("UPDATE desk_runs SET driven_at = NULL WHERE id = $1", [head.id]);
      return handOn(origin);
    }
    await pool.query("UPDATE desk_runs SET started_at = now(), driven_at = now() WHERE id = $1", [head.id]);
    const season = await loadSeasonForJob(pool, head.season_id);
    if (!season) {
      await done(false, "The season's gone");
      return handOn(origin);
    }
    const bot = storedBot(head.bot);
    // The cast (part 5a): our bot's answer is staged for the Cast page's review, not filed as a run's result.
    if (head.kind === "cast") {
      const c = await askCastNow(head.season_id, head.asked_by, bot, 280_000);
      await done(c.ok, c.message);
      return handOn(origin);
    }
    const out = await runJob(
      pool,
      { season, episode: head.episode_number, kind: head.kind, slot: "now", ...(head.for_season ? { forSeason: true } : {}) } as Parameters<typeof runJob>[1],
      { ask: (prompt, opts) => askBot(prompt, { ...opts, bot }), send: botSend }
    );
    if (out.runId) await pool.query("UPDATE bot_research_runs SET asked_by = $2 WHERE id = $1", [out.runId, head.asked_by]);
    await done(out.ok, out.message, out.runId);
  } catch (e) {
    await done(false, e instanceof Error ? e.message : String(e)).catch(() => undefined);
  }
  return handOn(origin);
}

// ---------- a run's question ----------

/** The question a run asks, rebuilt as it would be asked now (what's in may have moved on since). */
export async function runQuestion(id: string, runId: string): Promise<{ question: string }> {
  const season = await job(id);
  if (!isUuid(runId)) throw new HttpError(404, "That run isn't here");
  const { rows } = await pool.query("SELECT kind, episode_number, slot, result FROM bot_research_runs WHERE id = $1 AND season_id = $2", [runId, id]);
  const r = rows[0];
  if (!r) throw new HttpError(404, "That run isn't here");
  const n: number = r.episode_number;
  const tz = season.air_tz || "America/New_York";
  const airedAt = episodeAirTimes(season).find((e) => e.episode === n)?.at ?? null;
  try {
    if (r.kind === "full" || r.kind === "tiebreak") {
      const { prompt } = await buildPasteImportPrompt(pool, season.slug, season.season_number, n, { structured: true });
      if (!prompt) throw new HttpError(409, "Nothing left to ask about it");
      return { question: prompt };
    }
    if (r.kind === "quick") return { question: buildQuickPrompt(await resolveSeasonResearchContext(pool, season.slug, season.season_number, n), airedAt, tz) };
    if (r.kind === "schedule") {
      const { rows: show } = await pool.query("SELECT name FROM shows WHERE id = $1", [season.show_id]);
      return { question: buildSchedulePrompt(show[0]?.name ?? season.slug, season.season_number, n, airedAt, tz) };
    }
    if (r.kind === "trivia") return { question: buildTriviaPrompt({ ...(await castFor(pool, id, n)), episode: n }) };
    if (r.kind === "bingo") {
      const forSeason = r.slot === SEASON_BINGO_SLOT || !!r.result?.forSeason;
      return { question: (await adminBingoBank(id, n, forSeason ? "season" : "episode", new Date())).prompt };
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(409, e instanceof Error ? e.message : "Couldn't build its question");
  }
  throw new HttpError(409, "That run has no question to copy");
}

