// Dev-only check for results looked up for a show you watch (src/lib/server/research-asks.ts, db/migrations/0152), Make it a
// game's photos before Looks right (show-art.ts castPhotosFor) and the Cast tab with nothing counted yet, against the dev
// server. Its own people (zt_ra_watcher asks; zt_ra_friend follows on Episode 4; zt_ra_late on Episode 1), nothing shared with
// new-fixture.js's zt_nd_ ones, so it can run beside another session's checks. A stand-in for TVmaze (fake-listings.js) with a
// show of its own pushed in: "ZT Castle Game" (990041), a reality competition, season 5, six weekly episodes, four aired, its
// people in the guest cast with photos; and a stand-in bot (fake-bot.js) answering how it works with a RESEARCHED rulebook
// (researched-traitors.json: what ChatGPT answered for a real Traitors season on 2026-10-27, renamed; no cast names in it), who's
// in it (names, no photos), the recaps, and each episode's full research from the prompt's own skeleton.
//   API:
//   - Make it a game: the review's faces have the guest cast's photos though the answer gave none, and the season has no cast
//     yet; Looks right saves them with the cast; the show plays by its researched rules (made-zt-castle-game), not a built-in.
//   - Nothing counted: the stats have the cast and through 0; Fill in what happened says Episodes 1-4 have no results.
//   - A game on the season (a league row): results aren't ours to look up (null); the game gone, they are again.
//   - Ask: the recaps asked and filled in, Episodes 1-4 queued (waiting); a second ask adds nothing.
//   - The bot's clock (POST /api/cron/bot-research as the VM calls it, with its test clock): one episode a call, in order;
//     Episode 2 fails once, waits two minutes and goes again; Episode 3 fails twice and is given up, so 4 goes; each that
//     ends tells the watcher (the bell: researchDone, no names), nobody else.
//   - The stats: through 4 for the watcher and friend, 1 for late; points as the researched rulebook suggests them.
//   - Try again: Episode 3 asked again and in.
//   In a real browser at --width (390 by default), as the watcher: the review with photos; the Cast tab's faces with nothing
//   counted and the card; the Episodes tab's card with each episode's progress part-way; the Cast tab with stats after, and
//   Try again for the one not found. No page errors; nothing wider than the screen. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; CRON_SECRET in .env.local)
//   node scripts/dev-test/check-research-asks.js <outDir> [--width=390] [--keep] [--api]
//   node scripts/dev-test/check-research-asks.js down            (removes what it made: zt_ra_ people, the show 990041)
//
// It drives the bot's clock route, which plans every season: it stops before calling it if anything that isn't its own is
// due locally. --api: the API half only. --keep leaves what it made. Touches zt rows only; refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-research-asks runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-research-asks.js <outDir> [--width=390] [--keep] [--api]  |  check-research-asks.js down");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");

const PASSWORD = "zt-pass-12345";
const PEOPLE = ["watcher", "friend", "late"];
const TV_ID = 990041;
const SLUG = "zt-castle-game";
const SHOW = "ZT Castle Game";
const CAST = ["Ada Moat", "Bea Tower", "Cal Keep", "Dot Gate", "Eli Hall", "Fay Spire"];
// Stand-in faces (the showcase's, already in the repo), by the cast's made-up names.
const PHOTOS = ["abbey-benjamin", "abby-lee", "arisa-thomas", "ben-mcdonnell", "clyde-moser", "jay-vinnedge"].map((f) => `/mock/showcase/img/the-traitors-us-5/${f}.jpg`);
// Who goes in each episode (murdered: the researched rulebook's way out).
const OUT = { 1: "Ada Moat", 2: "Bea Tower", 3: "Dot Gate", 4: "Cal Keep" };
const RULEBOOK = require("./researched-traitors.json");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fence = "```";

async function down(pool) {
  const { rows } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_ra\\_%'`);
  const ids = rows.map((r) => r.id);
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-ra-%'`);
  await pool.query(`DELETE FROM admin_changes WHERE user_id = ANY($1::text[])`, [ids]);
  // Its season, cast, rulebook, setup, research, results, asks, runs and follows go with the show.
  await pool.query(`DELETE FROM shows WHERE tvmaze_id = $1 OR slug = $2`, [TV_ID, SLUG]);
  await pool.query(`DELETE FROM show_formats WHERE id = $1`, [`made-${SLUG}`]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_ra\\_%'`); // sessions, accounts, notifications cascade
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const users = {};
  for (const who of PEOPLE) {
    users[who] = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const name = `zt_ra_${who}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`,
      [users[who], name, `${name}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(),
      users[who],
      hash,
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [users[who]]);
  }
  return users;
}

/** The show, with its six people in every episode's guest cast (TVmaze's shape: "Self - Contestant"). */
function castleShow() {
  const season = fakeListings.shows().find((s) => s.show.id === 990002).seasons[0]; // a weekly season to borrow the shape of
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const last = now - 3 * DAY;
  const at = (n) => {
    const d = new Date(last - (4 - n) * 7 * DAY);
    d.setUTCHours(1, 0, 0, 0);
    return d;
  };
  const episodes = Array.from({ length: 6 }, (_, i) => ({
    id: 990041500 + i + 1, season: 5, number: i + 1, type: "regular", name: `Night ${i + 1}`,
    airdate: at(i + 1).toISOString().slice(0, 10), airtime: "21:00", airstamp: at(i + 1).toISOString(), runtime: 60,
  }));
  return {
    show: { id: TV_ID, name: SHOW, type: "Reality", genres: ["Mystery"], status: "Running", premiered: episodes[0].airdate, network: { name: "ZT Network", country: { name: "United States", code: "US", timezone: "America/New_York" } }, webChannel: null, image: { medium: "/mock/showcase/art/traitors.jpg", original: "/mock/showcase/art/traitors.jpg" }, url: `https://www.tvmaze.com/shows/${TV_ID}`, schedule: { time: "21:00", days: ["Thursday"] } },
    seasons: [{ season: { ...season.season, id: 9900415, number: 5, episodeOrder: 6, premiereDate: episodes[0].airdate, endDate: episodes[5].airdate }, episodes }],
    guestCast: CAST.map((name, i) => ({ person: { id: 0, name, image: { medium: PHOTOS[i] } }, character: { id: 0, name: "Self - Contestant", image: null }, self: true, voice: false })),
  };
}

/** A full answer from the prompt's own skeleton: everyone answered (high confidence), one murdered, one who did something. */
function fullAnswer(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  const n = Number(a.episodeNumber ?? a.episode ?? (prompt.match(/[Ee]pisode (\d+)/) || [])[1]);
  for (const k of Object.keys(a)) if (a[k] === "unknown") a[k] = "no";
  a.summary = `Night ${n}.`;
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: [`https://example.invalid/castle/${n}`], confidence: "high" });
  }
  const gone = a.castaways.find((c) => c.name === OUT[n]);
  if (!gone || !("leftTheGame" in gone)) throw new Error(`episode ${n}'s skeleton: no ${OUT[n]} or no leftTheGame (${JSON.stringify(a.castaways[0])})`);
  Object.assign(gone, { leftTheGame: "yes", exitMethod: "Murdered" });
  // Something that scores: someone still in answers yes to the first yes/no question that isn't about leaving.
  const doer = a.castaways.find((c) => c.name !== OUT[n]);
  const q = Object.keys(doer).find((k) => doer[k] === "no" && !/left|exit|out/i.test(k));
  if (q) doer[q] = "yes";
  return { n, text: `${fence}json\n${JSON.stringify(a)}\n${fence}` };
}

/** The recaps' answer: a line for each episode asked about. */
function recapAnswer(prompt) {
  const ns = [...prompt.matchAll(/^- Episode (\d+)/gm)].map((m) => Number(m[1]));
  return JSON.stringify({ episodes: ns.map((n) => ({ number: n, summary: `Night ${n} at the castle: someone was murdered.` })) });
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (out === "down") {
    await down(pool);
    await pool.end();
    console.log("down: zt_ra_ people and the show 990041 removed");
    return;
  }
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local: the bot's clock route needs it");
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start({ shows: [...fakeListings.shows(), castleShow()] });
  // Episodes that fail: 2 once, 3 until it's asked again.
  const fails = { 2: 1, 3: Infinity };
  const bot = await fakeBot.start({
    answer: (prompt, kind) => {
      if (kind === "setup") return `Here's how it works:\n${fence}json\n${JSON.stringify(RULEBOOK)}\n${fence}`;
      if (kind === "cast") return `${fence}json\n${JSON.stringify({ castaways: CAST.map((name) => ({ name, photoUrl: "", startingRole: "Faithful" })), sources: ["https://example.invalid/cast"] })}\n${fence}`;
      if (/Search the web for what happened in each/.test(prompt)) return recapAnswer(prompt);
      if (kind === "full") {
        const { n, text } = fullAnswer(prompt);
        if (fails[n] > 0) {
          fails[n]--;
          throw new Error(`the stand-in can't find episode ${n}`);
        }
        return text;
      }
      throw new Error(`no answer for a ${kind} question`);
    },
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  const cron = async (method, now = null) => {
    const r = await fetch(`${BASE}/api/cron/bot-research${now ? `?now=${encodeURIComponent(now.toISOString())}` : ""}`, {
      method,
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...headers },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  /** One call of the bot's clock, as the VM makes it: only when something of ours (and nothing else) is due. */
  const tick = async (now = null) => {
    const due = (await cron("GET", now)).body?.due ?? [];
    const others = due.filter((d) => d.season !== SLUG);
    if (others.length) throw new Error(`something else is due locally (${others.map((d) => `${d.season} ${d.slot}`).join(", ")}): the clock would run it`);
    if (!due.length) return null;
    const r = await cron("POST", now);
    if (r.status !== 200) throw new Error(`the clock: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  let browser = null;
  try {
    const users = await up(pool);
    const as = {};
    for (const who of PEOPLE) as[who] = await api({ user: `zt_ra_${who}`, pass: PASSWORD, headers });
    const added = await as.watcher.call("POST", "/api/me/shows", { listing: TV_ID, seenThrough: 4 });
    if (added.status !== 200) throw new Error(`adding the show: ${added.status} ${JSON.stringify(added.body)}`);
    const sid = added.body.seasonId;
    const recaps = async (who = "watcher") => (await as[who].call("GET", `/api/seasons/${sid}/recaps`)).body;
    const stats = async (who = "watcher") => (await as[who].call("GET", `/api/seasons/${sid}/stats`)).body;
    const statusOf = (r) => Object.fromEntries((r?.results?.asked ?? []).map((a) => [a.episode, a.status]));
    const bell = async (who) =>
      (await pool.query("SELECT title, body, link, key FROM notifications WHERE user_id = $1 AND type = 'researchDone' ORDER BY created_at", [users[who]])).rows;
    const bellAfter = async (who, count) => {
      for (let i = 0; i < 25; i++) {
        const rows = await bell(who);
        if (rows.length >= count) return rows;
        await sleep(200);
      }
      return bell(who);
    };
    const shot = async (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    const wide = async (page) => page.evaluate(() => document.documentElement.scrollWidth);
    if (!apiOnly) {
      browser = await open({ user: "zt_ra_watcher", pass: PASSWORD, width, headers });
      browser.page.on("pageerror", (e) => check(false, "no page errors", e.message));
    }

    // ---- Make it a game: photos before Looks right ----
    const make = (body) => as.watcher.call("POST", `/api/seasons/${sid}/make`, body);
    check((await make({ action: "ask" })).status === 200, "Make it a game: our bot asks");
    for (let i = 0; i < 100; i++) {
      if (!(await as.watcher.call("GET", `/api/seasons/${sid}/make?poll=1`)).body?.asking) break;
      await sleep(300);
    }
    const review = (await as.watcher.call("GET", `/api/seasons/${sid}/make`)).body?.review;
    const faces = review?.cast?.faces ?? [];
    check(faces.length === 6 && faces.every((f) => f.photo === PHOTOS[CAST.indexOf(f.name)]), "the review: all six, each with the guest cast's photo (the answer gave none)", JSON.stringify(faces.map((f) => [f.name, f.photo])));
    check((await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [sid])).rows[0].n === 0, "nothing saved before Looks right");
    check(review?.approvable === true, "the researched rules can be set up", JSON.stringify(review?.problems));
    if (browser) {
      const { page } = browser;
      await page.goto(`${BASE}/show/${sid}/games`);
      await page.locator('[data-play-it="make"] [data-make-it]').waitFor({ timeout: 30_000 });
      await page.locator("[data-make-it]").click();
      await page.locator('[data-make-view="review"]').waitFor({ timeout: 20_000 });
      const imgs = await page.locator("[data-make-cast] img").count();
      check(imgs === 6, "in the browser: the review's six faces are photos", String(imgs));
      await page.locator("[data-make-cast]").scrollIntoViewIfNeeded();
      await shot(page, "1-review-photos");
    }
    check((await make({ action: "confirm" })).status === 200, "Looks right");
    const castRows = (await pool.query("SELECT name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [sid])).rows;
    check(castRows.length === 6 && castRows.every((c) => c.photo_url === PHOTOS[CAST.indexOf(c.name)]), "Looks right saved the cast with the photos the review showed", JSON.stringify(castRows));
    const showRow = (await pool.query("SELECT s.format, sf.proposal FROM shows s LEFT JOIN show_formats sf ON sf.id = s.format WHERE s.tvmaze_id = $1", [TV_ID])).rows[0];
    check(showRow?.format === `made-${SLUG}` && showRow.proposal?.madeFrom === "rulebook", "it plays by its researched rules (its own stored format), not a built-in", JSON.stringify(showRow));

    // ---- nothing counted yet ----
    await as.friend.call("POST", "/api/me/shows", { listing: TV_ID, seenThrough: 4 });
    await as.late.call("POST", "/api/me/shows", { listing: TV_ID, seenThrough: 1 });
    const s0 = await stats();
    check(s0?.through === 0 && s0.cast?.length === 6, "the stats: the six, nothing counted", JSON.stringify({ through: s0?.through, cast: s0?.cast?.length }));
    const r0 = await recaps();
    check(r0?.results?.missing?.join() === "1,2,3,4" && r0.results.asked.length === 0 && r0.missing?.join() === "1,2,3,4", "Fill in what happened: recaps and results missing for Episodes 1-4", JSON.stringify(r0));
    if (browser) {
      const { page } = browser;
      await page.goto(`${BASE}/show/${sid}/cast`);
      await page.locator("[data-no-stats]").waitFor({ timeout: 20_000 });
      check((await page.locator("[data-no-stats] [data-cast]").count()) === 6 && (await page.locator("[data-no-stats] img").count()) === 6, "the Cast tab with nothing counted: the six faces, with photos");
      check((await page.getByText("Nothing to show yet").count()) === 0, "not \"Nothing to show yet\"");
      await page.locator("[data-recaps]").waitFor({ timeout: 10_000 });
      check(/have no results yet/.test(await page.locator("[data-recaps]").innerText()) && (await page.locator("[data-recaps-ask]").count()) === 1, "its card: no results yet, Ask ChatGPT for me");
      check((await wide(page)) <= width, "the Cast tab fits the screen");
      await shot(page, "2-cast-nothing-counted");
    }

    // ---- a game on the season: its results are its games' ----
    const { rows: gate } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ('ZT RA gate', 'zt-ra-gate', $1, jsonb_build_object('settings', jsonb_build_object('showId', $2::text, 'wikiSeason', '5')), $3) RETURNING id`,
      [`ZTRA${Date.now() % 100000}`, SLUG, users.watcher]
    );
    check((await recaps())?.results === null, "with a game on the season, its results aren't ours to look up");
    await pool.query("DELETE FROM leagues WHERE id = $1", [gate[0].id]);
    check(Array.isArray((await recaps())?.results?.missing), "the game gone, they are again");

    // ---- ask ----
    const asked = await as.watcher.call("POST", `/api/seasons/${sid}/recaps`, { action: "ask" });
    check(asked.status === 200 && JSON.stringify(statusOf(asked.body)) === JSON.stringify({ 1: "waiting", 2: "waiting", 3: "waiting", 4: "waiting" }) && asked.body.results.missing.length === 0, "Ask: Episodes 1-4 queued, each waiting its turn", JSON.stringify(asked.body?.results));
    for (let i = 0; i < 60; i++) {
      if (!(await recaps())?.asking) break;
      await sleep(300);
    }
    check((await recaps())?.missing?.length === 0, "the recaps filled in alongside");
    const again = await as.watcher.call("POST", `/api/seasons/${sid}/recaps`, { action: "ask" });
    check(again.status === 409, "a second ask has nothing to add", `${again.status}`);
    check((await recaps("friend"))?.results?.asked?.length === 4, "the friend sees the same progress (results are the season's)");

    // ---- the bot's clock ----
    const t0 = Date.now();
    const at = (min) => new Date(t0 + min * 60_000);
    const run1 = await tick();
    check(run1?.job?.slot === "asked" && run1.job.episode === 1 && run1.ok === true && run1.asked?.ok === true, "the clock: Episode 1 first, in", JSON.stringify(run1));
    check(JSON.stringify(statusOf(await recaps())) === JSON.stringify({ 1: "done", 2: "waiting", 3: "waiting", 4: "waiting" }), "1 in, the rest waiting");
    const b1 = await bellAfter("watcher", 1);
    check(b1.length === 1 && /Episode 1's results are in/.test(b1[0].title) && /Players tab counts them/.test(b1[0].body) && b1[0].link === `/show/${sid}/cast` && !CAST.some((n) => b1[0].body.includes(n)), "the watcher hears Episode 1 is in (no names), opening the Cast tab", JSON.stringify(b1));
    check((await bell("friend")).length === 0, "the friend isn't told (they didn't ask)");
    if (browser) {
      const { page } = browser;
      await page.goto(`${BASE}/show/${sid}/episodes`);
      await page.locator("[data-results-progress]").waitFor({ timeout: 20_000 });
      check(
        (await page.locator('[data-result-ep="1"][data-status="done"]').count()) === 1 && (await page.locator('[data-result-ep="4"][data-status="waiting"]').count()) === 1 && /1 of 4 in/.test(await page.locator("[data-results-count]").innerText()),
        "the Episodes tab's card: 1 of 4 in, the rest waiting"
      );
      check((await wide(page)) <= width, "the Episodes tab fits the screen");
      await shot(page, "3-episodes-progress");
    }
    const run2 = await tick();
    check(run2?.job?.episode === 2 && run2.ok === false && !run2.asked, "Episode 2's first try fails; it isn't given up", JSON.stringify(run2));
    check((await tick(at(1))) === null, "the season waits: nothing due until two minutes on (3 and 4 wait behind 2)");
    const run3 = await tick(at(3));
    check(run3?.job?.episode === 2 && run3.ok === true, "two minutes on, Episode 2 again: in", JSON.stringify(run3));
    const run4 = await tick(at(3));
    const run5 = await tick(at(6));
    check(run4?.job?.episode === 3 && run4.ok === false && run5?.job?.episode === 3 && run5.ok === false && run5.asked?.ok === false, "Episode 3 fails twice and is given up", JSON.stringify([run4, run5]));
    const run6 = await tick(at(6));
    check(run6?.job?.episode === 4 && run6.ok === true, "so Episode 4 goes", JSON.stringify(run6));
    check((await tick(at(9))) === null, "then nothing's due");
    check(JSON.stringify(statusOf(await recaps())) === JSON.stringify({ 1: "done", 2: "done", 3: "failed", 4: "done" }), "1, 2 and 4 in; 3 not found");
    const b2 = await bellAfter("watcher", 4);
    check(b2.length === 4 && b2.some((n) => /Couldn't find Episode 3's results/.test(n.title) && n.link === `/show/${sid}/episodes`), "told of each: three in, and Episode 3 not found", JSON.stringify(b2.map((n) => n.title)));

    // ---- the stats ----
    const s1 = await stats();
    const pts = (s1?.cast ?? []).map((c) => c.points);
    check(s1?.through === 4 && s1.pointsFrom === null && pts.some((p) => p !== 0), "the stats: through 4, points as the researched rulebook suggests them", JSON.stringify({ through: s1?.through, pointsFrom: s1?.pointsFrom, pts }));
    check(s1?.cast?.find((c) => c.name === "Ada Moat")?.out === 1 && s1.cast.find((c) => c.name === "Cal Keep")?.out === 4, "who's out, and when");
    check((await stats("friend"))?.through === 4 && (await stats("late"))?.through === 1, "the friend's through 4, late's through 1 (never past where they are)");
    if (browser) {
      const { page } = browser;
      await page.goto(`${BASE}/show/${sid}/cast`);
      await page.locator("[data-explorer]").first().waitFor({ timeout: 20_000 });
      check((await page.locator("[data-no-stats]").count()) === 0 && (await page.locator("[data-slider]").count()) === 1, "the Cast tab counts now: the explorer, its episode slider");
      check(/Try again/.test(await page.locator("[data-recaps-ask]").innerText()) && (await page.locator('[data-result-ep="3"][data-status="failed"]').count()) === 1, "its card: Episode 3 not found, Try again");
      check((await wide(page)) <= width, "the Cast tab fits the screen");
      await shot(page, "4-cast-counted");
      await page.locator("[data-recaps-ask]").click();
      await page.locator('[data-result-ep="3"][data-status="waiting"]').waitFor({ timeout: 10_000 }).catch(() => {});
      check((await page.locator('[data-result-ep="3"][data-status="waiting"]').count()) === 1, "Try again: Episode 3 waits its turn again");
    } else {
      check((await as.watcher.call("POST", `/api/seasons/${sid}/recaps`, { action: "ask" })).status === 200, "Try again");
    }

    // ---- try again ----
    fails[3] = 0;
    const run7 = await tick(at(10));
    check(run7?.job?.episode === 3 && run7.ok === true, "Episode 3 asked again: in", JSON.stringify(run7));
    check(JSON.stringify(statusOf(await recaps())) === JSON.stringify({ 1: "done", 2: "done", 3: "done", 4: "done" }) && (await recaps()).results.missing.length === 0, "all four in");
    check((await bellAfter("watcher", 5)).length === 5, "and told");
    if (browser) {
      const { page } = browser;
      await page.goto(`${BASE}/show/${sid}/cast`);
      await page.locator("[data-slider]").waitFor({ timeout: 20_000 });
      check((await page.locator("[data-recaps]").count()) === 0, "with every episode's results in, the card's gone");
      await shot(page, "5-cast-all-in");
    }
  } finally {
    if (browser) await browser.close();
    await bot.close();
    await tv.close();
    if (!keep) await down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
