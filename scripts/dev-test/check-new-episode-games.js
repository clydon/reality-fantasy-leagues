// Dev-only check for episode games (docs/PLAN-new-design.md step 12), against the dev server, on new-fixture.js's couch ("ZT
// Survivor 51": alex, riley, jordan and sam play it, results through Episode 5, everyone on 5 but sam on 3; ZT Traitors, which
// riley follows openly through 2 and jordan privately through 4; casey is only on alex's other couch, ZT Extra). It grows with
// the step's parts; part 1 is Rate it and the couch verdict (ratings.ts):
//   API:
//   - rating: one to five stars and a take, only for an episode you've seen (sam on 3 can't rate 4; alex can't rate 6), the
//     refusals (stars, episode, take too long or not words, a season that isn't one, a couch you're not on), a take kept when
//     only stars are sent and taken away with "", and someone who sees results straight away still can't rate what hasn't aired;
//   - one episode's verdict (GET .../ratings/[n]): the couch's (its people who follow the show openly, you first, their takes),
//     another couch's (alex and casey), everyone's with no couch (a number only, never a name), a private watcher's stars never
//     counted (jordan's Traitors), and nothing for an episode past your mark (403);
//   - the Episodes read: each episode you've seen with its verdict and your stars, nothing on the ones you haven't (sam);
//   - the hub (GET /api/couches/[id]/hub): your taste twin, Agree with the couch, the shows with a verdict, the accolades
//     (taste twins, the contrarian, never misses a rating), all counted up to your mark (sam's twins are "3 of 3", alex's
//     "5 of 5"); Couch verdicts (GET /api/couches/[id]/verdicts): a panel per show you've started at your latest episode, its
//     take and its score by episode, never past your mark.
//   In a real browser at --width (390 by default): as alex, Tonight's Rate it row (rated), the sheet (the verdict, everyone's
//   stars and takes), changing his stars, a take, Episodes' marks, the episode page's row, the hub's Couch verdicts row and
//   page, the profile's taste twin and Agree with the couch, By the numbers' accolades; as sam (behind), Rate Episode 3 from
//   Tonight (the verdict waits for his stars, then lands), nothing about 4 or 5; as riley, the Traitors (a show she only
//   watches) rated from its Episodes; and, on solo-fixture.js (people on no couch), zt_so_alex's Rate it with everyone's verdict
//   (a number only). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-episode-games.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and solo-fixture.js up and takes them down (--keep leaves them); touches zt
// rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const soloFixture = require("./solo-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-episode-games runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-episode-games.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const so = await soloFixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    const A = fx.couchId;
    const X = fx.extraCouchId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: u(who), pass: PASSWORD });
    const q = (couch) => (couch ? `?couch=${couch}` : "");
    const rate = (who, n, body, season = sid, couch = A) => as[who].call("POST", `/api/seasons/${season}/ratings/${n}${q(couch)}`, body);
    const verdict = (who, n, season = sid, couch = A) => as[who].call("GET", `/api/seasons/${season}/ratings/${n}${q(couch)}`);
    const rows = async (who, season = sid, couch = A) => (await as[who].call("GET", `/api/seasons/${season}/episodes${q(couch)}`)).body;
    const hub = async (who, couch = A) => (await as[who].call("GET", `/api/couches/${couch}/hub`)).body;
    const verdicts = async (who, couch = A) => (await as[who].call("GET", `/api/couches/${couch}/verdicts`)).body;
    const stored = async (who, n, season = sid) => (await pool.query("SELECT stars, take FROM episode_ratings WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], season, n])).rows[0] ?? null;

    // ---------- rating, and what's refused ----------
    let r = await rate("sam", 4, { stars: 3 });
    check(r.status === 403 && /haven't seen Episode 4/.test(r.body.error), "sam (on 3) can't rate Episode 4: 403", JSON.stringify(r.body));
    check(!(await stored("sam", 4)), "and nothing was saved");
    r = await rate("alex", 6, { stars: 3 });
    check(r.status === 403, "alex (on 5) can't rate Episode 6: 403");
    for (const [body, re, what] of [
      [{ stars: 0 }, /stars must be 1 to 5/, "no stars"],
      [{ stars: 6 }, /stars must be 1 to 5/, "six stars"],
      [{ stars: "four" }, /stars must be 1 to 5/, "stars that aren't a number"],
      [{ stars: 3, take: "x".repeat(141) }, /140 characters/, "a take over 140 characters"],
      [{ stars: 3, take: 42 }, /take must be words/, "a take that isn't words"],
    ]) {
      r = await rate("alex", 5, body);
      check(r.status === 400 && re.test(r.body.error), `${what}: 400`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await as.alex.call("POST", `/api/seasons/${sid}/ratings/zero${q(A)}`, { stars: 3 });
    check(r.status === 400, "an episode that isn't one: 400");
    r = await as.alex.call("POST", `/api/seasons/not-a-season/ratings/5${q(A)}`, { stars: 3 });
    check(r.status === 404, "a season that isn't one: 404");
    r = await rate("riley", 5, { stars: 3 }, sid, X);
    check(r.status === 404, "rating on a couch you're not on: 404");

    // The couch rates: alex and riley alike (alex's twin), jordan far off (the contrarian), sam behind.
    const seed = { alex: [4, 4, 3, 4, 5], riley: [4, 4, 3, 5, 4], jordan: [1, 2, 5, 1, 2] };
    for (const [who, list] of Object.entries(seed)) for (const [i, s] of list.entries()) await rate(who, i + 1, { stars: s });
    r = await rate("jordan", 5, { stars: 2, take: "  far   too slow  " });
    check(r.status === 200 && r.body.mine.take === "far too slow", "a take, tidied", JSON.stringify(r.body.mine));
    r = await rate("alex", 5, { stars: 5, take: "Best tribal of the season" });
    check(r.status === 200 && r.body.scope === "couch" && r.body.avg === 3.7 && r.body.n === 3, "alex rates Episode 5: the couch's verdict is 3.7 from 3", JSON.stringify(r.body).slice(0, 300));
    check(r.body.people[0].name === u("alex") && r.body.people.map((p) => p.name).sort().join() === [u("alex"), u("jordan"), u("riley")].sort().join(), "everyone who rated it, alex first");
    check(r.body.people.find((p) => p.name === u("jordan"))?.take === "far too slow", "with their takes");
    r = await rate("alex", 5, { stars: 5 });
    check((await stored("alex", 5)).take === "Best tribal of the season", "rating again with only stars keeps the take");
    r = await rate("alex", 5, { stars: 5, take: "" });
    check((await stored("alex", 5)).take === null && r.body.mine.take === null, "an empty take takes it away");
    await rate("alex", 5, { stars: 5, take: "Best tribal of the season" });
    r = await rate("sam", 2, { stars: 4 });
    check(r.status === 200, "sam rates Episode 2 (he's on 3)");
    await rate("sam", 1, { stars: 3 });
    r = await rate("casey", 5, { stars: 3 }, sid, X);
    check(r.status === 200 && r.body.avg === 4 && r.body.n === 2 && r.body.people.length === 2, "casey on ZT Extra: that couch's verdict is alex's and hers (4.0 from 2)", JSON.stringify(r.body).slice(0, 200));

    // Someone who sees results straight away still only rates what's aired.
    await pool.query(`INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = true`, [U.casey]);
    r = await rate("casey", 6, { stars: 3 }, sid, X);
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "casey sees results straight away: Episode 6 hasn't aired, 409", JSON.stringify(r.body));
    await pool.query(`UPDATE user_settings SET show_results_immediately = false WHERE user_id = $1`, [U.casey]);

    // ---------- one episode's verdict ----------
    r = await verdict("riley", 5);
    check(r.status === 200 && r.body.avg === 3.7 && r.body.mine.stars === 4 && r.body.people[0].name === u("riley"), "riley reads Episode 5: 3.7, her own stars first");
    check(r.body.everyone && r.body.everyone.n === 4 && r.body.everyone.avg === 3.5, "and everyone on Game Your Show beside it (casey's too): 3.5 from 4", JSON.stringify(r.body.everyone));
    r = await verdict("sam", 5);
    check(r.status === 403 && !/stars|avg/.test(JSON.stringify(r.body)), "sam (on 3) reads Episode 5: 403, nothing about it", JSON.stringify(r.body));
    r = await verdict("sam", 3);
    check(r.status === 200 && r.body.n === 3 && !r.body.mine, "sam reads Episode 3: the couch's three, his own still to come");
    r = await verdict("alex", 5, sid, null);
    check(r.status === 200 && r.body.scope === "everyone" && r.body.n === 4 && r.body.avg === 3.5 && r.body.people.length === 1 && r.body.everyone === null, "no couch: everyone's verdict, a number (only alex's own face)", JSON.stringify(r.body).slice(0, 200));
    check(!new RegExp(u("jordan")).test(JSON.stringify(r.body)) && !/far too slow/.test(JSON.stringify(r.body)), "and never a stranger's name or take");
    r = await verdict("casey", 5, sid, A);
    check(r.status === 404, "a couch you're not on: 404");

    // The Traitors: riley follows openly (through 2), jordan privately (through 4).
    r = await rate("jordan", 2, { stars: 5, take: "the turret!" }, tsid, A);
    check(r.status === 200 && r.body.people.length === 1, "jordan rates the Traitors' Episode 2 (watching privately)");
    r = await rate("riley", 2, { stars: 3 }, tsid, A);
    check(r.status === 200 && r.body.n === 1 && r.body.people.length === 1 && r.body.everyone === null, "riley rates it too: the couch's verdict is hers alone; jordan's private stars count nowhere", JSON.stringify(r.body).slice(0, 300));
    check(!/turret/.test(JSON.stringify(r.body)), "nor his take");
    r = await rate("riley", 3, { stars: 3 }, tsid, A);
    check(r.status === 403, "riley (on 2) can't rate the Traitors' Episode 3");

    // ---------- the Episodes read ----------
    let e = await rows("alex");
    const ep = (body, n) => body.episodes.find((x) => x.number === n);
    check(JSON.stringify(ep(e, 5).verdict) === JSON.stringify({ avg: 3.7, n: 3, mine: 5 }), "Episodes: Episode 5 carries the couch's verdict and alex's stars", JSON.stringify(ep(e, 5).verdict));
    check(ep(e, 1).verdict.avg === 3 && ep(e, 1).verdict.n === 4, "and Episode 1 its own (sam rated it too)");
    e = await rows("sam");
    check(ep(e, 3).verdict.n === 3 && ep(e, 2).verdict.mine === 4, "sam's Episodes: his own stars on 2, the couch's on 3");
    check([4, 5].every((n) => !ep(e, n) || ep(e, n).verdict === undefined), "and nothing about 4 or 5 (results he hasn't revealed)", JSON.stringify(e.episodes.filter((x) => x.number > 3)));
    e = await rows("alex", sid, null);
    check(ep(e, 5).verdict.n === 4 && ep(e, 5).verdict.avg === 3.5, "with no couch, everyone's");

    // ---------- the hub ----------
    let h = await hub("alex");
    check(h.taste.twin?.name === u("riley") && h.taste.twin.line === "The same stars on 3 of 5 episodes", "alex's taste twin: riley", JSON.stringify(h.taste));
    check(h.taste.agree && h.taste.agree.of === 5 && h.taste.shows === 1, "Agree with the couch over the five episodes others rated; one show with a verdict", JSON.stringify(h.taste));
    const acc = (body) => Object.fromEntries(body.accolades.map((a) => [a.key, a]));
    let a = acc(h);
    check(a.twins?.who === `${u("alex")} and ${u("riley")}` && /3 of 5 episodes/.test(a.twins.line), "the accolades: alex and riley are the taste twins", JSON.stringify(a.twins));
    check(a.contrarian?.who === u("jordan"), "jordan is the contrarian", JSON.stringify(a.contrarian));
    check(a.rates?.who === u("alex") && /5 episodes of ZT Survivor 51 in a row/.test(a.rates.line), "and alex never misses a rating", JSON.stringify(a.rates));
    h = await hub("sam");
    a = acc(h);
    check(h.taste.twin === null, "sam: no twin yet (two episodes rated)");
    check(/of 3 episodes/.test(a.twins?.line ?? "") && !a.rates, "his accolades count only up to Episode 3 (the twins on 3 of 3, nobody's five in a row)", JSON.stringify(h.accolades));
    h = await hub("riley");
    check(!h.accolades.some((x) => /Traitors/.test(x.line)) && h.taste.shows === 2, "riley: two shows with a verdict (hers on the Traitors), jordan's private stars in nothing");

    // ---------- Couch verdicts ----------
    let v = await verdicts("alex");
    const s51 = v.shows.find((s) => s.seasonId === sid);
    check(v.shows.length === 1 && s51 && s51.episode === 5 && s51.avg === 3.7 && s51.n === 3 && s51.mine === 5, "alex's Couch verdicts: ZT Survivor 51 at Episode 5, 3.7 from 3", JSON.stringify(v).slice(0, 300));
    check(s51.take?.name === u("jordan") && s51.take.text === "far too slow", "the take on its plate is someone else's (the newest)", JSON.stringify(s51.take));
    check(s51.byEpisode.map((b) => b.avg).join() === "3,3.5,3.7,3.3,3.7", "the couch's score by episode", JSON.stringify(s51.byEpisode));
    v = await verdicts("sam");
    check(v.shows.length === 1 && v.shows[0].episode === 3 && v.shows[0].byEpisode.length === 3 && v.shows[0].mine === null, "sam's: Episode 3, nothing past it", JSON.stringify(v).slice(0, 300));
    v = await verdicts("riley");
    const tr = v.shows.find((s) => s.seasonId === tsid);
    check(v.shows.length === 2 && tr && tr.episode === 2 && tr.n === 1 && !tr.take, "riley's: both shows; the Traitors at Episode 2, hers alone", JSON.stringify(tr));
    check((await as.casey.call("GET", `/api/couches/${A}/verdicts`)).status === 404, "a couch you're not on: 404");

    // ---------- solo: everyone's verdict ----------
    const solo = {};
    for (const who of ["alex", "riley", "jordan"]) solo[who] = await api({ user: soloFixture.username(who), pass: PASSWORD });
    await solo.riley.call("POST", `/api/seasons/${so.seasonId}/ratings/5`, { stars: 4, take: "zt: a stranger's take" });
    r = await solo.jordan.call("POST", `/api/seasons/${so.seasonId}/ratings/5`, { stars: 2 });
    check(r.status === 200 && r.body.scope === "everyone" && r.body.n === 2 && r.body.avg === 3 && r.body.people.length === 1, "solo (no couch): everyone's verdict, 3.0 from 2, only his own face", JSON.stringify(r.body).slice(0, 200));
    r = await solo.alex.call("GET", `/api/seasons/${so.seasonId}/ratings/5`);
    check(r.status === 200 && r.body.n === 2 && r.body.people.length === 0 && !r.body.mine && !/stranger|zt_so_/.test(JSON.stringify(r.body)), "zt_so_alex, before rating: a number, never a stranger's name or take", JSON.stringify(r.body));

    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      let n = 0;
      const browse = async (who) => {
        const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const pg = b.page;
        return {
          pg,
          shot: async (name) => {
            await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
            await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`) });
          },
          wide: async (what) => {
            const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
          },
          errors: () => b.errors.filter((x) => !/Failed to load resource/.test(x)).concat(b.errors.filter((x) => /Failed to load resource/.test(x)).slice(favicon)),
          sheet: () => pg.locator("[role=dialog][data-open]"),
          closed: () => pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {}),
          statuses: async () => (await pg.locator("[role=status]").allTextContents()).join(" | "),
        };
      };

      // ---------- alex ----------
      const X1 = await browse("alex");
      const pg = X1.pg;
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const row = pg.locator('[data-rate-row="5"]');
      await row.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const rowText = await row.innerText();
      check((await row.getAttribute("data-rated")) === "yes" && /You gave Episode 5/.test(rowText) && /3\.7/.test(rowText), "Tonight's Extras: Episode 5, rated, the couch's 3.7", rowText);
      await row.scrollIntoViewIfNeeded();
      await X1.shot("tonight-rated");
      await X1.wide("Tonight");
      await row.click();
      const sheet = pg.locator('[data-rate-sheet="5"]');
      await sheet.waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(500);
      check((await pg.locator("[data-verdict-score]").innerText()) === "3.7" && (await pg.locator("[data-verdict-person]").count()) === 3, "the sheet: the verdict, everyone's stars");
      check(/far too slow/.test(await pg.locator("[data-verdict]").innerText()) && (await pg.locator("[data-take-input]").inputValue()) === "Best tribal of the season", "their takes, and his own in the field");
      check(/Everyone on Game Your Show/.test(await pg.locator("[data-verdict-everyone]").innerText()), "and everyone's, beside the couch's");
      await X1.shot("sheet-rated");
      await pg.locator('[data-star="3"]').click();
      await pg.waitForFunction(() => document.querySelector("[data-verdict-score]")?.textContent === "3.0", null, { timeout: 10_000 }).catch(() => {});
      check((await pg.locator("[data-verdict-score]").innerText()) === "3.0" && (await stored("alex", 5)).stars === 3, "three stars: saved, the verdict moves to 3.0");
      check((await pg.locator("[data-verdict-said]").getAttribute("data-verdict-said")) === "agree", "and he agrees with the couch", await pg.locator("[data-verdict-said]").innerText().catch(() => ""));
      await pg.locator("[data-take-input]").fill("Tribal was chaos");
      await pg.locator("[data-take-save]").click();
      await pg.waitForFunction(() => /Your take is in/.test(document.body.innerText), null, { timeout: 10_000 }).catch(() => {});
      check((await stored("alex", 5)).take === "Tribal was chaos" && /Your take is in/.test(await X1.statuses()), "a new take: posted, the toast says so", await X1.statuses());
      await pg.waitForTimeout(400);
      await X1.shot("sheet-changed");
      await X1.wide("the rate sheet");
      await X1.sheet().getByRole("button", { name: "Done" }).click();
      await X1.closed();
      await pg.waitForFunction(() => /You gave Episode 5 ★★★(?!★)/.test(document.querySelector('[data-rate-row="5"]')?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
      check(/You gave Episode 5 ★★★(?!★)/.test(await row.innerText()), "Done: the row says three stars", await row.innerText());

      // Episodes, and the episode page.
      await pg.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
      await pg.locator('[data-ep="5"] [data-verdict-mark]').waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const mark = await pg.locator('[data-ep="5"] [data-verdict-mark]').innerText();
      check(/3\.0/.test(mark) && /you 3/.test(mark), "Episodes: Episode 5's mark, the couch's 3.0 and his 3", mark);
      await X1.shot("episodes");
      await X1.wide("Episodes");
      await pg.locator('[data-ep="5"]').click();
      await pg.locator('[data-episode-rate] [data-rate-row="5"]').waitFor({ timeout: 20_000 });
      await pg.locator("[data-episode-rate]").scrollIntoViewIfNeeded();
      await pg.waitForTimeout(500);
      check(/You gave Episode 5/.test(await pg.locator("[data-episode-rate]").innerText()), "the episode page: How was it?");
      await X1.shot("episode-page");

      // The hub: Couch verdicts, the profile, By the numbers. (The fixture's couch is new, so the hub would grow with it:
      // ?hub=focus asks for the shape with More on the couch, as check-new-hub does.)
      await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      // The row's wrapper is display: contents (no box of its own): its button is what shows.
      const vrow = pg.locator('[data-more="verdicts"] button');
      await vrow.waitFor({ timeout: 30_000 });
      await pg.waitForFunction(() => /How the couch rated 1 show/.test(document.querySelector('[data-more="verdicts"]')?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => {});
      check(/How the couch rated 1 show/.test(await vrow.innerText()), "More on the couch: How the couch rated 1 show", await vrow.innerText());
      await vrow.scrollIntoViewIfNeeded();
      await vrow.click();
      await pg.locator(`[data-couch-page="verdicts"] [data-verdict-show="${sid}"]`).waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(700);
      const panel = pg.locator(`[data-verdict-show="${sid}"]`);
      check((await panel.locator("[data-verdict-score]").innerText()) === "3.0" && (await panel.locator("[data-verdict-person]").count()) === 3, "Couch verdicts: ZT Survivor 51's panel, 3.0, three faces");
      check(/far too slow/.test(await panel.locator("[data-verdict-take]").innerText()) && (await panel.locator("[data-verdict-bars] > span").count()) === 5, "jordan's take on its plate, five bars");
      check(/Taste twin: zt_nd_riley/.test(await pg.locator('[data-couch-page="verdicts"]').innerText()) && /contrarian/.test(await pg.locator('[data-couch-page="verdicts"]').innerText()), "and the footnote: his taste twin, the contrarian");
      check((await pg.locator('[data-couch-page="verdicts"] [data-preview]').count()) === 0, "no Preview left on it");
      await X1.shot("couch-verdicts");
      await X1.wide("Couch verdicts");
      await pg.goBack();
      await pg.waitForTimeout(600);
      await pg.getByRole("button", { name: "Your profile" }).click();
      await pg.locator("[data-your-numbers]").waitFor();
      await pg.waitForTimeout(500);
      const nums = await pg.locator("[data-your-numbers]").innerText();
      check(/Agree with the couch/.test(nums) && /Taste twin: zt_nd_riley/.test(nums), "the profile: Agree with the couch, Taste twin: riley", nums);
      await X1.shot("profile");
      await pg.keyboard.press("Escape");
      await X1.closed();
      await pg.locator('[data-more="numbers"] button').click();
      await pg.locator('[data-couch-page="numbers"] [data-accolades]').waitFor({ timeout: 20_000 });
      const accs = await pg.$$eval('[data-couch-page="numbers"] [data-accolade-row]', (els) => els.map((x) => x.dataset.accoladeRow));
      check(["twins", "contrarian", "rates"].every((k) => accs.includes(k)), "By the numbers: taste twins, the contrarian, never misses a rating", accs.join());
      await pg.locator('[data-couch-page="numbers"] [data-accolade-row="twins"]').scrollIntoViewIfNeeded();
      await pg.waitForTimeout(400);
      await X1.shot("accolades");
      check(X1.errors().length === 0, "no page errors (alex)", X1.errors().join(" | "));

      // ---------- sam, behind ----------
      const S = await browse("sam");
      await S.pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const srow = S.pg.locator('[data-rate-row="3"]');
      await srow.waitFor({ timeout: 30_000 });
      await S.pg.waitForTimeout(800);
      check((await srow.getAttribute("data-rated")) === "no" && /Rate Episode 3/.test(await srow.innerText()), "sam's Tonight: Rate Episode 3 (his latest)", await srow.innerText());
      check((await S.pg.locator('[data-rate-row="4"], [data-rate-row="5"]').count()) === 0, "nothing for 4 or 5");
      await srow.click();
      await S.pg.locator('[data-rate-sheet="3"]').waitFor({ timeout: 20_000 });
      await S.pg.waitForTimeout(500);
      check(/3 on the couch rated it/.test(await S.pg.locator("[data-verdict-wait]").innerText()) && (await S.pg.locator("[data-verdict]").count()) === 0, "the sheet: three rated it; the verdict waits for his stars");
      await S.shot("sheet-unrated");
      await S.pg.locator('[data-star="4"]').click();
      await S.pg.locator("[data-verdict]").waitFor({ timeout: 10_000 });
      await S.pg.waitForTimeout(500);
      check((await stored("sam", 3)).stars === 4 && (await S.pg.locator("[data-verdict-person]").count()) === 4, "four stars: saved, and the verdict lands with all four", String((await stored("sam", 3))?.stars));
      check(!/far too slow|Tribal was chaos/.test(await S.sheet().innerText()), "nothing said about Episode 5");
      await S.shot("sheet-rated");
      await S.wide("sam's rate sheet");
      await S.sheet().getByRole("button", { name: "Done" }).click();
      await S.closed();
      await S.pg.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
      await S.pg.locator('[data-ep="3"] [data-verdict-mark]').waitFor({ timeout: 30_000 });
      check((await S.pg.locator("[data-ep-hidden] [data-verdict-mark]").count()) === 0, "his Episodes: a mark on 3, none on the hidden ones");
      await S.shot("episodes");
      check(S.errors().length === 0, "no page errors (sam)", S.errors().join(" | "));

      // ---------- riley: a show she only watches ----------
      const R = await browse("riley");
      await R.pg.goto(`${BASE}/show/${tsid}/episodes`, { waitUntil: "load" });
      const r1 = R.pg.locator('[data-ep="1"], [data-ep-aired="1"]').first();
      await r1.waitFor({ timeout: 30_000 });
      await R.pg.waitForTimeout(800);
      const r2 = await R.pg.locator('[data-ep="2"] [data-verdict-mark], [data-ep-aired="2"] [data-verdict-mark]').first().innerText().catch(() => "");
      check(/3\.0/.test(r2) && /you 3/.test(r2), "riley's Traitors Episodes: Episode 2, hers alone (3.0)", r2);
      await R.shot("traitors-episodes");
      await R.pg.goto(`${BASE}/show/${tsid}/tonight`, { waitUntil: "load" });
      const rrow = R.pg.locator('[data-rate-row="2"]');
      await rrow.waitFor({ timeout: 30_000 });
      await rrow.click();
      await R.pg.locator('[data-rate-sheet="2"]').waitFor({ timeout: 20_000 });
      await R.pg.waitForTimeout(500);
      check(/first on the couch/.test(await R.sheet().innerText()) && !/turret/.test(await R.sheet().innerText()), "the sheet: she's the first on the couch (jordan's private stars and take nowhere)");
      await R.shot("traitors-sheet");
      check(R.errors().length === 0, "no page errors (riley)", R.errors().join(" | "));

      // ---------- solo ----------
      const b = await open({ user: soloFixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      const sp = b.page;
      await sp.goto(`${BASE}/show/${so.seasonId}/tonight`, { waitUntil: "load" });
      const solorow = sp.locator('[data-rate-row="5"]');
      await solorow.waitFor({ timeout: 30_000 });
      await sp.waitForTimeout(800);
      check(/how everyone rated it/.test(await solorow.innerText()), "solo Tonight: Rate Episode 5, then see how everyone rated it", await solorow.innerText());
      await solorow.click();
      await sp.locator('[data-rate-sheet="5"]').waitFor({ timeout: 20_000 });
      await sp.waitForTimeout(500);
      check(/2 on Game Your Show rated it/.test(await sp.locator("[data-verdict-wait]").innerText()), "the sheet: two on Game Your Show rated it");
      await sp.locator('[data-star="5"]').click();
      await sp.locator("[data-verdict]").waitFor({ timeout: 10_000 });
      await sp.waitForTimeout(500);
      const plate = await sp.locator("[data-verdict]").innerText();
      check(/Everyone.s verdict/i.test(plate) && (await sp.locator("[data-verdict-score]").innerText()) === "3.7" && /from 3 on Game Your Show/.test(plate), "five stars: everyone's verdict, 3.7 from 3", plate);
      check((await sp.locator("[data-verdict-person]").count()) === 0 && !/stranger/.test(plate), "no faces, no strangers' takes");
      check((await sp.locator("[data-verdict-said]").getAttribute("data-verdict-said")) === "contrarian" && /Everyone else saw it differently/.test(plate), "and he's far from everyone else (5 against their 3)", plate);
      await sp.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-solo-sheet.png`) });
      const over = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 1, "solo sheet: nothing wider than the screen", `${over}px`);
      check(b.errors.filter((x) => !/favicon/.test(x)).length === 0, "no page errors (solo)", b.errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await soloFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
