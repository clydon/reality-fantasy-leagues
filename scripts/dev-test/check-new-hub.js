// Dev-only check for the hub (docs/PLAN-new-design.md step 0d's port, step 8's real data), against the dev server, on
// new-fixture.js's couch plus hub-fixture.js's two finished seasons (ZT Survivor 49 and 50):
//   API, GET /api/couches/[id]/hub:
//   - power rankings: each person's total is the sum of their place points (10 for first down to 1 for last) over the
//     couch's games, recomputed here from each season's own /games tables; This year leaves out last year's season;
//     head to head from the same tables;
//   - the trophy shelf: titles, a plaque per finished game, Ran it back (riley won both Outlasts), the records;
//   - your games (with your place), your numbers, the couch's accolades;
//   - the guard: sam (on Episode 3 of 51) gets the standings as his /games has them at his mark, and the feed leaves out
//     what others said since an episode he hasn't seen aired (the Traitors' chat is folded for alex, who hasn't started
//     it); founders don't show as "joined"; someone off the couch gets a 404;
//   - /api/me/home: a show's results ask you to reveal (sam) or nothing (alex).
//   In a real browser as alex, at --width (390 by default):
//   - the hub in each shape (?hub=focus, grow, new); the status line and Up next lead with results to reveal once alex
//     is a week behind (and Up next's plate opens the show's Results are in); posters carry your best place and flip to
//     your games; the feed; More on the couch's rows say your place and titles, and each page opens over the hub (?page=)
//     with real data (rankings and its tabs, Commercial break, By the numbers' accolades, Previously on for two shows, the
//     trophy shelf), and back closes it; the profile's numbers; the grow note's lines open their pages;
//   - every hub.* entry of the Preview registry (src/new/preview.ts) still shows somewhere; Up next's art grows into the
//     show bar (the channel change); nothing wider than the screen; no page errors.
// Screenshots of each shape (a screen at a time), the sheet and every page go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-hub.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js and hub-fixture.js up and takes them down (--keep leaves them); touches zt-nd rows only;
// refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const hubFixture = require("./hub-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-hub runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-hub.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const PAGES = ["rankings", "break", "numbers", "verdicts", "previously", "trophies"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** A place's points: the same rule as couch-standings.ts, written out again here. */
const placePoints = (place, of) => (of < 2 ? 0 : Math.round(1 + (9 * (of - Math.min(place, of))) / (of - 1)));

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const hx = await hubFixture.up(pool, fx);
    const sid = fx.seasonId;
    const seasons = [hx.seasons.s49, hx.seasons.s50, sid];
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);
    const year = new Date().getFullYear();
    const yearOf = Object.fromEntries(
      (await pool.query("SELECT id, extract(year FROM premiere_date)::int AS y FROM show_seasons WHERE id = ANY($1::uuid[])", [seasons])).rows.map((r) => [r.id, r.y])
    );
    const markTo = async (who, n) => {
      const L = fx.leagues;
      await pool.query("UPDATE league_memberships SET results_seen_through = $2 WHERE user_id = $1 AND league_id = ANY($3::uuid[])", [fx.users[who], n, [L.outlast, L.lineup, L.pool]]);
      await pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    };

    // ---------------- the API ----------------
    const as = {};
    for (const who of ["alex", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const hubOf = async (who) => {
      const { status, body } = await as[who].call("GET", `/api/couches/${fx.couchId}/hub`);
      if (status !== 200) throw new Error(`${who}'s hub: ${status} ${JSON.stringify(body)}`);
      return body;
    };
    /** Each person's place points over the couch's games, from the viewer's own /games tables. */
    async function expected(who, filter = () => true) {
      const totals = new Map();
      const tables = [];
      for (const s of seasons) {
        const { body } = await as[who].call("GET", `/api/seasons/${s}/games?couch=${fx.couchId}`);
        for (const g of body.games ?? []) {
          tables.push({ season: s, g });
          if (!filter(s) || g.through < 1 || g.table.length < 2) continue;
          for (const r of g.table) if (r.userId) totals.set(r.userId, (totals.get(r.userId) ?? 0) + placePoints(r.place, g.table.length));
        }
      }
      return { totals, tables };
    }
    const same = (rows, totals) => rows.length === totals.size && rows.every((r) => totals.get(r.userId) === r.total);

    const alexHub = await hubOf("alex");
    const all = await expected("alex");
    const thisYear = await expected("alex", (s) => yearOf[s] === year);
    check(same(alexHub.rankings.all, all.totals), "rankings all-time: everyone's place points over every game, as each season's /games has them", JSON.stringify(alexHub.rankings.all.map((r) => [r.name, r.total])));
    check(same(alexHub.rankings.year, thisYear.totals), "rankings this year: last year's season left out", JSON.stringify(alexHub.rankings.year.map((r) => [r.name, r.total])));
    check(alexHub.rankings.counted.all === 6 && alexHub.rankings.counted.year === (yearOf[hx.seasons.s50] === year ? 5 : 3), "six games count all-time, this year's without Survivor 49", JSON.stringify(alexHub.rankings.counted));
    check(alexHub.rankings.year.every((r, i, a) => i === 0 || a[i - 1].total >= r.total), "the table is in order");
    const riley = fx.users.riley;
    const h2h = { won: 0, lost: 0, tied: 0, games: 0 };
    for (const { g } of all.tables) {
      const me = g.table.find((r) => r.userId === fx.users.alex);
      const them = g.table.find((r) => r.userId === riley);
      if (!me || !them || g.through < 1) continue;
      h2h.games++;
      if (me.place < them.place) h2h.won++;
      else if (me.place > them.place) h2h.lost++;
      else h2h.tied++;
    }
    const vsRiley = alexHub.rankings.h2h.find((h) => h.userId === riley);
    check(!!vsRiley && ["won", "lost", "tied", "games"].every((k) => vsRiley[k] === h2h[k]), "head to head against riley, game by game", JSON.stringify([vsRiley, h2h]));

    const t = alexHub.trophies;
    const ended = all.tables.filter(({ season }) => season !== sid);
    const alexTitles = ended.filter(({ g }) => g.table.find((r) => r.userId === fx.users.alex)?.place === 1).length;
    check(!!t && t.titles === alexTitles && alexTitles === 1, "trophy shelf: alex's titles are the finished games alex won (Pool 50)", JSON.stringify(t && t.titles));
    check(t?.plaques.length === 3 && t.plaques.every((p) => p.label !== "ZT Survivor 51"), "a plaque per finished game, none for the season still going");
    const cup50 = t?.plaques.find((p) => p.leagueId === hx.leagues.cup50);
    check(!!cup50 && cup50.ranItBack && cup50.winners[0].userId === riley, "riley ran it back: Cup 49 and Cup 50");
    const rec = Object.fromEntries((t?.records ?? []).map((r) => [r.key, r]));
    check(rec.titles?.who.userId === riley && rec.titles.line === "2 titles" && rec.ranItBack?.who.userId === riley, "couch records: most titles and ran it back are riley's", JSON.stringify(t?.records));
    check(t?.leader?.who.userId === riley && t.leader.titles === 2, "riley holds the most titles");
    const g51 = alexHub.games.filter((g) => g.seasonId === sid);
    const games51 = all.tables.filter(({ season }) => season === sid).map(({ g }) => g);
    check(g51.length === 3 && g51.every((g) => !g.ended && g.rank === games51.find((x) => x.leagueId === g.leagueId)?.you?.rank), "your three games on 51, still going, with your place from /games", JSON.stringify(g51.map((g) => g.rank)));
    check(alexHub.games.filter((g) => g.ended).length === 3, "and your three finished ones");
    const meRow = alexHub.rankings.year.find((r) => r.userId === fx.users.alex);
    check(alexHub.you.titles === 1 && alexHub.you.points === meRow.total && alexHub.you.seasons === 3, "your numbers: a title, this year's points, three seasons", JSON.stringify(alexHub.you));
    const acc = Object.fromEntries(alexHub.accolades.map((a) => [a.key, a]));
    check(acc.shows?.userId === riley && /2 shows/.test(acc.shows.line), "accolades: riley follows the most shows (jordan's private Traitors follow doesn't count)", JSON.stringify(acc.shows));
    check(acc.watched?.line === "4 of 4 watch it", "the most-watched show");
    const feed = alexHub.feed;
    check(feed.length > 0 && feed.length <= 8 && feed.every((e, i) => i === 0 || Date.parse(feed[i - 1].at) >= Date.parse(e.at)), "the feed: eight at most, newest first");
    check(feed.some((e) => e.kind === "said" && e.text === "anyone rewatching before Tuesday?"), "the feed has what jordan said this morning");
    check(!feed.some((e) => fixture.TRAITORS_CHAT.some(([, text]) => e.text === text)), "the Traitors' chat stays folded for alex, who hasn't started it");
    check(!feed.some((e) => e.kind === "joined"), "founders of the couch don't show as having joined it");

    const samHub = await hubOf("sam");
    const samAll = await expected("sam");
    check(same(samHub.rankings.all, samAll.totals), "sam's rankings are as his /games has them at Episode 3 (nothing past it)", JSON.stringify(samHub.rankings.all.map((r) => [r.name, r.total])));
    const after4 = fixture.CHAT.filter(([, who, type, , n, offset]) => type === "message" && who !== "sam" && (n > 4 || (n === 4 && !offset.startsWith("-")) || n === null)).map(([, , , text]) => text);
    check(!samHub.feed.some((e) => after4.includes(e.text)), "sam's feed leaves out what others said since Episode 4 aired", JSON.stringify(samHub.feed.map((e) => e.text)));
    const samHome = await as.sam.call("GET", "/api/me/home");
    const alexHome = await as.alex.call("GET", "/api/me/home");
    const res = (home) => home.body.shows.find((s) => s.seasonId === sid)?.results;
    check(JSON.stringify(res(samHome)) === JSON.stringify({ reveal: { episode: 4, stage: "final" }, final: null }), "the home tells sam Episode 4's results are in", JSON.stringify(res(samHome)));
    check(JSON.stringify(res(alexHome)) === JSON.stringify({ reveal: null, final: null }), "and alex nothing", JSON.stringify(res(alexHome)));
    check((await as.casey.call("GET", `/api/couches/${fx.couchId}/hub`)).status === 404, "someone off the couch gets a 404");

    // ---------------- the browser ----------------
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    close = b.close;
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() => {
      window.__vt = [];
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (arg) {
          const entry = { nav: document.documentElement.dataset.nav || null, anims: [] };
          window.__vt.push(entry);
          const t = start.call(this, arg);
          t.ready.then(() => (entry.anims = document.documentElement.getAnimations({ subtree: true }).map((a) => a.effect?.pseudoElement || ""))).catch(() => {});
          return t;
        };
      // Next's dev badge sits over the screen's bottom-left.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const seen = new Set();
    const collect = async () => (await page.$$eval("[data-preview]", (els) => els.map((e) => e.dataset.preview))).forEach((id) => seen.add(id));
    const text = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 10_000 }).catch(() => "")) || "").replace(/\s+/g, " ").trim();
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    // A screen at a time down the page (the document scrolls), or down a pushed page (it scrolls itself).
    async function shoot(name, scroller = null) {
      const height = await page.evaluate((s) => (s ? document.querySelector(s).scrollHeight : document.documentElement.scrollHeight), scroller);
      for (let k = 0, y = 0; y < height - 120 && k < 8; k++, y += 780) {
        await page.evaluate(([s, top]) => (s ? (document.querySelector(s).scrollTop = top) : window.scrollTo(0, top)), [scroller, y]);
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${name}-${k}.png`) });
      }
      await page.evaluate((s) => (s ? (document.querySelector(s).scrollTop = 0) : window.scrollTo(0, 0)), scroller);
    }
    const hubReady = async (q = "focus") => {
      await page.goto(`${BASE}/home?hub=${q}`, { waitUntil: "networkidle" });
      await page.locator("[data-hub]").waitFor({ timeout: 30_000 });
      await page.locator("[data-feed-list] [data-feed], [data-feed-list] p").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
    };

    // ---- the hub, in each shape ----
    for (const shape of ["focus", "grow", "new"]) {
      await hubReady(shape);
      await collect();
      await fits(`hub (${shape})`);
      await shoot(`hub-${shape}`);
    }
    check(seen.has("hub.guide") && seen.has("hub.get-going"), "the guide is on the hub, and a new couch gets Get the couch going");

    // ---- the status line, Up next, posters and the feed ----
    await hubReady();
    check((await page.locator("[data-hub] [data-status]").getAttribute("data-status")) === "moves", "with moves due, the status line says so", await text("[data-hub] [data-status]"));
    const poster = page.locator(`[data-poster="${sid}"]`);
    check(/Best 1st/.test(await poster.locator("[data-best]").textContent()), "Survivor 51's poster: your best place, 1st");
    check(/Best 3rd/.test((await page.locator(`[data-poster="${hx.seasons.s49}"] [data-best]`).textContent()) || ""), "Survivor 49's: where you finished, 3rd");
    await poster.scrollIntoViewIfNeeded();
    await poster.locator("[data-flip]").click();
    await page.waitForTimeout(900);
    check((await poster.locator("[data-flipped]").count()) === 1, "the corner flips it over");
    const rear = await poster.textContent();
    check(/Outlast/.test(rear) && /Weekly Lineup/.test(rear) && /Survival Pool/.test(rear), "to your three games there with your place in each", rear.replace(/\s+/g, " "));
    await page.screenshot({ path: path.join(out, "poster-flipped.png") });
    await poster.locator("[data-unflip]").click();
    await page.waitForTimeout(900);
    check((await poster.locator("[data-flipped]").count()) === 0, "and back");
    check(/anyone rewatching before Tuesday\?/.test(await text("[data-feed-list]")), "On the couch: what jordan said");
    check(!/castle looks unreal|round table was brutal|shield goes to Eli/.test(await text("[data-feed-list]")), "and nothing from a show alex hasn't started");

    // ---- More on the couch: the rows ----
    const keys = await page.$$eval("[data-more]", (els) => els.map((e) => e.dataset.more));
    check(PAGES.every((k) => keys.includes(k)), "More on the couch has all six rows (rankings: something scored; trophies: a season ended)", keys.join(","));
    check(/You lead the couch this year/.test(await text('[data-more="rankings"]')), "the rankings row says where you stand", await text('[data-more="rankings"]'));
    check(/1 title · 3 seasons played/.test(await text('[data-more="trophies"]')), "the trophy shelf row says your titles", await text('[data-more="trophies"]'));

    // ---- each page ----
    const pageOpen = "[role=dialog][aria-hidden=false]";
    for (const key of PAGES) {
      const row = page.locator(`[data-more="${key}"] button`);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForURL(new RegExp(`page=${key}`));
      await page.locator(`[data-couch-page="${key}"]`).waitFor();
      await page.waitForTimeout(700);
      const body = `[data-couch-page="${key}"]`;
      if (key === "rankings") {
        check(/1st/.test(await text(`${body} [data-hero]`)) && (await page.locator(`${body} [data-rank-row]`).count()) === 4, "Power rankings: you're 1st of four this year");
        await page.locator(`${body} [data-rank-tab="all"]`).click();
        check((await page.locator(`${body} [data-rank-row]`).count()) === 4 && /All-time/.test(await text(`${body} [data-hero]`)), "All-time");
        await page.locator(`${body} [data-rank-tab="h2h"]`).click();
        check((await page.locator(`${body} [data-h2h]`).count()) === 3, "Head to head: a row for each of the other three");
        await page.locator(`${body} [data-rank-tab="year"]`).click();
      } else if (key === "break") {
        check((await page.locator(`${body} [data-playing]`).count()) === 3, "Commercial break: the three games you're playing (not the finished ones)");
        check((await page.locator(`${body} [data-preview="hub.episode-games"]`).count()) === 1 && (await page.locator(`${body} [data-preview="hub.start-game"]`).count()) === 1, "episode games (12) and Start a game (10) stay Preview");
      } else if (key === "numbers") {
        await page.locator(`${body} [data-accolades]`).waitFor({ timeout: 20_000 });
        check((await page.locator(`${body} [data-accolade-row]`).count()) === alexHub.accolades.length, "By the numbers: the couch's accolades");
        check((await page.locator(`${body} [data-accolade]`).count()) >= 1, "and one in the deck");
      } else if (key === "verdicts") {
        check(await page.locator(`${body} [data-preview="hub.verdicts"]`).isVisible(), "Couch verdicts stay Preview until step 12's ratings");
      } else if (key === "previously") {
        await page.locator(`${body} [data-po-last]`).first().waitFor({ timeout: 20_000 });
        const where = await page.locator(`${body} [data-previously]`).getAttribute("data-previously");
        check(where === sid || seasons.includes(where), "Previously on opens on one of your shows");
        await page.locator(`${body} [data-po="${sid}"]`).click();
        await page.locator(`${body} [data-previously="${sid}"] [data-po-last]`).first().waitFor({ timeout: 20_000 });
        check(/Up to Episode 5/.test(await text(`${body} [data-po-safe]`)), "Survivor 51: up to Episode 5, nothing past it");
        check((await page.locator(`${body} [data-po-ep]`).count()) === 5 && (await page.locator(`${body} [data-po-gone] > span`).count()) === 5, "five episodes, five gone (one a week)");
        check((await page.locator(`${body} [data-po-still]`).count()) === 1, "still in, by tribe");
        await shoot("more-previously-51", pageOpen);
        await page.locator(`${body} [data-po="${hx.seasons.s50}"]`).click();
        await page.locator(`${body} [data-previously="${hx.seasons.s50}"] [data-po-last]`).first().waitFor({ timeout: 20_000 });
        check((await page.locator(`${body} [data-po-ep]`).count()) === 13, "Survivor 50: all thirteen, to the finale");
      } else if (key === "trophies") {
        check((await page.locator(`${body} [data-plaque]`).count()) === 3 && /Ran it back/.test(await text(body)), "Trophy shelf: three plaques, Ran it back");
        check((await page.locator(`${body} [data-record]`).count()) === t.records.length && /riley holds the most, with 2/.test(await text(`${body} [data-hero]`)), "the couch's records, and who holds the most titles");
      }
      await collect();
      await fits(`More › ${key}`);
      await shoot(`more-${key}`, pageOpen);
      await page.goBack();
      await page.waitForTimeout(600);
      check(!page.url().includes("page=") && new URL(page.url()).pathname === "/home", `back closes ${key}`);
    }

    // ---- the profile sheet ----
    await page.getByRole("button", { name: "Your profile" }).click();
    await page.locator("[data-your-numbers]").waitFor();
    check(/1\s*Title/.test(await text("[data-your-numbers]")) && /3\s*Seasons played/.test(await text("[data-your-numbers]")), "the profile: your titles and seasons played", await text("[data-your-numbers]"));
    await collect();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, "profile.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ---- the grow note's lines open their pages ----
    await hubReady("grow");
    check((await page.locator("[data-grow]").count()) === 3, "grows with you: rankings, By the numbers and the trophy shelf are all in, so each is a way in");
    await page.locator('[data-grow="trophies"]').click();
    await page.waitForURL(/page=trophies/);
    check(await page.locator('[data-couch-page="trophies"]').isVisible(), "and opens its page");
    await page.goBack();
    await page.waitForTimeout(500);

    // ---- a week behind: results lead ----
    await markTo("alex", 4);
    await hubReady();
    check((await page.locator("[data-hub] [data-status]").getAttribute("data-status")) === "reveal" && /Results are in · ZT Survivor Episode 5/.test(await text("[data-hub] [data-status]")), "a week behind: the status line leads with the results", await text("[data-hub] [data-status]"));
    check((await page.locator("[data-upnext]").getAttribute("data-upnext")) === "reveal" && /Episode 5 results are in/.test(await text("[data-upnext]")), "and so does Up next, with Reveal on its plate");
    await page.screenshot({ path: path.join(out, "hub-results-in.png") });
    await page.locator("[data-upnext] a.nd-press").click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await page.locator("[data-results-in='5']").waitFor({ timeout: 20_000 });
    check(true, "its plate opens the show at Results are in");
    await markTo("alex", 5);

    // ---- every hub entry showed somewhere ----
    const missing = Object.keys(PREVIEWS).filter((id) => id.startsWith("hub.") && !seen.has(id));
    check(missing.length === 0, "every hub.* Preview entry renders", missing.join(", "));

    // ---- Up next grows its art into the show bar ----
    await hubReady();
    await page.evaluate(() => (window.__vt.length = 0));
    await page.locator("[data-art-scope] h2 a").click();
    await page.waitForURL(`**/show/**/tonight`);
    await page.waitForTimeout(700);
    const vt = await page.evaluate(() => window.__vt.at(-1) || null);
    check(!!vt && vt.nav === "channel" && vt.anims.some((a) => a.includes("nd-art")), "Up next: its art grows into the show bar", JSON.stringify(vt));

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e) && !/favicon\.ico/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    await close();
    if (!args.includes("--keep")) {
      await hubFixture.down(pool);
      await fixture.down(pool);
    }
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
