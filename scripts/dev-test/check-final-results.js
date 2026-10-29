// Dev-only check for early and final results (the user's decisions, 2026-10-29: src/lib/game/final-results.js), against the dev
// server, on new-fixture.js's couch with Episode 6 started three hours ago (an exact start, season_episodes):
//   - who went home goes in (alex's quick check): the early push says when the final results come ("Final results by 12:00 PM
//     tomorrow", or today), and riley (sees results straight away) hears who went home with it;
//   - jordan (seen through 5), in a real browser at --width (390): the hub's status line, Tonight's results card and its stages,
//     and Episodes' plate say "Early results are in" and when the final results come;
//   - the full results go in before that time: nobody is pushed "Final results are in" yet (the bell has no final:<season>:6);
//     jordan's hub says "Final results are in";
//   - at that time the hourly job (db/reminders.js finalResults, run on this season alone with that time as now) tells
//     everyone on the games, once (a second run sends nothing), and not a minute before; jordan's words don't spoil, riley's
//     offer the reveal again (?page=reveal&ep=6);
//   - alex revealed Episode 6 early: the morning update says "Final results are in" and its sheet's Watch the final results
//     opens the reveal again; it never opens by itself (a reload); riley's link from the push opens it too.
//
//   node scripts/lane.js dev                                 (in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-final-results.js [--width=390] [--shots=<dir>] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only and runs the hourly job's final results
// on the zt season alone (never runReminders: that would read every league in the database); refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path_ = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const { loadSeasons } = require("../../db/season-clock.js");
const { finalResults } = require("../../db/reminders.js");
const { finalResultsAt } = require("../../src/lib/game/final-results.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-final-results runs against a local database only");

const args = process.argv.slice(2);
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const shots = (args.find((a) => a.startsWith("--shots=")) || "").slice(8) || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const OUT6 = "Cristian Chavez";
const BY = /final results by \d{1,2}:\d{2} [AP]M (today|tomorrow)/i;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// check-new-notify.js's answers: a quick check that names who went home, and the full skeleton answered with confidence.
const quickAnswer = (left) =>
  "Here's what I found:\n```json\n" +
  JSON.stringify({ found: true, episodeTitle: null, left, headline: "A blindside at Tribal.", sources: ["https://news0.example/ep6", "https://news1.example/ep6"] }) +
  "\n```";
function fullAnswer(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode six.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  Object.assign(a.castaways.find((c) => c.name === OUT6), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5 });
  Object.assign(a.castaways.find((c) => c.name === "Danny Kilby"), { wonIndividualImmunity: "yes" });
  return JSON.stringify(a);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const U = fx.users;
    const q = `?couch=${fx.couchId}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const notes = async (who, key) => (await pool.query("SELECT * FROM notifications WHERE user_id = $1 AND key = $2", [U[who], key])).rows;
    const R = `results:${sid}:6`;
    const F = `final:${sid}:6`;

    // Episode 6 started three hours ago (90 minutes long: it ended an hour and a half ago). riley sees results straight away.
    await pool.query(
      `INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 6, now() - interval '3 hours', 'admin')
       ON CONFLICT (season_id, number) DO UPDATE SET air_at = EXCLUDED.air_at, source = 'admin'`,
      [sid]
    );
    const { rows: ss } = await pool.query("SELECT air_tz, (SELECT air_at FROM season_episodes WHERE season_id = $1 AND number = 6) AS air_at FROM show_seasons WHERE id = $1", [sid]);
    const finalAt = finalResultsAt(ss[0].air_at, ss[0].air_tz);
    check(finalAt > new Date(), "Episode 6's final results are due later", finalAt.toISOString());
    await as.riley.call("PUT", "/api/me/profile", { hideScores: false });

    // ---------- early results ----------
    let r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: OUT6, how: "Voted Out" }]) });
    check(r.status === 200 && r.body.applied?.games === 3, "alex's quick check: who went home in Episode 6, in all three games", JSON.stringify(r.body).slice(0, 200));
    for (let i = 0; i < 30 && !(await notes("jordan", R)).length; i++) await wait(500);
    const je = (await notes("jordan", R))[0];
    const re = (await notes("riley", R))[0];
    check(je?.title === "Episode 6 results are in" && /Reveal when you've watched/.test(je?.body), "jordan's early notice: that they're in, no names", JSON.stringify(je));
    check(re?.title === `Episode 6: ${OUT6} went home` && BY.test(re?.body ?? ""), "riley's: who went home, and when the final results come", re?.body);
    // alex reveals it while it's early (the morning update waits on its final results).
    r = await as.alex.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.couchId });
    check(r.status === 200 && r.body.stage === "early" && r.body.finalAt === finalAt.toISOString(), "alex reveals Episode 6 early; the reveal knows its final time", JSON.stringify({ stage: r.body.stage, finalAt: r.body.finalAt }));

    const b = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, motion: "off" });
    close = b.close;
    const { page, BASE, errors } = b;
    const shot = (name) => shots && page.screenshot({ path: path_.join(shots, `${name}.png`) });
    await page.goto(`${BASE}/home`, { waitUntil: "load" });
    await page.getByText(/Early results are in/).first().waitFor({ timeout: 30000 });
    const status = await page.locator("[data-hub]").innerText();
    check(BY.test(status), "jordan's hub: Early results are in, and when the final results come", status.slice(0, 300));
    await shot("hub-early");
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    await page.locator("[data-results-in='6']").waitFor({ timeout: 30000 });
    const card = await page.locator("[data-results-in='6']").innerText();
    check(/Early results are in/i.test(card) && BY.test(card), "Tonight's results card says when", card);
    const stages = await page.locator("[data-stage-bar]").innerText();
    check(/Final results/i.test(stages) && /By \d{1,2}:\d{2} [AP]M (today|tomorrow)/i.test(stages), "and its stages: Final results, by when", stages);
    await shot("tonight-early");
    await page.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
    await page.locator("[data-reveal-plate]").waitFor({ timeout: 30000 });
    check(BY.test(await page.locator("[data-reveal-plate]").innerText()), "Episodes' plate says when too");

    // ---------- the full results, before their time ----------
    const fullQ = await as.alex.call("GET", `/api/seasons/${sid}/backstage/prompt${q}&episode=6&kind=full`);
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "full", answer: fullAnswer(fullQ.body.prompt) });
    check(r.status === 200, "the full results go in, before their time", JSON.stringify(r.body).slice(0, 200));
    await wait(4000);
    const early = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE key = $1", [F]);
    check(early.rows[0].n === 0, "nobody is told the final results are in yet", `${early.rows[0].n} final notices`);
    await page.goto(`${BASE}/home`, { waitUntil: "load" });
    await page.getByText(/Final results are in/).first().waitFor({ timeout: 30000 }).catch(() => {});
    check(/Final results are in/.test(await page.locator("[data-hub]").innerText()), "jordan's hub now: Final results are in");

    // ---------- at their time: the hourly job ----------
    const [season] = await loadSeasons(pool, "ss.id = $1", [sid]);
    const { rows: leagues } = await pool.query("SELECT id, name, state FROM leagues WHERE id = ANY($1::uuid[])", [[fx.leagues.outlast, fx.leagues.lineup, fx.leagues.pool]]);
    const at = (ms) => new Date(finalAt.getTime() + ms);
    check((await finalResults(pool, season, leagues, at(-60_000), {})) === 0, "a minute before: nothing");
    await finalResults(pool, season, leagues, at(5 * 60_000), {});
    const told = (await pool.query("SELECT user_id, title, body, link FROM notifications WHERE key = $1", [F])).rows;
    const of = (who) => told.find((t) => t.user_id === U[who]);
    check(["alex", "riley", "jordan", "sam"].every((w) => of(w)?.title === "Episode 6 final results are in"), "at their time: everyone on the games, Episode 6 final results are in", JSON.stringify(told));
    check(/Reveal when you've watched/.test(of("jordan")?.body) && !JSON.stringify(of("jordan")).includes("Cristian"), "jordan's (seen through 5): no names, reveal when you've watched", JSON.stringify(of("jordan")));
    check(/Watch the final results/.test(of("riley")?.body) && of("riley")?.link === `/show/${sid}/tonight?page=reveal&ep=6`, "riley's: Watch the final results, to the reveal again", JSON.stringify(of("riley")));
    await finalResults(pool, season, leagues, at(65 * 60_000), {});
    const again = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE key = $1", [F]);
    check(again.rows[0].n === told.length, "the next hour's run sends nothing again", `${again.rows[0].n} vs ${told.length}`);

    // ---------- the reveal again ----------
    const a = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, motion: "off" });
    const ap = a.page;
    await ap.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    await ap.locator("[data-morning='6']").waitFor({ timeout: 30000 });
    check(/Final results are in/.test(await ap.locator("[data-morning='6']").innerText()), "alex (revealed it early): the morning update says Final results are in");
    await ap.locator("[data-morning='6']").click();
    await ap.locator("[data-watch-final]").waitFor({ timeout: 20000 });
    await ap.locator("[data-watch-final]").click();
    const overlay = ap.locator("[aria-label='The reveal']");
    await ap.waitForFunction(() => document.querySelector("[aria-label='The reveal']")?.getAttribute("aria-hidden") === "false", null, { timeout: 15000 }).catch(() => {});
    check((await overlay.getAttribute("aria-hidden")) === "false" && /page=reveal/.test(ap.url()), "Watch the final results opens the reveal again", ap.url());
    await ap.getByText(/Final scores/).first().waitFor({ timeout: 15000 }).catch(() => {});
    const shown = await overlay.innerText();
    check(/final scores/i.test(shown), "showing the final results", shown.slice(0, 300));
    if (shots) await ap.screenshot({ path: path_.join(shots, "reveal-again.png") });
    await ap.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    await ap.locator("[data-tab=tonight]").waitFor({ timeout: 30000 });
    await wait(1500);
    check((await overlay.getAttribute("aria-hidden")) !== "false", "it never opens by itself (a reload)");
    const rr = await open({ user: fixture.username("riley"), pass: fixture.PASSWORD, width, motion: "off" });
    await rr.page.goto(`${BASE}${of("riley").link}`, { waitUntil: "load" });
    await rr.page.waitForFunction(() => document.querySelector("[aria-label='The reveal']")?.getAttribute("aria-hidden") === "false", null, { timeout: 20000 }).catch(() => {});
    check((await rr.page.locator("[aria-label='The reveal']").getAttribute("aria-hidden")) === "false", "riley's link from the push opens the reveal");
    await rr.close();
    await a.close();
    check(errors.length === 0 && a.errors.length === 0, "no page errors", [...errors, ...a.errors].join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
