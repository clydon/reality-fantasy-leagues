// Dev-only check for what a show calls things (src/lib/game/show-words.ts, db/migrations/0142), against the dev server, on
// new-fixture.js's couch and a stand-in for TVmaze (fake-listings.js) with one more sport pushed in: "ZT World Series", whose
// episodes are titled "Game 1: ZT Rays at ZT Brewers" and so on (six aired).
//   API: adding the World Series saves a sport that calls its episodes Game and its people Players; the stand-in F1 show ("Night 1"
//   titles, a word that says when) keeps Event; the show space's header carries the words.
//   In a real browser at --width (390 by default), as alex: the World Series' tabs say Schedule (its Games would read as the app's
//   Games tab) and Players, its show bar, Tonight and spoiler chip say Game, Schedule's rows carry the titles, Players says none
//   are listed and why; the fixture's Survivor still says Episodes and Castaways. Nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-show-words.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it; its down also removes the shows zt_nd
// people added); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-show-words runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-show-words.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const WS = 990013;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** The stand-in F1 show made over as a baseball series: "Game N: ZT Rays at ZT Brewers". */
function worldSeries(shows) {
  const f1 = shows.find((s) => s.show.id === 990012);
  const s = JSON.parse(JSON.stringify(f1));
  s.show = { ...s.show, id: WS, name: "ZT World Series", url: `https://www.tvmaze.com/shows/${WS}` };
  for (const x of s.seasons) {
    x.season.id = 9900091;
    x.episodes = x.episodes.map((e, i) => ({ ...e, id: 990009100 + i + 1, name: `Game ${e.number}: ZT Rays at ZT Brewers` }));
  }
  return s;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  tv.shows.push(worldSeries(tv.shows));
  const headers = { "x-gys-listings": tv.url };
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const alex = await api({ user: "zt_nd_alex", pass: PASSWORD, headers });
    const showOf = async (tvId) => (await pool.query("SELECT * FROM shows WHERE tvmaze_id = $1", [tvId])).rows[0];

    // ---- the words, saved as the shows are added ----
    const ws = await alex.call("POST", "/api/me/shows", { listing: WS, seenThrough: 6 });
    check(ws.status === 200, "alex adds ZT World Series", JSON.stringify(ws.body));
    const wsShow = await showOf(WS);
    check(wsShow?.kind === "sport" && wsShow.episode_term === "Game" && wsShow.castaway_term === "Player", "a sport: Game (from its titles) and Player", JSON.stringify({ kind: wsShow?.kind, episode: wsShow?.episode_term, person: wsShow?.castaway_term }));
    await alex.call("POST", "/api/me/shows", { listing: 990012 });
    const f1 = await showOf(990012);
    check(f1?.episode_term === "Event", "the F1 stand-in's 'Night 1' titles say when, not what: Event", f1?.episode_term);
    const wsSeason = ws.body.seasonId;
    const space = (await alex.call("GET", `/api/seasons/${wsSeason}/space`)).body;
    check(space?.show?.terms?.episode === "Game" && space.show.terms.castaway === "Player", "the space's header carries the words", JSON.stringify(space?.show?.terms));

    if (!apiOnly) {
      const b = await open({ user: "zt_nd_alex", pass: PASSWORD, width, motion: "off", headers });
      await b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
      close = b.close;
      const page = b.page;
      let n = 0;
      const shot = async (name) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where) => {
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
      };
      const tabs = () => page.locator('nav[aria-label="Show"] a').allInnerTexts();

      // ---- the World Series ----
      await page.goto(`${BASE}/show/${wsSeason}/tonight`);
      await page.locator("[data-phase]").waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => /Schedule/.test(document.querySelector('nav[aria-label="Show"]')?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
      const t1 = (await tabs()).map((x) => x.trim());
      check(t1.includes("Schedule") && t1.includes("Players") && t1.includes("Games") && !t1.includes("Episodes") && !t1.includes("Cast"), "its tabs: Schedule and Players beside the app's Games", t1.join());
      const phase = await page.locator("[data-phase]").innerText();
      check(/^Game 7/i.test(phase), "Tonight: Game 7 is up next", phase);
      check(/you're on Game 6/.test(await page.locator("[data-following]").innerText()), "the spoiler chip: you're on Game 6");
      const bar = await page.locator("header").first().innerText();
      check(/Game 7 ·/.test(bar), "the show bar: Game 7 · when", bar.replace(/\s+/g, " ").slice(0, 120));
      await shot("ws-tonight");
      await fits("the World Series' Tonight");

      await page.goto(`${BASE}/show/${wsSeason}/episodes`);
      await page.locator('[data-tab="episodes"]').waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => /Game 1: ZT Rays at ZT Brewers/.test(document.body.innerText), null, { timeout: 15_000 }).catch(() => {});
      const sched = await page.locator('[data-tab="episodes"]').innerText();
      check(/Game 7/i.test(sched) && /Every game/i.test(sched) && /Game 1: ZT Rays at ZT Brewers/.test(sched), "Schedule: this week's Game 7, every game, the titles of the ones he's seen", sched.replace(/\s+/g, " ").slice(0, 200));
      await shot("ws-schedule");
      await fits("Schedule");

      await page.goto(`${BASE}/show/${wsSeason}/cast`);
      await page.locator('[data-tab="cast"]').waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => /No players yet/i.test(document.body.innerText), null, { timeout: 15_000 }).catch(() => {});
      const cast = await page.locator('[data-tab="cast"]').innerText();
      check(/No players yet/i.test(cast) && /TV listings don't list a sport's players/.test(cast), "Players: none listed, and why", cast.replace(/\s+/g, " ").slice(0, 200));
      await shot("ws-players");

      // ---- a show made of episodes keeps its words ----
      await page.goto(`${BASE}/show/${fx.seasonId}/tonight`);
      await page.locator("[data-phase]").waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => /Castaways/.test(document.querySelector('nav[aria-label="Show"]')?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
      const t2 = (await tabs()).map((x) => x.trim());
      check(t2.includes("Episodes") && t2.includes("Castaways"), "ZT Survivor: Episodes and Castaways", t2.join());
      check(/^Episode \d/i.test(await page.locator("[data-phase]").innerText()), "and Tonight says Episode");
      check(!b.errors.length, "no page errors", b.errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close();
    await tv.close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
