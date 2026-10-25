// Dev-only check for how results get in (docs/PLAN-new-design.md step 6c), against the dev server, on new-fixture.js
// (couch A "ZT Survivor 51": alex runs its three games, riley a Game admin of one, jordan and sam play; couch B "ZT
// Extra": alex runs it, casey plays) and a stand-in for the ask-AI bot (fake-bot.js, reached through the dev-only
// x-gys-bot header, so neither ChatGPT nor production's VM is asked). The season is moved so Episode 6 ended six
// minutes ago, with nothing in.
//   1. The ways: One tap locked, Autopilot off, the bot answering, the prices; a bot that's down says so; someone off
//      the couch is refused.
//   2. One tap, who went home: free, whoever runs a game; a second tap joins the run in flight (the bot is asked once);
//      the answer is a source counted as whoever tapped (source bot), reaching every league on the season, one line in
//      couch A's Recent changes; nothing in the run names who went home. Undo takes it back.
//   3. A quick check that can't be sure is kept (One tap's, and a pasted one): it waits in couch A's Backstage (not couch
//      B's), names only with Show me; It's right applies it and closes it, Not right closes it with who you entered.
//      "Couldn't find it yet" isn't kept.
//   4. The browser at --width, as alex: How results get in (copy and paste now; One tap $1 and its unlock sheet;
//      Autopilot coming soon), the sheet leading with "Ask ChatGPT for me" (who went home free), searching, applied;
//      a wait from One tap, Show me, It's right; the full results locked at $1, Copy and paste it yourself, then one tap
//      that unlocks One tap for the couch and applies.
//   5. One tap for the full results: locked until someone unlocks it (couch B stays locked; a line in Recent changes);
//      sam can't before he's seen the episode; a bot that doesn't answer fails the run with a reason. jordan (a player)
//      fills it in from Tonight with One tap.
//   6. Autopilot's engine (the bot's schedule, an admin's switch): the scheduled quick check that isn't sure waits on
//      every couch and counts as a failed try; the retry that's sure reaches every league (source autopilot, nobody's
//      line); the full run an hour on fills every point in; Full scores says "filled in by our bot".
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/check-new-results-ways.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database,
// and stops if any other local season has bot research on (the scheduled runs would share the clock). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./new-fixture");
const fakeBot = require("./fake-bot");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-results-ways runs against a local database only");
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-results-ways.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const OUT6 = "Cristian Chavez";
const quickAnswer = (left, sources = 2, found = true) =>
  "Here's what I found:\n```json\n" +
  JSON.stringify({ found, episodeTitle: null, left, headline: found ? "A blindside at Tribal." : "", sources: Array.from({ length: sources }, (_, i) => `https://news${i}.example/ep6`) }) +
  "\n```";
const VOTED = [{ name: OUT6, how: "Voted Out" }];

// A full answer from the prompt's own skeleton: everyone answered (high confidence), Cristian voted out, Danny's immunity.
function fullAnswer(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode six.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  const who = (name) => a.castaways.find((c) => c.name === name);
  Object.assign(who(OUT6), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5 });
  Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  return "```json\n" + JSON.stringify(a) + "\n```";
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const bot = await fakeBot.start({});
  closers.push(bot.close);
  try {
    const others = (await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on AND s.slug <> 'zt-nd-survivor'")).rows;
    if (others.length) throw new Error(`another local season has bot research on (${others.map((r) => r.slug).join(", ")}): it would share the clock`);
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const A = `?couch=${fx.couchId}`;
    const B = `?couch=${fx.extraCouchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    // Episode 6 (weekly from the premiere, 90 minutes) ended six minutes ago: the scheduled runs' test clock stays near
    // the real one, as their retries count from when a try really started.
    await pool.query(
      `UPDATE show_seasons SET air_time = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::time,
              premiere_date = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::date - 35 WHERE id = $1`,
      [sid]
    );
    const { rows: endRow } = await pool.query("SELECT ((((premiere_date + 35) + air_time) AT TIME ZONE air_tz) + interval '90 minutes') AS ended FROM show_seasons WHERE id = $1", [sid]);
    const ended = endRow[0].ended.getTime();

    const H = { "x-gys-bot": bot.url };
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD, headers: H });
    const ep6 = async (key) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]]);
      const ep = rows[0].state.episodes.find((e) => e.number === 6) || { events: [], scoringEvents: [] };
      return { outs: ep.events.length, events: (ep.scoringEvents || []).length, stage: ep.events.length || (ep.scoringEvents || []).length ? ep.resultsStage || "final" : null };
    };
    const all6 = () => Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    const subs = async () =>
      (await pool.query(`SELECT er.id, source, submitted_by, couch_id, covers, withdrawn_at FROM episode_research er JOIN shows s ON s.id = er.show_id WHERE s.slug = 'zt-nd-survivor' AND source <> 'combined' ORDER BY researched_at`)).rows;
    const linesOf = async (k, kind) => (await pool.query("SELECT text, batch, detail, undone_at FROM league_changes WHERE league_id = $1 AND kind = $2 ORDER BY created_at", [L[k], kind])).rows;
    const undo = (who, batch, couch = A) => as[who].call("POST", `/api/seasons/${sid}/changes/${encodeURIComponent(batch)}/undo${couch}`);
    const backstage = async (who = "alex", couch = A, show = false) => (await as[who].call("GET", `/api/seasons/${sid}/backstage${couch}&episode=6${show ? "&show=1" : ""}`)).body;
    const ways = async (who = "alex", couch = A) => as[who].call("GET", `/api/seasons/${sid}/backstage/ways${couch}`);
    const finish = async (who, run, couch = A) => {
      let r = run;
      for (let i = 0; i < 60 && r.status === "running"; i++) {
        await new Promise((res) => setTimeout(res, 400));
        r = (await as[who].call("GET", `/api/seasons/${sid}/backstage/ask${couch}&run=${run.id}`)).body;
      }
      return r;
    };
    const tap = async (who, kind, couch = A) => {
      const s = await as[who].call("POST", `/api/seasons/${sid}/backstage/ask${couch}`, { episode: 6, kind });
      return s.status === 200 ? { status: 200, run: await finish(who, s.body, couch) } : { status: s.status, body: s.body };
    };
    const nothingIn = async (what) => check((await all6()).every((e) => !e.outs && !e.events), what, JSON.stringify(await all6()));

    // ---- 1. the ways ----
    const w0 = await ways();
    check(w0.status === 200 && !w0.body.tap.unlocked && w0.body.canUnlock && !w0.body.autopilot.quick && !w0.body.autopilot.full, "alex: One tap locked (he may unlock it), Autopilot off", JSON.stringify(w0.body));
    check(w0.body.bot.available && w0.body.prices.tap === 100 && w0.body.prices.autopilot === 500 && w0.body.prices.autopilotAfterTap === 400, "the bot answers; $1, $5, $4 after One tap");
    const dead = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers: { "x-gys-bot": "http://127.0.0.1:9" } });
    check((await dead.call("GET", `/api/seasons/${sid}/backstage/ways${A}`)).body.bot?.available === false, "a bot that's down: not available");
    check((await dead.call("POST", `/api/seasons/${sid}/backstage/ask${A}`, { episode: 6, kind: "quick" })).status === 503, "and One tap says so (503) rather than asking");
    check((await ways("sam")).status === 200, "sam (a player) reads the ways");
    check([403, 404].includes((await ways("casey")).status), "casey, off couch A, is refused");

    // ---- 2. One tap: who went home ----
    check((await as.jordan.call("POST", `/api/seasons/${sid}/backstage/ask${A}`, { episode: 6, kind: "quick" })).status === 403, "who went home stays with whoever runs a game (jordan refused)");
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED) : "{}");
    bot.delayMs = 1500;
    const first = await as.alex.call("POST", `/api/seasons/${sid}/backstage/ask${A}`, { episode: 6, kind: "quick" });
    check(first.status === 200 && first.body.status === "running" && first.body.by === fixture.username("alex"), "alex's tap: the bot is asking", JSON.stringify(first.body));
    const second = await as.riley.call("POST", `/api/seasons/${sid}/backstage/ask${A}`, { episode: 6, kind: "quick" });
    check(second.body.id === first.body.id, "riley's tap a moment later joins the same run");
    const w1 = (await ways()).body;
    check(w1.running.length === 1 && w1.running[0].id === first.body.id, "the ways say it's running");
    const run1 = await finish("alex", first.body);
    check(run1.status === "done" && run1.outcome?.kind === "quick" && run1.outcome.applied?.games === 3, "done: applied to couch A's three games", JSON.stringify(run1));
    check(!JSON.stringify(run1).includes("Cristian"), "nothing in the run names who went home");
    check(bot.asked.filter((a) => a.kind === "quick").length === 1, "the bot was asked once");
    const s1 = (await subs()).at(-1);
    check(s1.source === "bot" && s1.submitted_by === fx.users.alex && s1.couch_id === fx.couchId && s1.covers.kinds.join() === "elimination", "a source of its own: who went home, by alex, through the bot", JSON.stringify(s1));
    const e1 = await all6();
    check(e1.every((e) => e.outs === 1 && e.stage === "early"), "every league on the season has who went home, early (couch B's too)", JSON.stringify(e1));
    const q1 = await linesOf("lineup", "results.quick");
    check(q1.length === 1 && q1[0].detail?.via === "tap" && (await linesOf("extra", "results.quick")).length === 0, "one line in couch A's Recent changes, none in couch B's", JSON.stringify(q1));
    const runRow = (await pool.query("SELECT slot, couch_id, asked_by, ok FROM bot_research_runs WHERE id = $1", [first.body.id])).rows[0];
    check(runRow.slot === "tap" && runRow.couch_id === fx.couchId && runRow.asked_by === fx.users.alex && runRow.ok === true, "the run is kept like a bot run (slot tap, the couch, who asked)");
    check((await undo("alex", run1.outcome.applied.batch)).status === 200, "Undo takes it back");
    await nothingIn("every league back to nothing in");
    bot.delayMs = 0;

    // ---- 3. a quick check that can't be sure is kept ----
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED, 1) : "{}");
    const run2 = (await tap("alex", "quick")).run;
    check(run2.status === "done" && !run2.outcome.applied && run2.outcome.waiting?.doubt === "one-source" && run2.outcome.waiting.id, "One tap, one source: it waits", JSON.stringify(run2.outcome));
    await nothingIn("nothing applied while it waits");
    let bs = await backstage();
    check(bs.episode.wait?.via === "tap" && bs.episode.wait.by === fixture.username("alex") && bs.episode.wait.doubt === "one-source", "Backstage keeps it: waiting, asked by alex", JSON.stringify(bs.episode.wait));
    check(!JSON.stringify(bs).includes(OUT6), "no names until Show me");
    check(bs.needs.some((x) => x.id === "quick" && /An answer waits/.test(x.title)), "Needs you: an answer waits", JSON.stringify(bs.needs));
    const shown = await backstage("alex", A, true);
    check(shown.shown?.wait?.length === 1 && shown.shown.wait[0].name === OUT6 && shown.shown.wait[0].matched && shown.shown.wait[0].method === "Voted Out", "Show me: who it says left, and how", JSON.stringify(shown.shown?.wait));
    check(!(await backstage("alex", B)).episode?.wait, "couch B doesn't see couch A's answer");
    const right = await as.alex.call("POST", `/api/seasons/${sid}/backstage/apply${A}`, { episode: 6, quick: true, items: [{ castawayName: OUT6, method: "Voted Out" }], wait: { id: run2.outcome.waiting.id, right: true } });
    check(right.status === 200 && right.body.games === 3, "It's right: applied", JSON.stringify(right.body));
    const closed = (await pool.query("SELECT outcome, closed_by FROM quick_waits WHERE id = $1", [run2.outcome.waiting.id])).rows[0];
    check(closed.outcome === "right" && closed.closed_by === fx.users.alex, "and the answer that waited is closed as right");
    await undo("alex", right.body.batch);
    await nothingIn("undone: nothing in");

    // Pasted, it's kept too; Not right closes it with who you entered instead.
    const pasted = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${A}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: "Someone Else", how: "Voted Out" }]) });
    check(pasted.body.waiting?.doubt === "unknown-name" && !JSON.stringify(pasted.body).includes("Someone Else"), "a pasted answer that waits: kept, and the reply names nobody", JSON.stringify(pasted.body));
    bs = await backstage();
    check(bs.episode.wait?.via === "paste" && bs.episode.wait.id === pasted.body.waiting.id, "Backstage has the pasted one now (it replaced the last)");
    const wrong = await as.alex.call("POST", `/api/seasons/${sid}/backstage/apply${A}`, { episode: 6, quick: true, items: [{ castawayName: OUT6, method: "Voted Out" }], wait: { id: pasted.body.waiting.id, right: false } });
    check(wrong.status === 200 && (await pool.query("SELECT outcome FROM quick_waits WHERE id = $1", [pasted.body.waiting.id])).rows[0].outcome === "not-right", "Not right: who you entered applies, the answer closes as not right");
    await undo("alex", wrong.body.batch);
    const notFound = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${A}`, { episode: 6, kind: "quick", answer: quickAnswer([], 0, false) });
    check(notFound.body.waiting?.doubt === "not-found" && notFound.body.waiting.id === null && !(await backstage()).episode.wait, "couldn't find it yet: nothing kept");
    await nothingIn("back to nothing in");

    // ---- 4. the browser ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page } = b;
    await page.context().setExtraHTTPHeaders(H);
    const hideOverlay = (p) =>
      p.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
    const failed = [];
    page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await hideOverlay(page);
    let n = 0;
    const shot = async (name, p = page) => {
      await Promise.race([settle(p), p.waitForTimeout(3000)]);
      await p.waitForTimeout(250);
      await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const fits = async (where, p = page) => {
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re, p = page) => {
      try {
        await p.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await p.getByRole("status").first().textContent().catch(() => "")) || "").trim();
    };
    const sheet = page.locator("[role=dialog][data-open]");
    const closeSheet = async () => {
      await page.keyboard.press("Escape");
      await sheet.waitFor({ state: "hidden" });
    };

    await page.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
    await page.locator("[data-ways=paste]").waitFor({ timeout: 20000 });
    check((await page.locator("[data-way=paste][aria-pressed=true]").count()) === 1, "How results get in: copy and paste is how you do it now");
    const waysText = (await page.locator("[data-ways]").innerText()).toLowerCase();
    check(/one tap/.test(waysText) && /\$1 a season/.test(waysText) && /\$5 a season/.test(waysText) && /coming soon/.test(waysText), "One tap $1 a season, Autopilot $5 a season · coming soon", waysText.slice(0, 300));
    check(/free during beta/i.test(await page.locator("section", { has: page.locator("[data-ways]") }).innerText()), "Free during beta");
    await page.locator("[data-ways]").scrollIntoViewIfNeeded();
    await fits("Backstage › Results with How results get in");
    await shot("results-ways");
    await page.locator("[data-way=autopilot]").click({ force: true });
    check(/Autopilot is coming soon/.test(await toasted(/Autopilot is coming soon/)), "Autopilot: coming soon");
    await page.locator("[data-way=tap]").click();
    await page.locator("[data-unlock-sheet]").waitFor();
    check(/for the whole season/.test(await sheet.innerText()) && /Nothing is charged during beta/i.test(await sheet.innerText()), "One tap opens its unlock sheet: $1 for the whole season, nothing charged");
    await shot("unlock-sheet");
    await closeSheet();
    check(!(await ways()).body.tap.unlocked, "closing it unlocks nothing");

    // Who went home through One tap: the sheet leads with it, free.
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED) : "{}");
    bot.delayMs = 2500;
    await page.locator("[data-ask=quick]").click();
    await page.locator("[data-one-tap=ready]").waitFor({ timeout: 20000 });
    check(/always free/i.test(await sheet.innerText()) && /Ask ChatGPT for me/.test(await sheet.innerText()), "the sheet leads with Ask ChatGPT for me, who went home always free");
    check((await page.locator("[data-copy-paste]").count()) === 1, "copy and paste is one row below");
    await fits("the One tap sheet");
    await shot("one-tap-quick");
    await page.locator("[data-ask-bot]").click();
    await page.locator("[data-one-tap=running]").waitFor();
    await shot("one-tap-searching");
    const applied = await toasted(/Applied to 3 games/);
    check(/Applied to 3 games · nothing shown to you/.test(applied), "done: applied to all three games, nothing shown", applied);
    await page.locator("[data-quick=own]").waitFor();
    check(!(await page.evaluate(() => document.body.innerText)).includes(OUT6), "Results: applied on its own, nobody named");
    await shot("one-tap-applied");
    await page.locator("[data-quick=own] [data-undo]").click();
    await page.locator("[data-quick=ask]").waitFor();
    check((await all6()).every((e) => !e.outs), "Undo from the card: nothing in");

    // A One tap answer that isn't sure: it waits on the card.
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED, 1) : "{}");
    bot.delayMs = 500;
    await page.locator("[data-ask=quick]").click();
    await page.locator("[data-ask-bot]").click();
    check(/couldn't be sure/.test(await toasted(/couldn't be sure/)), "One tap, not sure: it says it waits here");
    await page.locator("[data-quick=waiting][data-wait=tap]").waitFor();
    check(!(await page.locator("[data-quick=waiting]").innerText()).includes(OUT6), "the waiting card names nobody");
    await shot("one-tap-waits");
    await page.locator("[data-quick=waiting] [data-show-me]").click();
    await page.locator("[data-wait-names]").waitFor();
    check((await page.locator("[data-wait-names]").innerText()).includes(OUT6), "Show me: who it says left");
    await shot("waits-shown");
    await page.locator("[data-wait-right]").click();
    await page.locator("[data-guard='2']").waitFor();
    await page.locator("[data-guard-confirm]:not([disabled])").click();
    check(/Applied to 3 games/.test(await toasted(/Applied to 3 games/)), "It's right: previewed, then applied");
    await page.locator("[data-quick=in]").waitFor();
    check((await all6()).every((e) => e.outs === 1 && e.stage === "early"), "every league: who went home, early");

    // The full results: locked at $1; copy and paste one row below; one tap unlocks and asks.
    bot.answer = (p, kind) => (kind === "full" ? fullAnswer(p) : quickAnswer(VOTED));
    bot.delayMs = 1500;
    await page.locator("[data-ask=full]").click();
    await page.locator("[data-one-tap=locked]").waitFor({ timeout: 20000 });
    const locked = await sheet.innerText();
    check(/\$1/.test(locked) && /this season/.test(locked) && /free during beta/i.test(locked) && /anyone on the couch can use it/.test(locked), "the full results: One tap at $1 this season, free during beta", locked.slice(0, 300));
    await fits("the locked One tap sheet");
    await shot("one-tap-locked");
    await page.locator("[data-copy-paste]").click();
    await page.locator("[data-ask-ai=full]").waitFor();
    check(/Ask an AI · free/.test(await sheet.innerText()), "Copy and paste it yourself: the free way, as before");
    await shot("copy-and-paste");
    await closeSheet();
    await page.locator("[data-ask=full]").click();
    await page.locator("[data-ask-bot]").click();
    check(/One tap unlocked for ZT Survivor 51/.test(await toasted(/One tap unlocked/)), "one tap unlocks One tap for the couch");
    const full = await toasted(/applied to 3 games/);
    check(/results? applied to 3 games/.test(full), "then the bot's answer: applied to every game here", full);
    await page.locator("[data-ways=tap]").waitFor();
    check(/unlocked for this season by zt_nd_alex/i.test(await page.locator("[data-way=tap]").innerText()), "How results get in: One tap, unlocked by alex");
    await page.locator("[data-ways]").scrollIntoViewIfNeeded();
    await shot("ways-unlocked");
    check(failed.length === 0, "no failed requests (alex)", failed.join(", "));

    // ---- 5. One tap for the full results ----
    const e5 = await all6();
    check(e5.every((e) => e.outs === 1 && e.events >= 1 && e.stage === "final"), "every league: Episode 6 final, Danny's immunity in", JSON.stringify(e5));
    const s5 = (await subs()).filter((s) => !s.withdrawn_at).at(-1);
    check(s5.source === "bot" && s5.submitted_by === fx.users.alex && s5.covers.kinds === null, "the full answer: a source by alex, through the bot, covering everything", JSON.stringify(s5));
    const unl = await linesOf("pool", "settings.results");
    check(unl.length === 1 && /Unlocked One tap for ZT Survivor 51 · free during beta/.test(unl[0].text), "Recent changes: One tap unlocked", JSON.stringify(unl));
    check((await pool.query("SELECT charged_cents FROM results_plans WHERE couch_id = $1 AND season_id = $2 AND plan = 'tap'", [fx.couchId, sid])).rows[0]?.charged_cents === 0, "nothing charged");
    check(!(await ways("alex", B)).body.tap.unlocked, "couch B is still on copy and paste");
    check((await as.alex.call("POST", `/api/seasons/${sid}/backstage/ask${B}`, { episode: 6, kind: "full" })).status === 403, "couch B can't One tap the full results until it unlocks");
    check((await as.sam.call("POST", `/api/seasons/${sid}/backstage/ask${A}`, { episode: 6, kind: "full" })).status === 403, "sam can't before he's seen Episode 6");
    bot.answer = () => {
      throw new Error("ChatGPT is having a moment");
    };
    bot.delayMs = 0;
    const failedRun = await tap("alex", "full");
    check(failedRun.run?.status === "failed" && /didn't answer/.test(failedRun.run.message || ""), "a bot that doesn't answer: the run fails, with a reason", JSON.stringify(failedRun));
    // jordan fills it in from Tonight with One tap, once the full results are out again.
    const fullBatch = (await linesOf("lineup", "results.full")).filter((x) => !x.undone_at).at(-1).batch;
    check((await undo("alex", fullBatch)).status === 200, "alex's full results undone");
    await as.jordan.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.couchId });
    bot.answer = (p, kind) => (kind === "full" ? fullAnswer(p) : quickAnswer(VOTED));
    bot.delayMs = 1000;
    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    await j.page.context().setExtraHTTPHeaders(H);
    await hideOverlay(j.page);
    await j.page.goto(`${BASE}/show/${sid}/tonight`);
    await j.page.locator("[data-fill-it='6']").click();
    await j.page.locator("[data-one-tap=ready]").waitFor({ timeout: 20000 });
    check(/One tap · unlocked for this season/.test(await j.page.locator("[role=dialog][data-open]").innerText()), "jordan's Fill it in: One tap, unlocked for this season");
    await shot("fill-it-one-tap", j.page);
    await j.page.locator("[data-ask-bot]").click();
    check(/Thanks! Every game on the couch is scored/.test(await toasted(/Thanks/, j.page)), "jordan's one tap: every game on the couch scored");
    const sj = (await subs()).filter((s) => !s.withdrawn_at).at(-1);
    check(sj.source === "bot" && sj.submitted_by === fx.users.jordan, "a source by jordan, through the bot");
    const jBatch = (await linesOf("lineup", "results.full")).filter((x) => !x.undone_at).at(-1).batch;
    check((await undo("jordan", jBatch)).status === 200, "jordan takes his answer back");
    const qBatch = (await linesOf("lineup", "results.quick")).filter((x) => !x.undone_at).at(-1).batch;
    await undo("alex", qBatch);
    await nothingIn("Episode 6 back to nothing in, for Autopilot");

    // ---- 6. Autopilot's engine: the bot's schedule ----
    await pool.query(
      "UPDATE show_seasons SET bot_research_on = true, bot_research_since = now() - interval '1 day', bot_research_schedule = $2::jsonb WHERE id = $1",
      [sid, JSON.stringify([{ kind: "quick", after: 5, on: true }, { kind: "full", after: 60, on: true }])]
    );
    const wa = (await ways()).body;
    check(wa.autopilot.quick && wa.autopilot.full, "the season's schedule on: Autopilot is on for this season");
    const cron = async (mins) => {
      const now = new Date(ended + mins * 60000).toISOString();
      const r = await fetch(`${BASE}/api/cron/bot-research?now=${encodeURIComponent(now)}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...H } });
      return r.json();
    };
    bot.delayMs = 0;
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED, 1) : fullAnswer(p));
    const c1 = await cron(6);
    check(c1.job?.slot === "quick@5" && c1.ok === false && /Not sure yet/.test(c1.message), "the scheduled quick check, one source: a failed try, asked again", JSON.stringify(c1).slice(0, 300));
    const bsA = await backstage();
    const bsB = await backstage("alex", B);
    check(bsA.episode.wait?.via === "autopilot" && bsA.episode.wait.by === null && bsB.episode.wait?.via === "autopilot", "it waits on every couch (couch B's too), from our bot", JSON.stringify([bsA.episode.wait, bsB.episode.wait]));
    await nothingIn("nothing applied while it waits");
    bot.answer = (p, kind) => (kind === "quick" ? quickAnswer(VOTED) : fullAnswer(p));
    const c2 = await cron(12);
    check(c2.job?.slot === "quick@5" && c2.ok === true, "five minutes on, the retry is sure", JSON.stringify(c2).slice(0, 300));
    const e6 = await all6();
    check(e6.every((e) => e.outs === 1 && e.stage === "early"), "every league: who went home, early", JSON.stringify(e6));
    const sa = (await subs()).filter((s) => !s.withdrawn_at).at(-1);
    check(sa.source === "autopilot" && sa.submitted_by === null && sa.couch_id === null, "a source of the bot's own (autopilot), nobody's", JSON.stringify(sa));
    check(!(await backstage()).episode.wait && (await pool.query("SELECT count(*)::int AS n FROM quick_waits WHERE season_id = $1 AND couch_id IS NULL AND closed_at IS NULL", [sid])).rows[0].n === 0, "the bot's own answer that waited is closed");
    const arrivals = (await pool.query("SELECT count(*)::int AS n FROM league_changes WHERE league_id = ANY($1::uuid[]) AND kind IN ('results.quick', 'results.full') AND undone_at IS NULL", [Object.values(L)])).rows[0].n;
    check(arrivals === 0, "no couch gets an arrival line for the bot's answer");
    const c3 = await cron(61);
    check(c3.job?.slot === "full@60" && c3.ok === true, "an hour on, the full run", JSON.stringify(c3).slice(0, 300));
    const e7 = await all6();
    check(e7.every((e) => e.outs === 1 && e.events >= 1 && e.stage === "final"), "every league final", JSON.stringify(e7));
    const fill = (await backstage()).fill.episodes.find((e) => e.episode === 6);
    check(fill?.bot && !fill.here, "Full scores: filled in by our bot", JSON.stringify(fill));
    await page.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
    await page.locator("[data-filled='6']").waitFor({ timeout: 20000 });
    check(/filled in by our bot/.test(await page.locator("[data-filled='6']").innerText()), "the screen says so");
    check(/On for this season/.test(await page.locator("[data-way=autopilot]").innerText()), "and Autopilot is on for this season");
    await page.locator("[data-ways]").scrollIntoViewIfNeeded();
    await fits("Results with Autopilot on");
    await shot("autopilot-on");
    check(b.errors.length === 0 && j.errors.length === 0, "no page errors", [...b.errors, ...j.errors].join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!keep) await fixture.down(pool).catch((e) => console.error("down failed", e));
    await pool.end();
  }
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
