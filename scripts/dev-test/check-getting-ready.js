// Dev-only check for Getting it ready (docs/PLAN-getting-it-ready.md; src/lib/server/season-fill.ts, src/new/show/getting-ready.tsx),
// against the dev server, on new-fixture.js's couch with a stand-in for TVmaze (fake-listings.js) and for our bot (fake-bot.js),
// both reached through the dev server's headers.
//   In a real browser at --width (390 by default), alex adds ZT Love Shack (a brand-new show, 3 of 8 out) from Home's Add a show:
//   Where are you offers to look up all 3; Add plays the call sheet (how it's played, then the cast's faces, then the episodes'
//   tiles); Done, and Home's poster is a no-signal card while it goes; the show's header has the chip and the line, its Episodes
//   the filmstrip card. Screenshots go to <outDir>.
//   API:
//   - the brand-new show made a game by itself (unreviewed, "by itself" in the desk's History), its cast in, what happened in
//     each aired episode filled in, each episode's results queued for the bot's clock;
//   - a show that's a game with a season nobody's cast: the header says missing; started, our bot finds the cast and it's sent;
//   - our bot away: the job waits saying so; the free way, Ask ChatGPT yourself: the cast's question, a paste that can't be read
//     refused, the answer pasted and sent; the Contestants tab's casting wall while it waits (a screenshot);
//   - a brand-new show with our bot away: how it works pasted, its characters from the TV listing, set up with no bot; the
//     episodes' question asked and pasted;
//   - an answer that can't be read, three times: stopped partway, then Try again starts it over and it finishes;
//   - only someone who follows the season starts it; nothing to get, nothing written.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-getting-ready.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it; its down removes the shows zt_nd people
// added, with their seasons and these jobs); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-getting-ready runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-getting-ready.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const answerFrom = (id, show) => `Here's the rulebook:\n\`\`\`json\n${JSON.stringify({ ...clone(LIBRARY[id].blocks), show }, null, 1)}\n\`\`\``;
const castAnswer = (people) => `\`\`\`json\n${JSON.stringify({ castaways: people.map(([name, group]) => ({ name, photoUrl: "", startingGroup: group })), sources: ["https://example.invalid/cast"] })}\n\`\`\``;
/** What happened, for every episode the recap prompt lists. */
const recapAnswer = (prompt) => JSON.stringify({ episodes: [...prompt.matchAll(/^- \w+ (\d+)/gm)].map((m) => ({ number: Number(m[1]), summary: `In episode ${m[1]} things happened and someone left.` })) });
const SHACK = [["Gia Heart", null], ["Hal Rose", null], ["Ivy Kiss", null], ["Jon Date", null], ["Kay Vow", null], ["Lou Ring", null], ["Max Flirt", null]];
const ANSWERS = {
  "ZT Love Shack": { setup: () => answerFrom("the-amazing-race", "ZT Love Shack"), cast: () => castAnswer(SHACK) },
  "ZT Yacht Life": { setup: () => answerFrom("below-deck", "ZT Yacht Life") },
  "ZT Drop Show": { setup: () => answerFrom("scrubs", "ZT Drop Show") },
};
const showIn = (prompt) => Object.keys(ANSWERS).find((name) => prompt.includes(name));

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  let garbage = 0;
  const bot = await fakeBot.start({
    delayMs: 300,
    answer: (prompt, kind) => {
      if (garbage > 0) {
        garbage--;
        return "I couldn't find anything about that.";
      }
      if (kind === "other" && /Search the web for what happened/.test(prompt)) return recapAnswer(prompt);
      const fn = ANSWERS[showIn(prompt)]?.[kind];
      if (!fn) throw new Error(`no answer for ${kind} about ${showIn(prompt) ?? "?"}`);
      return fn();
    },
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const as = {};
    for (const who of ["alex", "riley", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD, headers });
    const add = async (who, listing, seenThrough = 0) => {
      const r = await as[who].call("POST", "/api/me/shows", { listing, seenThrough });
      if (r.status !== 200) throw new Error(`adding ${listing}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body.seasonId;
    };
    const state = async (sid) => (await as.alex.call("GET", `/api/seasons/${sid}/fill`)).body;
    const post = (who, sid, body) => as[who].call("POST", `/api/seasons/${sid}/fill`, body);
    /** Until the job's past `until` (polled as the page does, carrying on a run that stopped, as the page does). */
    const until = async (sid, ok, ms = 60000) => {
      const t0 = Date.now();
      let s = await state(sid);
      while (!ok(s) && Date.now() - t0 < ms) {
        if (s.due) await post("alex", sid, { action: "go" });
        await sleep(400);
        s = await state(sid);
      }
      return s;
    };
    const header = async (sid) => (await as.alex.call("GET", `/api/seasons/${sid}/space`)).body;
    const castOf = async (sid) => (await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [sid])).rows.map((r) => r.name);
    const showOf = async (sid) => (await pool.query("SELECT s.* FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = $1", [sid])).rows[0];
    const summaries = async (sid) => (await pool.query("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1 AND summary IS NOT NULL", [sid])).rows[0].n;
    /** Ready for another run now (the job waits a few minutes after a failed try). */
    const due = (sid) => pool.query("UPDATE season_fills SET tried_at = now() - interval '1 hour' WHERE season_id = $1", [sid]);

    // ---- in a browser: Add a show, and it gets ready ----
    let shack;
    if (!apiOnly) {
      bot.delayMs = 3500;
      const A = await open({ user: "zt_nd_alex", pass: fixture.PASSWORD, width, motion: "on", headers });
      close = A.close;
      const page = A.page;
      await page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
      let n = 0;
      const shot = async (name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      await page.goto(`${A.BASE}/home`);
      await page.locator("[data-add-show-poster]").click();
      await page.locator("[data-add-input]").fill("ZT Love Shack");
      const row = page.locator('[data-hit="ZT Love Shack"]').first();
      await row.waitFor({ timeout: 20000 });
      await row.click();
      await page.locator('[data-setting="where-look-up"]').waitFor({ timeout: 20000 });
      const looks = await page.locator('[data-setting="where-look-up"]').textContent();
      check(/Look up all 3 that are out/.test(looks ?? ""), "Where are you offers to look up all 3 that are out, on", looks);
      await shot("where-look-up");
      await page.locator("[data-where-save]").click();
      await page.locator("[data-added-ready]").waitFor({ timeout: 20000 });
      await page.waitForTimeout(1200);
      await shot("call-sheet-rules");
      const line0 = await page.locator("[data-call-line]").textContent();
      check(/Reading how it's played|Finding the/.test(line0 ?? ""), "the call sheet: what's happening now", line0);
      check((await page.locator('[data-slate="rules"]').count()) === 1 && (await page.locator('[data-slate="cast"]').count()) === 1 && (await page.locator('[data-slate="episodes"]').count()) === 1, "a slate a step: how it's played, the cast, the episodes");
      check((await page.locator("[data-fill-paste]").count()) === 1, "Ask ChatGPT yourself is on the step it's on");
      check((await page.locator('[data-slate][data-state="working"] [data-cue]').count()) === 1 && (await page.locator('[data-slate][data-state="next"]').count()) >= 1, "the working step's cue bar (an estimate), the steps to come ghosted");
      check(/about|any moment/i.test((await page.locator("[data-call-line]").textContent()) ?? ""), "the line says roughly how long", await page.locator("[data-call-line]").textContent());
      await page.locator('[data-slate="cast"][data-state="working"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(900);
      await shot("call-sheet-cast");
      await page.locator('[data-frames="in"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(900);
      await shot("call-sheet-faces");
      shack = (await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.tvmaze_id = 990001 ORDER BY ss.season_number DESC LIMIT 1")).rows[0].id;
      // Done: it carries on, and Home's poster says so.
      await page.locator("[data-added-done]").click();
      await page.locator(`[data-poster="${shack}"] [data-no-signal]`).waitFor({ timeout: 20000 });
      await page.locator(`[data-poster="${shack}"]`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await shot("home-no-signal");
      check((await page.locator(`[data-poster="${shack}"] [data-ready-tag]`).count()) === 1, "Home's poster: a no-signal card tagged Getting ready");
      await page.goto(`${A.BASE}/show/${shack}/episodes`);
      await page.locator("[data-ready-chip]").waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot("show-header-chip");
      check((await page.locator("[data-ready-line]").count()) === 1, "the show's header: the chip and the line in the show's colour");
      await page.locator("[data-episodes-coming], [data-tile]").first().waitFor({ timeout: 30000 }).catch(() => null);
      await page.waitForTimeout(4000);
      await shot("episodes-filmstrip");
      await page.locator("[data-ready-chip]").click();
      await page.locator("[data-getting-ready-sheet]").waitFor({ timeout: 10000 });
      await page.waitForTimeout(700);
      await shot("sheet-from-header");
      const browse = (await page.locator("[data-browse]").count()) ? await page.locator("[data-browse]").innerText() : "";
      check(/What happened is in|Leg 1 is in|Episode 1 is in/i.test(browse) && /let you know when they.re all in/.test(browse) && /look around/i.test(browse), "once the first is in: we'll grab the rest and let you know, look around meanwhile", browse);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "nothing wider than the screen");
      check(!A.errors.length, "no page errors", A.errors.slice(0, 3).join(" | "));
      await close();
      close = async () => {};
      bot.delayMs = 300;
    } else {
      shack = await add("alex", 990001, 1);
      const s = await post("alex", shack, { action: "start", episodes: true });
      check(s.status === 200 && s.body.status === "going" && s.body.steps.map((x) => x.key).join() === "rules,cast,episodes", "started: going, three steps", JSON.stringify(s.body).slice(0, 200));
    }

    // ---- what it made ----
    const s1 = await until(shack, (s) => (s.steps[1]?.state === "done" && s.episodes.length > 0 && s.episodes.every((e) => e.state === "half")) || s.status === "stuck");
    check(s1.steps.map((x) => x.state).join() === "done,done,working", "the brand-new show: how it's played and the cast in, the episodes' results still to come", JSON.stringify(s1.steps));
    const show1 = await showOf(shack);
    check(!!show1.set_up_at && show1.kind === "competition", "it's a game now, by itself", `${show1.set_up_at} ${show1.kind}`);
    const { rows: book } = await pool.query("SELECT r.review_status, r.provenance FROM rulebooks r JOIN show_seasons ss ON ss.rulebook_id = r.id WHERE ss.id = $1", [shack]);
    check(book[0]?.review_status === "unreviewed" && book[0].provenance.auto === true, "its rulebook: new until another couch checks it, made by itself", JSON.stringify(book[0]));
    const { rows: hist } = await pool.query("SELECT text FROM admin_changes WHERE entity = 'rulebook' ORDER BY created_at DESC LIMIT 1");
    check(/ZT Love Shack 1 made a game \(by itself, as it was added\)/.test(hist[0]?.text ?? ""), "the desk's History says so", hist[0]?.text);
    check((await castOf(shack)).length === 7 && s1.cast.count === 7 && s1.cast.faces[0].name === "Gia Heart", "its cast: all 7, the call sheet's faces too");
    check((await summaries(shack)) === 3, "what happened in each of the 3 aired episodes, filled in");
    const { rows: asks } = await pool.query("SELECT episode_number FROM research_asks WHERE season_id = $1 ORDER BY 1", [shack]);
    check(asks.map((a) => a.episode_number).join() === "1,2,3" && s1.status === "going" && s1.episodes.every((e) => e.state === "half"), "each episode's results queued for the bot's clock: still going, the tiles half lit", `${asks.length} ${s1.status} ${JSON.stringify(s1.episodes)}`);
    check((await header(shack)).filling === "going", "the header says going while the results come in");
    check((await pool.query("SELECT bool_and(quiet) AS q FROM research_asks WHERE season_id = $1", [shack])).rows[0].q === true, "the job's own asks are quiet: no notification an episode");
    // The bot's clock would ask them one at a time; this check stops there, and the clock's next call tells alex it's all in.
    await pool.query("DELETE FROM research_asks WHERE season_id = $1", [shack]);
    if (process.env.CRON_SECRET) {
      await fetch(`${require("./browser").BASE}/api/cron/bot-research`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...headers } });
      let told = [];
      for (let i = 0; i < 25 && !told.length; i++) {
        told = (await pool.query("SELECT title, body, link FROM notifications WHERE user_id = $1 AND type = 'researchDone' AND key = $2", [fx.users.alex, `ready:${shack}`])).rows;
        if (!told.length) await sleep(200);
      }
      check(told.length === 1 && /ZT Love Shack 1 is ready/.test(told[0].title) && /All 3 legs are in/.test(told[0].body) && told[0].link === `/show/${shack}/episodes`, "all in: one notification, to whoever added it", JSON.stringify(told));
      await fetch(`${require("./browser").BASE}/api/cron/bot-research`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...headers } });
      check((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND key = $2", [fx.users.alex, `ready:${shack}`])).rows[0].n === 1, "told once, not again on the next call");
    }
    const s1b = await state(shack);
    check(s1b.status === "done" && (await header(shack)).filling === null, "with nothing more coming it's done, and the header says nothing", `${s1b.status}`);
    const stillAlex = (await pool.query("SELECT started_by FROM season_fills WHERE season_id = $1", [shack])).rows[0]?.started_by;
    check(stillAlex === fx.users.alex, "the job is alex's");

    // ---- a show that's a game, a season nobody's cast ----
    const unCast = async () => {
      await pool.query("DELETE FROM season_cast_answers WHERE season_id = $1", [shack]);
      await pool.query("DELETE FROM season_cast WHERE season_id = $1", [shack]);
      await pool.query("UPDATE show_seasons SET cast_approved_at = NULL, cast_approved_by = NULL, cast_size = NULL WHERE id = $1", [shack]);
      await pool.query("DELETE FROM season_fills WHERE season_id = $1", [shack]);
    };
    await unCast();
    check((await header(shack)).filling === "missing", "a game's season with nobody in its cast and no job: missing");
    check((await post("casey", shack, { action: "start" })).status === 403, "someone who doesn't follow it can't start it");
    const asked0 = bot.asked.length;
    await post("alex", shack, { action: "start", episodes: false });
    const s2 = await until(shack, (s) => s.status !== "going");
    check(s2.status === "done" && (await castOf(shack)).length === 7 && s2.steps.map((x) => x.key).join() === "rules,cast", "our bot found who's in it and it was sent (the episodes left)", JSON.stringify(s2.steps));
    check(bot.asked.slice(asked0).map((q) => q.kind).join() === "cast", "it asked only for the cast", bot.asked.slice(asked0).map((q) => q.kind).join());
    const { rows: ans } = await pool.query("SELECT source, sent_at IS NOT NULL AS sent FROM season_cast_answers WHERE season_id = $1", [shack]);
    check(ans.length === 1 && ans[0].source === "bot" && ans[0].sent, "the answer is kept, sent, as the desk's would be");
    const again = await post("alex", shack, { action: "start", episodes: false });
    check(again.body.status === "done" && (await pool.query("SELECT done_at FROM season_fills WHERE season_id = $1", [shack])).rows[0].done_at, "nothing left to get: starting it again writes nothing new");

    // ---- our bot away: the free way ----
    await unCast();
    bot.down = true;
    await post("alex", shack, { action: "start", episodes: false });
    const s3 = await until(shack, (s) => s.away);
    check(s3.status === "going" && s3.away && s3.step === "cast", "our bot's away: it waits on the cast, saying so", JSON.stringify({ away: s3.away, step: s3.step }));
    const q3 = (await as.alex.call("GET", `/api/seasons/${shack}/fill?prompt=1`)).body;
    check(q3.step === "cast" && /List the full starting cast of/.test(q3.prompt ?? ""), "Ask ChatGPT yourself: the cast's question", (q3.prompt ?? JSON.stringify(q3)).slice(0, 120));
    check((await post("alex", shack, { action: "paste", answer: "Sorry, I can't help with that." })).status === 400, "an answer nobody can be read from is refused");
    if (!apiOnly) {
      const B = await open({ user: "zt_nd_alex", pass: fixture.PASSWORD, width, motion: "on", headers });
      close = B.close;
      await B.page.goto(`${B.BASE}/show/${shack}/cast`);
      await B.page.locator("[data-cast-coming]").waitFor({ timeout: 30000 });
      await B.page.waitForTimeout(1200);
      await B.page.screenshot({ path: path.join(out, "20-cast-coming-bot-away.png") });
      check((await B.page.locator("[data-cast-coming-paste]").count()) === 1, "the Contestants tab: the casting wall, and Ask ChatGPT yourself");
      await B.page.locator("[data-cast-coming-paste]").click();
      await B.page.locator('[data-ask-ai="fill-cast"]').waitFor({ timeout: 15000 });
      await B.page.waitForTimeout(800);
      await B.page.screenshot({ path: path.join(out, "21-ask-chatgpt-yourself.png") });
      check(!B.errors.length, "no page errors", B.errors.slice(0, 3).join(" | "));
      await close();
      close = async () => {};
    }
    const p3 = await post("alex", shack, { action: "paste", answer: castAnswer(SHACK) });
    check(p3.status === 200 && (await castOf(shack)).length === 7, "pasted: the cast's in", JSON.stringify(p3.body).slice(0, 160));
    const s3b = await until(shack, (s) => s.status !== "going");
    check(s3b.status === "done", "and the job's done with no bot", s3b.status);

    // ---- a brand-new show, our bot away ----
    const drop = await add("alex", 990004, 0);
    await post("alex", drop, { action: "start", episodes: true });
    const s4 = await until(drop, (s) => s.away);
    check(s4.away && s4.step === "rules", "a brand-new show: waiting on how it's played", JSON.stringify({ away: s4.away, step: s4.step }));
    const q4 = (await as.alex.call("GET", `/api/seasons/${drop}/fill?prompt=1`)).body;
    check(q4.step === "rules" && /ZT Drop Show/.test(q4.prompt ?? ""), "its question is how it works", (q4.prompt ?? JSON.stringify(q4)).slice(0, 80));
    await post("alex", drop, { action: "paste", answer: answerFrom("scrubs", "ZT Drop Show") });
    const s4b = await until(drop, (s) => s.step === "episodes" || s.status !== "going");
    const show4 = await showOf(drop);
    check(!!show4.set_up_at && (await castOf(drop)).length === 2, "pasted how it works: its characters from the TV listing, a game with no bot", `${show4.set_up_at} ${(await castOf(drop)).join()}`);
    check(s4b.step === "episodes" && s4b.away, "then the episodes wait for our bot too", JSON.stringify({ step: s4b.step, away: s4b.away }));
    const q5 = (await as.alex.call("GET", `/api/seasons/${drop}/fill?prompt=1`)).body;
    check(q5.step === "episodes" && /Search the web for what happened/.test(q5.prompt ?? ""), "the episodes' question", (q5.prompt ?? "").slice(0, 80));
    await post("alex", drop, { action: "paste", answer: recapAnswer(q5.prompt) });
    check((await summaries(drop)) === 4, "pasted: what happened in all 4");
    bot.down = false;

    // ---- an answer that can't be read, three times ----
    const yacht = await add("alex", 990011, 0);
    garbage = 99;
    await post("alex", yacht, { action: "start", episodes: false });
    let s6 = await until(yacht, (s) => !s.asking && (s.status === "stuck" || s.step !== "rules" || !s.due), 20000);
    for (let i = 0; i < 4 && s6.status !== "stuck"; i++) {
      await due(yacht);
      await post("alex", yacht, { action: "go" });
      await sleep(800);
      s6 = await until(yacht, (s) => !s.asking, 20000);
    }
    check(s6.status === "stuck" && !!s6.message && (await header(yacht)).filling === "stuck", "three tries: stopped partway, saying why", JSON.stringify({ status: s6.status, message: s6.message }));
    garbage = 0;
    await post("alex", yacht, { action: "retry" });
    const s6b = await until(yacht, (s) => s.status !== "going");
    // ---- a newer season than any here can be added (search, the user's Challenge 42 case) ----
    if (!apiOnly) {
      // ZT Love Shack's season 1 here, finished, while its listing runs on: the listing is offered too, as its latest season.
      await pool.query("UPDATE show_seasons SET status = 'completed' WHERE id = $1", [shack]);
      const C = await open({ user: "zt_nd_riley", pass: fixture.PASSWORD, width, motion: "off", headers });
      close = C.close;
      await C.page.goto(`${C.BASE}/home`);
      await C.page.locator("[data-add-show-poster]").click();
      await C.page.locator("[data-add-input]").fill("ZT Love Shack");
      await C.page.locator('[data-hit="ZT Love Shack"][data-hit-kind="listing"]').first().waitFor({ timeout: 20000 }).catch(() => null);
      const kinds = await C.page.locator("[data-hit]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-hit")}:${e.getAttribute("data-hit-kind")}:${/Latest season/.test(e.textContent ?? "")}`));
      check(kinds.includes("ZT Love Shack:listing:true"), "a linked show whose seasons here are finished: its listing offered as the latest season", kinds.join(" | "));
      // The season's deleted (on the desk) after the list was read: picking it adds it from its TV listing instead.
      await pool.query("DELETE FROM show_seasons WHERE id = $1", [shack]);
      await C.page.locator('[data-hit="ZT Love Shack 1"][data-hit-kind="season"]').first().click();
      await C.page.locator("[data-where-save]").waitFor({ timeout: 20000 });
      await C.page.locator("[data-where-save]").click();
      await C.page.locator("[data-added-ready]").waitFor({ timeout: 20000 }).catch(() => null);
      const again = (await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.tvmaze_id = 990001")).rows;
      check((await C.page.locator("[data-added-ready]").count()) === 1 && again.length === 1 && again[0].id !== shack, "a season deleted since the list was read: added from its TV listing instead, not 'Season not found'", `${again.length}`);
      await close();
      close = async () => {};
    }

    check(s6b.status === "done" && !!(await showOf(yacht)).set_up_at && (await castOf(yacht)).length > 0, "Try again: it starts over and finishes", JSON.stringify({ ...s6b, cast: s6b.cast.count, episodes: undefined, artUrl: undefined, backdropUrl: undefined }));
    if (s6b.status !== "done") console.log("   job:", JSON.stringify((await pool.query("SELECT * FROM season_fills WHERE season_id = $1", [yacht])).rows[0]), "\n   setup:", JSON.stringify((await pool.query("SELECT stage, asking_at, message, rules_answer IS NOT NULL AS rules, cast_answer IS NOT NULL AS cast FROM show_setups WHERE season_id = $1 ORDER BY created_at DESC", [yacht])).rows));
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e.stack || e);
  } finally {
    await close().catch(() => {});
    await tv.close();
    await bot.close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
