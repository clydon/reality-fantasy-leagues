// Dev-only check for a season's Research and the bot on the desk (docs/PLAN-desk-parity.md step 4, part 4a; the research
// pattern of 2026-10-29), against this lane's dev server, on a fixture of its own (zt_dr_ people; the ZT DR Show with Season 1
// airing weekly at 8:05 PM Eastern from two weeks ago, its Autopilot on, following our usual; Season 2 airing from a week
// ago, its Autopilot off; Season 3 with no schedule; Season 4 airing, Autopilot on, following our usual) and the ask-AI bot's
// stand-in (fake-bot.js, through the dev-only x-gys-bot header: neither ChatGPT nor production's VM is ever asked):
//   1. Only site admins: zt_dr_jo (a player) is refused the page, a change, Run now, Runs and a run's question.
//   2. The page's read: Autopilot on and the next run in the lower third, the meta line, the rail around the episode whose
//      runs are still to come (its start, its end, Now, each run at db/bot-research.js dueAt's time), Season 3's "no schedule"
//      and Season 2's Autopilot off; the season page's Running it › Research and the bot line.
//   3. The schedule (tier 1, each a History line with Undo): a run switched off, retimed, a duplicate refused, added, taken
//      off, reset to our usual five (following it again); the episode's length; Autopilot off and on; Undo putting the length
//      back too; Settings › Autopilot's line and link. The research pattern: a change for Episode N only (its own runs, marked
//      on the rail, read by the bot's planner, back to the season's on its own or by Back, each with Undo); a change for every
//      episode reaching the episode's own runs; Make this our usual (who it reaches, a moved run remembering its old slot,
//      Season 4 changing with it, Undo); a usual kind a season's own schedule hasn't, in the Inbox with its Add.
//   4. Run now, queued: a refused kind, an episode that hasn't aired, the bot down; the schedule check asked (the run's row,
//      Run now by zt_dr_desk, progress while it asks, done with its answer, a History line); the same again joined; a second
//      season's run waiting behind it ("Queued", what it waits behind) and asked only after it; a failed run; a run's question.
//   5. Screens at --width: the season page's row, the page (lower third, Run now, the rail, Not in its schedule, Runs,
//      History, Delete last), Run now's sheet (which episode, what it does, Ask it now), a run asking with its bar, a run's
//      sheet (Try again opening Run now), a run's timing sheet (every episode or Episode N only; the stepper on the clock's
//      hours past the first, to 12 PM beside players' final results; Save, the toast's Undo), an episode's own runs on the rail
//      and Back to the season's schedule, Not in its schedule saying what a missing kind costs, Reset, Add a run, Make this our
//      usual, the Inbox's Add, the episode's length. Nothing wider than the screen; no page errors.
//   6. Nothing real moved: no real season's bot settings or runs, and our usual (app_settings 'bot_usual') as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local;
//                                                              its .env.local needs CRON_SECRET, which hands the queue on)
//   node scripts/dev-test/check-desk-research.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-research.js --down       (takes the fixture down, nothing else)
//
// up/down: zt_dr_ accounts (their sessions), the ZT DR Show and its seasons (their runs, queued runs, episodes and episodes'
// own runs cascade), and the admin_changes lines its desk admin makes; our usual is kept aside under app_settings
// 'zt_dr_bot_usual_was' and put back by down (Make this our usual changes it); --keep leaves the fixture up. Refuses a
// non-local database, and stops if a bot run is asking anywhere on it (the queue waits for any run). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fakeBot = require("./fake-bot");
const { settle } = require("./motion");
const Bot = require("../../db/bot-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-research runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-research.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dr_${k}`;
const SHOW = "zt-dr-show";
const NAME = "ZT DR Show";
// Our usual (db/bot-research.js DEFAULT_SCHEDULE, since 2026-10-29: who went home at its end, full again before noon's final results).
const USUAL = [
  { kind: "quick", after: 0, on: true },
  { kind: "full", after: 60, on: true },
  { kind: "full", after: 720, on: true },
  { kind: "trivia", after: 1440, on: true },
  { kind: "bingo", after: 1440, on: true },
];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fixture ----------

// Our usual as it was before the check ({ v: value or null }): Make this our usual changes it, and down puts it back.
const USUAL_WAS = "zt_dr_bot_usual_was";

async function down(pool) {
  const { rows: was } = await pool.query("SELECT value FROM app_settings WHERE key = $1", [USUAL_WAS]);
  if (was.length) {
    if (was[0].value.v == null) await pool.query("DELETE FROM app_settings WHERE key = 'bot_usual'");
    else await pool.query("INSERT INTO app_settings (key, value) VALUES ('bot_usual', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(was[0].value.v)]);
    await pool.query("DELETE FROM app_settings WHERE key = $1", [USUAL_WAS]);
  }
  await pool.query(`DELETE FROM admin_changes WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dr\\_%')`);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dr\\_%'`);
}

async function up(pool) {
  await down(pool);
  await pool.query("INSERT INTO app_settings (key, value) VALUES ($1, jsonb_build_object('v', (SELECT value FROM app_settings WHERE key = 'bot_usual')))", [USUAL_WAS]);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-dr-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-dr.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  await add("jo");
  const { rows: sh } = await pool.query("INSERT INTO shows (slug, name, kind, created_by, set_up_at) VALUES ($1, $2, 'competition', $3, now()) RETURNING id", [SHOW, NAME, ids.desk]);
  ids.show = sh[0].id;
  const season = async (n, cols, vals, params = []) => {
    const { rows } = await pool.query(`INSERT INTO show_seasons (show_id, season_number, ${cols}) VALUES ($1, ${n}, ${vals}) RETURNING id`, [ids.show, ...params]);
    return rows[0].id;
  };
  // Season 1 follows our usual (no schedule of its own), as a season does until its runs change.
  ids.s1 = await season(
    1,
    "status, premiere_date, air_time, air_tz, release, episode_count, bot_research_on, bot_research_since",
    "'airing', current_date - 14, '20:05', 'America/New_York', 'weekly', 6, true, now() - interval '30 days'"
  );
  ids.s2 = await season(2, "status, premiere_date, air_time, air_tz, release, episode_count", "'airing', current_date - 7, '21:00', 'America/New_York', 'weekly', 8");
  ids.s3 = await season(3, "status", "'airing'");
  ids.s4 = await season(4, "status, premiere_date, air_time, air_tz, release, episode_count, bot_research_on, bot_research_since", "'airing', current_date - 7, '21:00', 'America/New_York', 'weekly', 8, true, now() - interval '30 days'");
  return ids;
}

const REAL_BOTS = `SELECT md5(string_agg(ss.id || ss.bot_research_on::text || coalesce(ss.bot_research_schedule::text, '') || coalesce(ss.episode_minutes::text, ''), ',' ORDER BY ss.id)) AS h,
    (SELECT count(*) FROM bot_research_runs r JOIN show_seasons x ON x.id = r.season_id JOIN shows y ON y.id = x.show_id WHERE y.slug NOT LIKE 'zt-%') AS runs,
    (SELECT md5(coalesce(string_agg(e.season_id || e.episode_number::text || e.schedule::text, ','), '')) FROM bot_research_episodes e JOIN show_seasons x ON x.id = e.season_id JOIN shows y ON y.id = x.show_id WHERE y.slug NOT LIKE 'zt-%') AS episodes,
    (SELECT value::text FROM app_settings WHERE key = 'bot_usual') AS usual
  FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dr_ fixture down");
    return;
  }
  const { rows: asking } = await pool.query("SELECT 1 FROM bot_research_runs WHERE finished_at IS NULL AND ok IS NULL AND started_at > now() - interval '10 minutes'");
  if (asking.length) throw new Error("a bot run is asking on this database: Run now's queue would wait behind it");
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_BOTS)).rows[0];
  const usualBefore = (await pool.query("SELECT value FROM app_settings WHERE key = 'bot_usual'")).rows[0]?.value ?? null;
  const closers = [];
  try {
    const ids = await up(pool);
    // The bot's stand-in: the schedule check finds Episode N+1 runs 90 minutes; `scheduleFound` false says it couldn't.
    let scheduleFound = true;
    const bot = await fakeBot.start({
      delayMs: 2500,
      answer: (prompt, kind) => {
        if (kind !== "schedule") throw new Error(`only the schedule check is asked here, not ${kind}`);
        return scheduleFound ? '```json\n{"found": true, "airsAt": null, "minutes": 90, "note": null, "sources": ["https://example.com/zt"]}\n```' : '```json\n{"found": false}\n```';
      },
    });
    closers.push(bot.close);
    const headers = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD, headers }), jo: await api({ user: U("jo"), pass: PASSWORD, headers }) };
    const page = async (id) => (await as.desk.call("GET", `/api/desk/seasons/${id}/research`)).body;
    const change = (id, body) => as.desk.call("POST", `/api/desk/seasons/${id}/research`, body);
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const sched = async (id) => (await pool.query("SELECT bot_research_on AS on, bot_research_schedule AS runs, episode_minutes AS m FROM show_seasons WHERE id = $1", [id])).rows[0];
    /** Waits until no Run now is queued or asking. */
    const drained = async (ms = 60000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const { rows } = await pool.query("SELECT 1 FROM desk_runs d JOIN show_seasons ss ON ss.id = d.season_id WHERE ss.show_id = $1 AND d.done_at IS NULL", [ids.show]);
        if (!rows.length) return true;
        await sleep(500);
      }
      return false;
    };

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", `/api/desk/seasons/${ids.s1}/research`),
      as.jo.call("POST", `/api/desk/seasons/${ids.s1}/research`, { on: false }),
      as.jo.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "schedule" }),
      as.jo.call("GET", `/api/desk/seasons/${ids.s1}/runs`),
      as.jo.call("GET", `/api/desk/seasons/${ids.s1}/runs/${crypto.randomUUID()}`),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the page, a change, Run now, Runs and a run's question", refused.map((r) => r.status).join(","));
    check((await as.desk.call("GET", "/api/desk/seasons/not-a-season/research")).status === 404, "a mistyped season: 404");
    check((await as.desk.call("POST", "/api/desk/runs/next", {})).status === 401, "the queue's hand-on needs the cron secret");

    // ---- 2. the page's read ----
    let r1 = await page(ids.s1);
    check(r1.on && r1.name === `${NAME} 1` && r1.minutes === 60 && r1.runs.length === 5 && r1.follows && JSON.stringify(r1.usual) === JSON.stringify(usualBefore ?? USUAL), "Season 1: Autopilot on, an hour, following our usual", JSON.stringify({ on: r1.on, name: r1.name, minutes: r1.minutes, follows: r1.follows }));
    check(/^Next: (tonight|today|tomorrow|\w{3}), \d{1,2}:\d{2} [AP]M$/.test(r1.next), "its lower third: the next run's time", r1.next);
    check(r1.meta === "Asks ChatGPT · nothing run this week", "the meta line", r1.meta);
    const rail = r1.rail;
    check(!!rail && rail.rows.filter((x) => x.type === "start").length === 1 && rail.rows.filter((x) => x.type === "end").length === 1 && rail.rows.filter((x) => x.type === "now").length === 1, "the rail: its start, its end and Now", JSON.stringify(rail && rail.rows.map((x) => x.type)));
    const start = rail.rows.find((x) => x.type === "start");
    check(/^Episode [1-4] starts$/.test(start.title) && start.hm === "8:05" && start.ap === "PM", "the episode starts at 8:05 PM, Eastern", JSON.stringify(start));
    const end = rail.rows.find((x) => x.type === "end");
    check(end.hm === "9:05" && end.line === "Episodes run 1 hr", "it ends an hour later", JSON.stringify(end));
    const runRows = rail.rows.filter((x) => x.type === "run");
    check(runRows.length >= 3 && runRows.every((x) => /^(quick|full|trivia|bingo)@\d+$/.test(x.key) && x.on), "each run on the rail, on", runRows.map((x) => x.key).join());
    const quick = runRows.find((x) => x.key === "quick@0");
    check(!!quick && quick.hm === "9:05" && quick.line === "At its end", "who went home: at its end", JSON.stringify(quick));
    const again = runRows.find((x) => x.key === "full@720");
    check(!!again && again.title === "Full results, again" && /merged into the first/.test(again.line) && again.hm === "9:05" && again.ap === "AM", "full results again: 12 hours on, merged into the first", JSON.stringify(again));
    const fin = rail.rows.find((x) => x.type === "final");
    check(!!fin && fin.hm === "12:00" && fin.ap === "PM" && fin.title === "Final results for players" && rail.rows.indexOf(fin) > rail.rows.indexOf(again), "players' final results: 12:00 PM the next day, after the last full run", JSON.stringify(fin));
    const nowAt = rail.rows.findIndex((x) => x.type === "now");
    check(nowAt >= 0 && (Date.parse(rail.airAt) > Date.now() ? rail.rows[nowAt + 1]?.type === "start" || rail.rows.slice(0, nowAt).every((x) => x.type === "run") : rail.rows.slice(0, nowAt).some((x) => x.type === "start")), "Now sits before what's still to come", JSON.stringify(rail.rows.map((x) => x.type)));
    check(r1.now.aired.length >= 2 && r1.now.aired[0].label === "The latest" && r1.now.scheduleEpisode === r1.now.aired[0].n && r1.now.bingo.length >= 1, "Run now's episodes: the aired ones, latest first; bingo's still to come", JSON.stringify(r1.now));
    check(r1.line === "Autopilot on · 5 runs after each episode" && r1.games === 0 && r1.delete.line === "Its episodes, cast and results go", "Running it's line, and its Delete", `${r1.line} | ${r1.delete.line}`);
    const r2 = await page(ids.s2);
    check(!r2.on && r2.next === "Nothing runs on its own" && r2.line === "Autopilot off · Run now any time", "Season 2: Autopilot off", `${r2.next} | ${r2.line}`);
    const r3 = await page(ids.s3);
    check(!r3.rail && r3.railNote === "No schedule yet, so nothing runs: Setup gives it one.", "Season 3: no schedule, so nothing runs", r3.railNote);
    const season = (await as.desk.call("GET", `/api/desk/seasons/${ids.s1}`)).body;
    check(season.bot && season.bot.on, "the season's read still has its bot");

    // ---- 3. the schedule ----
    let c = await change(ids.s1, { schedule: USUAL.map((x) => (x.kind === "quick" ? { ...x, on: false } : x)) });
    check(c.status === 200 && c.body.text === "Who went home (at its end) off" && !!c.body.changeId, "a run switched off: its line", JSON.stringify(c.body));
    check((await sched(ids.s1)).runs.find((x) => x.kind === "quick").on === false, "stored: off");
    const offId = c.body.changeId;
    c = await change(ids.s1, { schedule: USUAL.map((x) => (x.kind === "full" && x.after === 720 ? { ...x, after: 540 } : x.kind === "quick" ? { ...x, on: false } : x)) });
    check(c.body.text === "Full results: 9 hr after it ends (was 12 hr after it ends)", "retimed: its line", c.body.text);
    c = await change(ids.s1, { schedule: [...USUAL, { kind: "trivia", after: 1440, on: true }] });
    check(c.status === 400 && /Two trivia runs/.test(c.body.error || ""), "a duplicate run refused", JSON.stringify(c.body));
    let now1 = (await sched(ids.s1)).runs;
    c = await change(ids.s1, { schedule: [...now1, { kind: "schedule", after: 30, on: true }] });
    check(c.body.text === "Schedule check added, 30 min after it ends" && (await sched(ids.s1)).runs.length === 6, "added: its line", c.body.text);
    now1 = (await sched(ids.s1)).runs;
    c = await change(ids.s1, { schedule: now1.filter((x) => x.kind !== "bingo") });
    check(c.body.text === "Bingo squares (a day before it airs) taken off", "taken off: its line", c.body.text);
    check((await sched(ids.s1)).runs !== null && !(await page(ids.s1)).follows, "a change to its runs: a schedule of its own");
    c = await change(ids.s1, { reset: true });
    check(c.body.text === "Schedule reset to our usual five" && (await sched(ids.s1)).runs === null && (await page(ids.s1)).follows, "reset: it follows our usual again", c.body.text);
    c = await change(ids.s1, { episodeMinutes: 90 });
    check(c.body.text === "Episode length: 1 hr 30 min (was 1 hr)" && (await sched(ids.s1)).m === 90, "the episode's length", c.body.text);
    const lenId = c.body.changeId;
    r1 = await page(ids.s1);
    check(r1.minutes === 90 && r1.rail.rows.find((x) => x.type === "end").hm === "9:35" && r1.rail.rows.find((x) => x.key === "quick@0").hm === "9:35", "every run moves with the end", JSON.stringify(r1.rail.rows.filter((x) => x.type !== "now").map((x) => `${x.key}=${x.hm}`)));
    check((await change(ids.s1, { episodeMinutes: 2 })).status === 400 && (await change(ids.s1, { episodeMinutes: 601 })).status === 400, "a length out of range refused");
    c = await change(ids.s1, { episodeMinutes: 90 });
    check(c.status === 200 && c.body.changeId === null, "the same length again changes nothing");
    check((await undo(lenId)).status === 200 && (await sched(ids.s1)).m === null, "Undo puts the length back");
    c = await change(ids.s1, { on: false });
    check(c.body.text === "Autopilot off" && (await sched(ids.s1)).on === false && (await page(ids.s1)).next === "Nothing runs on its own", "Autopilot off", c.body.text);
    const offAt = c.body.changeId;
    check((await undo(offAt)).status === 200 && (await sched(ids.s1)).on === true, "Undo: Autopilot back on");
    check((await undo(offId)).status === 200, "an older line's Undo still works");
    r1 = await page(ids.s1);
    check(r1.history.length >= 7 && r1.history.some((h) => h.text === "Schedule reset to our usual five" && h.who === U("desk")), "History: each change, by who", JSON.stringify(r1.history.slice(0, 3)));
    await change(ids.s1, { reset: true });
    const settings = (await as.desk.call("GET", "/api/desk/settings")).body;
    const ap = (settings.settings?.autopilot || []).find((a) => a.id === ids.s1);
    check(!!ap && ap.line === "Who went home, then full results", "Settings › Autopilot: the season, what it does after each episode", JSON.stringify(ap));

    // ---- 3b. the research pattern (the user, 2026-10-29) ----
    // Just this episode: its own runs over the season's, for it alone.
    r1 = await page(ids.s1);
    const N = r1.rail.n;
    check(r1.follows && !r1.rail.own && r1.rail.runs.length === 5 && r1.rail.gone.length === 0, "the rail's runs: the season's (our usual's)", JSON.stringify(r1.rail.runs));
    const epRow = async () => (await pool.query("SELECT schedule FROM bot_research_episodes WHERE season_id = $1 AND episode_number = $2", [ids.s1, N])).rows[0]?.schedule ?? null;
    check((await change(ids.s1, { episode: N })).status === 400 && (await change(ids.s1, { episode: 0, back: true })).status === 400, "an episode's change needs a run or back, and an episode");
    c = await change(ids.s1, { episode: N, run: { from: "full@720", to: { kind: "full", after: 780, on: true } } });
    check(c.status === 200 && c.body.text === `Episode ${N} only: Full results: 13 hr after it ends (was 12 hr after it ends)` && !!c.body.changeId, "Episode N only: its line", JSON.stringify(c.body));
    let own = await epRow();
    check(!!own && own.some((x) => x.kind === "full" && x.after === 780 && (x.was || []).includes("full@720")) && !own.some((x) => x.after === 720) && (await sched(ids.s1)).runs === null, "stored for the episode alone, remembering 720; the season still follows our usual", JSON.stringify(own));
    r1 = await page(ids.s1);
    check(r1.rail.own && r1.rail.rows.find((x) => x.key === "full@780")?.mine === true && r1.rail.rows.filter((x) => x.mine).length === 1, "the rail: the episode's own runs, the moved one marked", JSON.stringify(r1.rail.rows.filter((x) => x.type === "run").map((x) => [x.key, x.mine])));
    // The bot's planner reads them (the real load: season-clock.js, normalizeEpisodes), from a clock 13 hours on.
    await pool.query("UPDATE show_seasons SET bot_research_since = now() - interval '30 days' WHERE id = $1", [ids.s1]);
    const planned = (await Bot.listDue(pool, { now: new Date(Date.parse(r1.rail.endAt) + 781 * 60000), seasonId: ids.s1 })).filter((j) => j.episode === N).map((j) => j.slot);
    check(planned.includes("full@780") && planned.includes("full@60") && !planned.includes("full@720"), "the bot's planner: Episode N's own runs (full results at 13 hours, not 12)", planned.join());
    // A change for every episode reaches the episode's own runs too.
    c = await change(ids.s1, { run: { from: "quick@0", to: { kind: "quick", after: 0, on: false } } });
    own = await epRow();
    check(c.body.text === "Who went home (at its end) off" && (await sched(ids.s1)).runs?.length === 5 && own?.find((x) => x.kind === "quick")?.on === false && own.some((x) => x.after === 780), "every episode: the season's runs (its own now) and the episode's own take it", JSON.stringify({ t: c.body.text, own }));
    const everyId = c.body.changeId;
    // An episode's change that comes out as the season's runs lets its own go.
    c = await change(ids.s1, { episode: N, run: { from: "full@780", to: { kind: "full", after: 720, on: true }, was: ["full@720"] } });
    check(c.body.text === `Episode ${N} only: Full results: 12 hr after it ends (was 13 hr after it ends) (the season's schedule again)` && (await epRow()) === null, "the same as the season's: back to it on its own", c.body.text);
    check((await undo(c.body.changeId)).status === 200 && (await epRow())?.some((x) => x.after === 780), "Undo: its own runs again");
    c = await change(ids.s1, { episode: N, back: true });
    check(c.body.text === `Episode ${N}: back to the season's schedule` && (await epRow()) === null, "Back to the season's schedule", c.body.text);
    check((await change(ids.s1, { episode: N, back: true })).body.changeId === null, "back again: nothing changed");
    check((await undo(c.body.changeId)).status === 200 && !!(await epRow()), "Undo: its own runs again");
    check((await undo(everyId)).status === 200 && (await sched(ids.s1)).runs === null && (await epRow())?.find((x) => x.kind === "quick")?.on === true, "Undo of the change for every episode: following our usual again, the episode's own as they were");
    await change(ids.s1, { episode: N, back: true });
    // A run on the episode's own, changed for every episode: the season's run it moved from changes (its `was`).
    await change(ids.s1, { episode: N, run: { from: "full@720", to: { kind: "full", after: 780, on: true } } });
    c = await change(ids.s1, { run: { from: "full@780", to: { kind: "full", after: 780, on: true }, was: ["full@720"] } });
    check(c.body.text === "Full results: 13 hr after it ends (was 12 hr after it ends)" && (await sched(ids.s1)).runs.some((x) => x.after === 780) && (await epRow()) === null, "Episode N's own run, made every episode's: the season's moves, and the episode's own go back to it", JSON.stringify({ t: c.body.text, own: await epRow() }));
    await change(ids.s1, { reset: true });

    // Make this our usual (tier 2): who it reaches, a moved run remembering its old slot, the seasons that follow changing with it.
    check((await change(ids.s1, { makeUsual: true })).status === 409, "following our usual, it can't be made our usual");
    await change(ids.s1, { schedule: USUAL.map((x) => ({ ...x, on: false })) });
    c = await change(ids.s1, { makeUsual: true });
    check(c.status === 400 && /a run that's on/.test(c.body.error || "") && (await pool.query("SELECT 1 FROM app_settings WHERE key = 'bot_usual'")).rows.length === (usualBefore ? 1 : 0), "every run off: refused as our usual", JSON.stringify(c.body));
    await change(ids.s1, { reset: true });
    await change(ids.s1, { run: { from: "full@720", to: { kind: "full", after: 600, on: true } } });
    r1 = await page(ids.s1);
    check(!r1.follows && r1.reach.follow.includes(`${NAME} 4`) && !r1.reach.follow.includes(`${NAME} 1`) && !r1.reach.follow.includes(`${NAME} 2`), "who our usual reaches: Season 4 (Season 2's Autopilot is off)", JSON.stringify(r1.reach));
    c = await change(ids.s1, { makeUsual: true });
    check(c.status === 200 && c.body.text === "Made this our usual: Full results: 10 hr after it ends (was 12 hr after it ends)" && !!c.body.changeId, "Make this our usual: its line", JSON.stringify(c.body));
    const usualRow = async () => (await pool.query("SELECT value FROM app_settings WHERE key = 'bot_usual'")).rows[0]?.value ?? null;
    const made = await usualRow();
    check(!!made && made.some((x) => x.kind === "full" && x.after === 600 && (x.was || []).includes("full@720")) && (await sched(ids.s1)).runs === null, "stored: our usual (the moved run remembering 720), and Season 1 follows it", JSON.stringify(made));
    const r4 = await page(ids.s4);
    check(r4.follows && r4.runs.some((x) => x.kind === "full" && x.after === 600) && (await page(ids.s1)).follows, "Season 4, following our usual, changes with it", JSON.stringify(r4.runs));
    check((await undo(c.body.changeId)).status === 200 && JSON.stringify(await usualRow()) === JSON.stringify(usualBefore) && (await sched(ids.s1)).runs?.some((x) => x.after === 600), "Undo: our usual as it was, and Season 1's own runs again");
    await change(ids.s1, { reset: true });

    // No usual run quietly missing: a season with its own schedule and no bingo run, in the Inbox with its Add.
    const lacking = async (id) => ((await as.desk.call("GET", "/api/desk/inbox")).body.items || []).filter((i) => i.kind === "usual" && i.href === `/desk/season/${id}/research`);
    check((await lacking(ids.s1)).length === 0, "following our usual: nothing missing");
    await change(ids.s1, { run: { from: "bingo@1440" } });
    let gap = await lacking(ids.s1);
    check(gap.length === 1 && gap[0].title === `${NAME} 1 has no Bingo run: its cards won't deal` && gap[0].line === "Our usual has it a day before it airs" && gap[0].add?.kind === "bingo" && gap[0].add?.seasonId === ids.s1, "the Inbox: Season 1 has no Bingo run, with its Add", JSON.stringify(gap));
    c = await change(ids.s1, { addUsual: "bingo" });
    check(c.body.text === "Bingo squares added, a day before it airs" && (await lacking(ids.s1)).length === 0, "Add: our usual's bingo run, and the Inbox lets it go", c.body.text);
    await change(ids.s1, { run: { from: "bingo@1440", to: { kind: "bingo", after: 1440, on: false } } });
    check((await lacking(ids.s1)).length === 0, "a run switched off isn't missing (it's on the rail, off)");
    await change(ids.s1, { reset: true });

    // ---- 4. Run now, queued ----
    let run = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "gossip" });
    check(run.status === 400, "a kind that isn't one refused");
    run = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "full", episode: 6 });
    check(run.status === 400 && /hasn't aired/.test(run.body.error || ""), "an episode that hasn't aired refused", JSON.stringify(run.body));
    run = await as.desk.call("POST", `/api/desk/seasons/${ids.s3}/runs`, { kind: "schedule" });
    check(run.status === 400 && /Nothing has aired/.test(run.body.error || ""), "the schedule check with nothing aired refused", JSON.stringify(run.body));
    bot.down = true;
    run = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "schedule" });
    check(run.status === 503 && /isn't answering/.test(run.body.error || ""), "the bot down: refused, nothing queued", JSON.stringify(run.body));
    bot.down = false;
    const aired1 = r1.now.scheduleEpisode;
    run = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "schedule" });
    check(run.status === 200 && run.body.text === `Asking ChatGPT: the schedule check, after Episode ${aired1}` && run.body.waits === null, "Run now: asked at once", JSON.stringify(run.body));
    const joined = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "schedule" });
    check(joined.status === 200 && /^Already asking/.test(joined.body.text), "the same again joins it", JSON.stringify(joined.body));
    const behind = await as.desk.call("POST", `/api/desk/seasons/${ids.s2}/runs`, { kind: "schedule" });
    check(behind.status === 200 && /^Queued: the schedule check, after Episode \d$/.test(behind.body.text) && /^One question at a time: it starts after /.test(behind.body.waits || ""), "another season's run queues behind it, saying so", JSON.stringify(behind.body));
    // While it asks: the run's row with how far it's got, and the waiting one.
    let seen = null;
    for (let k = 0; k < 40 && !seen; k++) {
      const p = await page(ids.s1);
      const going = p.log.find((l) => l.ok === null && !l.queued);
      if (going) seen = { p, going };
      else await sleep(250);
    }
    check(!!seen && seen.going.title === `Schedule check · after Episode ${aired1}` && seen.going.line === `Run now, by ${U("desk")} · now` && seen.p.next === `Asking now: after Episode ${aired1}`, "asking: its row, by who, and the lower third says so", JSON.stringify(seen && { g: seen.going, next: seen.p.next }));
    const w2 = (await page(ids.s2)).log.find((l) => l.queued);
    check(!!w2 && /waiting/.test(w2.line) && /^Starts after the schedule check for ZT DR Show 1 after Episode \d/.test(w2.result), "the waiting one says what it waits behind", JSON.stringify(w2));
    check(await drained(), "both ran");
    const { rows: dq } = await pool.query("SELECT d.season_id, d.started_at, d.done_at, d.ok, d.run_id, r.asked_by, r.slot FROM desk_runs d JOIN bot_research_runs r ON r.id = d.run_id WHERE d.season_id IN ($1, $2) ORDER BY d.asked_at", [ids.s1, ids.s2]);
    check(dq.length === 2 && dq.every((x) => x.ok && x.slot === "now" && x.asked_by === ids.desk), "each a run of its own, slot now, asked by the desk admin", JSON.stringify(dq));
    check(dq.length === 2 && dq[1].started_at >= dq[0].done_at, "one question at a time: the second started after the first ended", JSON.stringify(dq.map((x) => [x.started_at, x.done_at])));
    check(bot.asked.filter((a) => a.kind === "schedule").length === 2, "the bot was asked twice, no more");
    r1 = await page(ids.s1);
    const doneRun = r1.log[0];
    check(doneRun.ok === true && /^Episode \d: time not given, 90 min$/.test(doneRun.result) && /^Run now, by zt_dr_desk · (Today|Tonight), /.test(doneRun.line) && doneRun.seconds > 0, "done: what it found, by who, when", JSON.stringify(doneRun));
    check(r1.meta === "Asks ChatGPT · 1 run this week" && r1.history.some((h) => /^Schedule check, after Episode \d: Run now$/.test(h.text)), "the meta line counts it; History has it", `${r1.meta} | ${JSON.stringify(r1.history[0])}`);
    const q = await as.desk.call("GET", `/api/desk/seasons/${ids.s1}/runs/${doneRun.id}`);
    check(q.status === 200 && q.body.question.includes(`${NAME} season 1: when does episode ${aired1 + 1} air?`), "a run's question, as it asks it", (q.body.question || JSON.stringify(q.body)).slice(0, 120));
    scheduleFound = false;
    run = await as.desk.call("POST", `/api/desk/seasons/${ids.s1}/runs`, { kind: "schedule" });
    check(run.status === 200, "asked again");
    check(await drained(), "it ran");
    r1 = await page(ids.s1);
    check(r1.log[0].ok === false && r1.log[0].result === `No source yet for when episode ${aired1 + 1} airs` && r1.log[0].tries === "Run now asks once: Try again asks again.", "a failed run: why, and how many tries it gets", JSON.stringify(r1.log[0]));
    const all = (await as.desk.call("GET", `/api/desk/seasons/${ids.s1}/runs`)).body.runs;
    check(all.length === 2 && all[0].ok === false && all[1].ok === true, "Runs' All: every run, newest first");
    // Noticed aw: Setup's Episodes lowered takes the bot's runs, asks and queued Run nows past the count with it.
    await pool.query("INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, finished_at, ok, message) VALUES ($1, 8, 'bingo@1440', 'bingo', now(), true, 'zt'), ($1, 3, 'bingo@1440', 'bingo', now(), true, 'zt')", [ids.s2]);
    await pool.query("INSERT INTO research_asks (season_id, episode_number, asked_by) VALUES ($1, 8, $2)", [ids.s2, ids.desk]);
    await pool.query("INSERT INTO desk_runs (season_id, episode_number, kind, asked_by) VALUES ($1, 7, 'bingo', $2)", [ids.s2, ids.desk]);
    const lowered = await as.desk.call("POST", `/api/desk/seasons/${ids.s2}/setup`, { episodes: 6 });
    const left = (await pool.query(
      "SELECT (SELECT count(*) FROM bot_research_runs WHERE season_id = $1 AND episode_number > 6)::int AS runs, (SELECT count(*) FROM bot_research_runs WHERE season_id = $1 AND episode_number = 3)::int AS kept, (SELECT count(*) FROM research_asks WHERE season_id = $1)::int AS asks, (SELECT count(*) FROM desk_runs WHERE season_id = $1 AND done_at IS NULL)::int AS queued",
      [ids.s2]
    )).rows[0];
    check(lowered.status === 200 && left.runs === 0 && left.kept === 1 && left.asks === 0 && left.queued === 0, "fewer episodes: the bot's runs, asks and queued runs past the count go (Noticed aw)", JSON.stringify({ s: lowered.status, ...left }));
    scheduleFound = true;

    // ---- 5. screens ----
    const d = await open({ user: U("desk"), pass: PASSWORD, width, height: 844, headers });
    closers.push(d.close);
    const failed = [];
    d.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await d.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const pg = d.page;
    let n = 0;
    const shot = async (name, fullPage = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage });
    };
    const fits = async (where) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re) => {
      try {
        await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 15000 });
      } catch {
        /* read what's there */
      }
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const shut = async () => {
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(400);
    };
    const dialog = () => pg.locator("[role=dialog][data-open]").last().innerText();

    // The season page's row
    await pg.goto(`${BASE}/desk/season/${ids.s1}`);
    await pg.locator("[data-desk-row='research']").waitFor({ timeout: 30000 });
    check((await pg.locator("[data-desk-row='research'] small").innerText()).trim() === "Autopilot on · 5 runs after each episode" && (await pg.locator("[data-season-bot]").count()) === 0, "the season page: Running it › Research and the bot, its schedule no longer on the page");
    await shot("season-page");
    await pg.locator("[data-desk-row='research']").click();
    await pg.locator("[data-desk-research]").waitFor({ timeout: 30000 });
    check((await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) === `${NAME} 1`, "Back names the season");
    check(/Autopilot on/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) && /^Next: /.test(await pg.locator("[data-lower-third-name]").locator("xpath=following-sibling::small").innerText()), "the lower third: Autopilot on, the next run");
    check((await pg.locator("[data-run-now-kind]").count()) === 5 && (await pg.locator("[data-rail-row]").count()) >= 5 && (await pg.locator("[data-rail-now]").count()) === 1, "Run now's five, and the rail with Now");
    check((await pg.locator("[data-missing]").count()) === 0 && /Our usual five/i.test(await pg.locator("section", { hasText: "Its schedule" }).first().innerText()), "our usual five: nothing missing, no Reset");
    const last = await pg.evaluate(() => [...document.querySelectorAll("section")].filter((s) => s.offsetParent).pop()?.getAttribute("data-delete-row"));
    check(last === "season", "the season's Delete is last", String(last));
    await fits("Research and the bot");
    await shot("research");
    await shot("research-full", true);

    // Run now's sheet
    await pg.locator("[data-run-now-kind='full']").click();
    await pg.locator("[data-now-go]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-now-episode]").count()) === r1.now.aired.length && /Asks Episode \d's whole checklist/.test(await dialog()) && /It starts now and takes about 3 minutes/.test(await dialog()), "Run now: which episode, what it does, how long");
    await pg.locator("[data-now-episode]").nth(1).click();
    check(new RegExp(`Asks Episode ${r1.now.aired[1].n}'s whole checklist`).test(await dialog()), "another episode: its words follow");
    await fits("Run now's sheet");
    await shot("run-now-full");
    await shut();
    await pg.locator("[data-run-now-kind='schedule']").click();
    await pg.locator("[data-now-go]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-now-episode]").count()) === 0 && new RegExp(`Asks when Episode ${aired1 + 1} airs`).test(await dialog()), "the schedule check: no episode to pick");
    bot.delayMs = 5000;
    await pg.locator("[data-now-go]").click();
    check(new RegExp(`Asking ChatGPT: the schedule check, after Episode ${aired1}`).test(await toasted(/Asking ChatGPT/)), "asked: a toast");
    await pg.locator("[data-run-state='go'] [data-run-progress]").waitFor({ timeout: 15000 });
    check(/Searching the recaps|Opening ChatGPT|Writing it up|Waiting its turn/.test(await pg.locator("[data-run-state='go'] [data-run-progress]").innerText()), "asking: its row has a bar and how far it's got");
    await pg.locator("[data-runs]").scrollIntoViewIfNeeded();
    await shot("run-asking");
    await pg.locator("[data-run-state='go']").click();
    await pg.locator("[data-run-sheet]").waitFor({ timeout: 10000 });
    check(/Asking ChatGPT/.test(await dialog()) && /One question at a time/.test(await dialog()), "a run asking: its sheet");
    await shut();
    await pg.waitForFunction(() => !document.querySelector("[data-run-state='go']"), null, { timeout: 30000 });
    bot.delayMs = 2500;
    check(/90 min/.test(await pg.locator("[data-run]").first().innerText()), "done: the page moves on by itself");
    // A failed run's sheet, and Try again
    await pg.locator("[data-run-state='no']").first().click();
    await pg.locator("[data-run-sheet]").waitFor({ timeout: 10000 });
    check(/Failed/.test(await dialog()) && /No source yet/.test(await dialog()) && /Run now asks once/.test(await dialog()) && (await pg.locator("[data-run-question]").count()) === 1, "a failed run: why, its tries, The question");
    await fits("a run's sheet");
    await shot("run-failed");
    await pg.locator("[data-run-again]").click();
    await pg.locator("[data-now-go]").waitFor({ timeout: 10000 });
    check(/Schedule check, now/i.test(await dialog()), "Try again opens Run now for it");
    await shut();

    // A run's timing: every episode or Episode N only; past its first hour, an hour at a time on the clock (for the rail's
    // episode, which by now runs 90 minutes by its research: the schedule check above filed it); the toast's Undo
    const value = async () => (await pg.locator("[data-time-value]").innerText()).replace(/\s+/g, "").trim();
    const endAt = Date.parse((await page(ids.s1)).rail.endAt);
    /** "9:35AM", "10AM": `m` minutes after the rail's episode ends, on the clock in Eastern. */
    const clockAt = (m) => new Date(endAt + m * 60000).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(/\s+/g, "");
    const durW = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`);
    /** The first whole hour on the clock after `m` minutes from the end (Eastern's offset is whole hours). */
    const hourAfter = (m) => {
      const t = endAt + m * 60000;
      return (t - (t % 3600000) + 3600000 - endAt) / 60000;
    };
    const step = async (dir, until, max = 60) => {
      const seen = [];
      for (let k = 0; k < max && !until(await value()); k++) {
        await pg.locator(`[data-time-step='${dir}']`).click();
        seen.push(await value());
      }
      return seen;
    };
    await pg.locator("[data-rail-run='full@720']").click();
    await pg.locator("[data-time-save]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-time-save]").isDisabled()) && /12 hr after it ends/.test(await pg.locator("[data-time-when]").innerText()) && (await value()) === clockAt(720), "a run's timing: as it is, on the clock, Save off", `${await value()} vs ${clockAt(720)}`);
    check((await pg.locator("[data-time-scope='every'][aria-checked='true']").count()) === 1 && /Episode \d only/.test(await pg.locator("[data-time-scope='episode']").innerText()), "it says which episodes: every one, by default");
    await pg.locator("[data-time-step='1']").click();
    const h1 = hourAfter(720);
    check((await value()) === clockAt(h1) && /^\d{1,2}(AM|PM)$/.test(await value()) && (await pg.locator("[data-time-when]").innerText()).includes(`${durW(h1)} after it ends`) && /Around Episode \d: /.test(await dialog()), "later: the next whole hour on the clock", `${await value()} ${await pg.locator("[data-time-when]").innerText()}`);
    await step(-1, (v) => v === "1hr");
    check((await pg.locator("[data-time-dup]").count()) === 1 && (await pg.locator("[data-time-save]").isDisabled()), "back through the hours to 1 hr: a duplicate of the first, refused", await value());
    await pg.locator("[data-time-step='-1']").click();
    check(/^45min$/i.test(await value()), "the first hour's finer steps: 45 min", await value());
    const passed = await step(1, (v) => v === "12PM");
    check((await value()) === "12PM" && passed.slice(1).every((v) => v === clockAt(720) || /^\d{1,2}(AM|PM)$/.test(v)) && passed.length > 10, "an hour at a time on the clock to 12 PM the next day (the run's own time on the way)", passed.join(" "));
    await fits("a run's timing sheet");
    await shot("run-timing");
    await pg.locator("[data-time-save]").click();
    const noon = (await sched(ids.s1)).runs?.find((x) => x.kind === "full" && x.after > 720);
    check(!!noon && clockAt(noon.after) === "12PM" && (noon.was || []).includes("full@720"), "stored: the minutes from its end to 12 PM, remembering 720", JSON.stringify(noon));
    check(new RegExp(`Full results: ${noon ? durW(noon.after) : "?"} after it ends \\(was 12 hr after it ends\\)`).test(await toasted(/Full results:/)), "saved: a toast with its line");
    const railAt = (await page(ids.s1)).rail.rows;
    const atNoon = noon && railAt.find((x) => x.key === `full@${noon.after}`);
    const finRow = railAt.find((x) => x.type === "final");
    check(!!atNoon && `${atNoon.hm} ${atNoon.ap}` === "12:00 PM" && `${finRow.hm} ${finRow.ap}` === "12:00 PM" && railAt.indexOf(atNoon) < railAt.indexOf(finRow), "on the rail at 12:00 PM, just before players' final results", JSON.stringify([atNoon, finRow]));
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /Undone/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 });
    check((await sched(ids.s1)).runs === null, "the toast's Undo: following our usual again");
    // Episode N only: marked on the rail, its switch for it alone, and Back to the season's schedule
    const railN = (await page(ids.s1)).rail.n;
    await pg.locator(`[data-rail-row='full@${noon?.after}']`).waitFor({ state: "detached", timeout: 10000 });
    await pg.locator("[data-rail-run='full@60']").click();
    await pg.locator("[data-time-scope='episode']").click();
    await pg.locator("[data-time-step='1']").click();
    const h2 = hourAfter(60);
    check((await value()) === clockAt(h2) && (await pg.locator("[data-time-scope='episode'][aria-checked='true']").count()) === 1, "Episode N only, a step on: the next whole hour", await value());
    await fits("a run's sheet, Episode N only");
    await shot("run-episode-only");
    await pg.locator("[data-time-save]").click();
    check(new RegExp(`Episode ${railN} only: Full results: ${durW(h2)} after it ends \\(was 1 hr after it ends\\)`).test(await toasted(/only:/)), "saved for the episode alone");
    await pg.locator("[data-episode-own]").waitFor({ timeout: 10000 });
    check((await pg.locator(`[data-rail-row='full@${h2}'] [data-rail-mine]`).count()) === 1 && /Episode \d only/i.test(await pg.locator("[data-rail-mine]").innerText()), "the rail marks it: Episode N only");
    check((await sched(ids.s1)).runs === null && (await pool.query("SELECT 1 FROM bot_research_episodes WHERE season_id = $1 AND episode_number = $2", [ids.s1, railN])).rows.length === 1, "stored for the episode; the season untouched");
    await pg.locator("[data-rail-switch='full@720']").click();
    check(new RegExp(`Episode ${railN} only: Full results \\(12 hr after it ends\\) off`).test(await toasted(/\) off/)), "its switch, while it has its own runs: for it alone");
    await pg.locator("[data-rail-row='full@720'][data-on='off']").waitFor({ timeout: 10000 });
    check(!/Taken off for it/.test(await pg.locator("[data-episode-own]").innerText()), "a run it moved isn't said to be taken off");
    await pg.locator("[data-episode-own]").scrollIntoViewIfNeeded();
    await fits("an episode's own runs");
    await shot("episode-own");
    await pg.locator("[data-rail-run='full@720']").click();
    await pg.locator("[data-time-save]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-time-scope='episode'][aria-checked='true']").count()) === 1 && (await pg.locator("[data-time-on='off']").count()) === 1, "its own run's sheet: Episode N only by default, its switch off");
    await shut();
    await pg.locator("[data-episode-back]").click();
    check(new RegExp(`Episode ${railN}: back to the season's schedule`).test(await toasted(/back to the season/)), "Back to the season's schedule");
    await pg.locator("[data-episode-own]").waitFor({ state: "detached", timeout: 10000 });
    check((await pool.query("SELECT 1 FROM bot_research_episodes WHERE season_id = $1", [ids.s1])).rows.length === 0, "its own runs gone");
    // A run switched off on the rail, then Not in its schedule and Reset
    await pg.locator("[data-rail-switch='quick@0']").click();
    await toasted(/Who went home/);
    await pg.locator("[data-rail-row='quick@0'][data-on='off']").waitFor({ timeout: 10000 });
    check(true, "a run switched off from the rail");
    await pg.locator("[data-rail-run='quick@0']").click();
    await pg.locator("[data-time-off]").click();
    check(/Who went home \(at its end\) taken off/.test(await toasted(/taken off/)), "taken off the schedule");
    await pg.locator("[data-missing-run='quick@0']").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-reset]").count()) === 1 && (await pg.locator("[data-make-usual]").count()) === 1, "Not in its schedule lists it; Reset and Make this our usual show");
    check(/No who went home run: no early results/i.test(await pg.locator("[data-missing-lack='quick']").innerText()), "a kind it has no run of: what that costs");
    await fits("Not in its schedule");
    await pg.locator("[data-make-usual]").scrollIntoViewIfNeeded();
    await pg.evaluate(() => window.scrollBy(0, -120));
    await shot("schedule-own");
    await pg.locator("[data-missing]").scrollIntoViewIfNeeded();
    await shot("not-in-schedule");
    await pg.locator("[data-reset]").click();
    await pg.locator("[data-reset-go]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-reset-list] > div").count()) === 5 && /follows our usual from now on/.test(await dialog()), "Reset: our usual five, listed; it follows our usual from now on");
    await shot("reset");
    await pg.locator("[data-reset-go]").click();
    check(/Schedule reset to our usual five/.test(await toasted(/reset/)), "reset");
    // Add a run
    await pg.locator("[data-add-run]").click();
    await pg.locator("[data-add-kind='schedule']").click();
    await pg.locator("[data-time-save]").waitFor({ timeout: 10000 });
    check(/30 min after it ends/.test(await pg.locator("[data-time-when]").innerText()), "Add the schedule check: 30 min after, by default");
    await shot("add-run");
    await pg.locator("[data-time-save]").click();
    check(/Schedule check added, 30 min after it ends/.test(await toasted(/added/)), "added");
    // Make this our usual (tier 2): what it says first, then Undo from its toast
    await pg.locator("[data-make-usual]").click();
    await pg.locator("[data-make-usual-go]").waitFor({ timeout: 10000 });
    const mk = await dialog();
    check((await pg.locator("[data-usual-list] > div").count()) === 6 && new RegExp(`${NAME} 4 follows our usual, and changes with it`).test(mk) && /follows our usual from now on/.test(mk), "Make this our usual: its six runs, who changes with it", mk.slice(0, 300));
    await fits("Make this our usual");
    await shot("make-usual");
    await pg.locator("[data-make-usual-go]").click();
    check(/Made this our usual: Schedule check added, 30 min after it ends/.test(await toasted(/Made this our usual/)), "made our usual");
    await pg.locator("[data-follows]").waitFor({ timeout: 10000 });
    check(/Our usual six/i.test(await pg.locator("[data-follows]").innerText()) && ((await pool.query("SELECT value FROM app_settings WHERE key = 'bot_usual'")).rows[0]?.value || []).length === 6, "it follows our usual, now six; stored");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /Undone/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 });
    check(JSON.stringify((await pool.query("SELECT value FROM app_settings WHERE key = 'bot_usual'")).rows[0]?.value ?? null) === JSON.stringify(usualBefore) && (await sched(ids.s1)).runs?.length === 6, "the toast's Undo: our usual as it was, its own six again");
    // The Inbox: a usual kind its own schedule hasn't, with its Add
    await change(ids.s1, { run: { from: "bingo@1440" } });
    await pg.goto(`${BASE}/desk`);
    await pg.locator(`[data-inbox-add='${ids.s1}:bingo']`).waitFor({ timeout: 30000 });
    const item = pg.locator("[data-desk-item='usual']", { has: pg.locator(`[data-inbox-add='${ids.s1}:bingo']`) });
    check(/ZT DR Show 1 has no Bingo run: its cards won't deal/.test(await item.innerText()) && /Our usual has it a day before it airs/.test(await item.innerText()), "the Inbox: no Bingo run, what it costs, our usual's time");
    await item.scrollIntoViewIfNeeded();
    await fits("the Inbox");
    await shot("inbox-usual");
    await pg.locator(`[data-inbox-add='${ids.s1}:bingo']`).click();
    check(/Bingo squares added, a day before it airs/.test(await toasted(/Bingo squares added/)), "its Add: added in one tap");
    await pg.locator(`[data-inbox-add='${ids.s1}:bingo']`).waitFor({ state: "detached", timeout: 10000 });
    check((await sched(ids.s1)).runs?.some((x) => x.kind === "bingo" && x.after === 1440 && x.on), "stored: bingo a day before it airs");
    await pg.goto(`${BASE}/desk/season/${ids.s1}/research`);
    await pg.locator("[data-desk-research]").waitFor({ timeout: 30000 });
    // The episode's length
    await pg.locator("[data-rail-row='end']").click();
    await pg.locator("[data-length-save]").waitFor({ timeout: 10000 });
    for (let k = 0; k < 6; k++) await pg.locator("[data-length-step='1']").click();
    check(/1½/.test(await pg.locator("[data-length-value]").innerText()) && /ends 9:35 PM/.test(await pg.locator("[data-length-ends]").innerText()), "the length: 1½ hr, and when it ends");
    await shot("length");
    await pg.locator("[data-length-save]").click();
    check(/Episode length: 1 hr 30 min \(was 1 hr\)/.test(await toasted(/Episode length/)), "saved");
    // Autopilot off
    await pg.locator("[data-switch='autopilot']").click();
    check(/Autopilot off/.test(await toasted(/Autopilot off/)), "Autopilot off from its switch");
    await pg.locator("[data-desk-research='off']").waitFor({ timeout: 10000 });
    check(/Autopilot off/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")), "the lower third says so");
    await shot("autopilot-off");
    // Settings › Autopilot no longer lists it
    await pg.goto(`${BASE}/desk/settings`);
    await pg.locator("[data-desk-row='autopilot']").click({ timeout: 20000 });
    await pg.locator("[data-autopilot]").waitFor({ timeout: 10000 });
    check(!/ZT DR Show 1/.test(await pg.locator("[data-autopilot]").innerText()), "Settings › Autopilot: off, so not listed");
    await shut();

    check(failed.filter((f) => !/^(400|503) /.test(f)).length === 0, "no failed requests", failed.join(", "));
    check(d.errors.length === 0, "no page errors", d.errors.join(" | "));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const cl of closers.reverse()) await cl().catch(() => {});
    if (!keep) await down(pool).catch((er) => console.error("down failed", er));
    const realAfter = (await pool.query(REAL_BOTS)).rows[0];
    check(realAfter.h === realBefore.h && String(realAfter.runs) === String(realBefore.runs) && realAfter.episodes === realBefore.episodes, "no real season's bot settings or runs moved");
    check(realAfter.usual === realBefore.usual || keep, "our usual as it was", `${realBefore.usual} -> ${realAfter.usual}`);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
