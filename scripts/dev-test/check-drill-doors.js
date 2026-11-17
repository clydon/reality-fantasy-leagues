// Dev-only check of the drill pass's doors (docs/design-round/drill-audit.md): each face, name or row that now opens a level is
// tapped on new-fixture.js's couch as alex, and the level it opens must appear over the surface; then the phone's back (the
// browser's, page.goBack(): sheet-history.ts) must take down that level alone, the surface still there as it was, and where the
// door opened a sheet over a sheet, a second back the one under it (one level a back, the same everywhere: the user, 2026-11-17).
// Frames before the tap, after it and after the back (<out>/<door>.before.jpg, .after.jpg, .back.jpg), for the round's
// screenshot story, and a PASS, FAIL or SKIP line each (BACK lines for the backs):
//   chat-face        the show's Chat: someone else's face opens them on the couch (couch/person-sheet.tsx)
//   rank-row         the hub's Power rankings: a row opens that person on the couch
//   h2h-row          the same page's Head to head: a row opens that person on the couch
//   bet-caller       a game page's Side bets: who called it opens their sheet in the game
//   matchup-head     a head-to-head matchup's two heads open each person in the game (SKIP: the test couch has no head to head)
//   morning-row      the final results' morning sheet: a standings row opens that person in the game (SKIP unless one is due)
//   tonight-out      Tonight's Last time: who left opens the castaway's sheet
//   tonight-ledger   Tonight's Your games, Who scored opened: a castaway opens their sheet in that game
//   episode-out      an episode's page (Episodes): who left opens the castaway's sheet
//   episode-winner   the same page's What happened: a person (not a tribe) opens their sheet
//   episode-scorer   the same page's game best this episode: a castaway opens their sheet in that game
//
//   node scripts/dev-test/check-drill-doors.js [--out=.ui-atlas/stories/drill-doors/after] [--only=<regex>] [--width=390 --height=844]
//
// Needs the dev server (npm run dev; BASE= for another) and new-fixture.js up (node scripts/dev-test/new-fixture.js up). Reads only;
// touches nothing in the database. A page error prints as a PAGEERROR line.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/drill-doors/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-drill-doors runs against a local database only");

const wait = (p, ms) => p.waitForTimeout(ms);
const dialogs = (p) => p.locator('[role="dialog"]');
const results = [];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const season = (await one(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'zt-nd-survivor' AND ss.season_number = 51`))?.id;
  const lineup = (await one(`SELECT id FROM leagues WHERE slug = 'zt-nd-lineup'`))?.id;
  await pool.end();
  if (!season || !lineup) throw new Error("new-fixture.js isn't up (no zt-nd season or Lineup League)");
  const b = await open({ user: "zt_nd_alex", pass: "zt-pass-12345", width: W, height: H, motion: "reduce" });
  const p = b.page;
  p.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.split("\n")[0]}`));
  // The fixture's people are zt_nd_ usernames, which a face draws its initial from: shown without the prefix, as story-numbers.js does.
  await p.route("**/api/**", async (route) => {
    const res = await route.fetch().catch(() => null);
    if (!res) return route.abort();
    if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
    return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_nd_([a-z]+)"/g, '"$1"') });
  });
  const shot = (id, part) => p.screenshot({ path: path.join(OUT, `${id}.${part}.jpg`), type: "jpeg", quality: 84 });

  /** One door: `go` brings the surface up, `door` finds what to tap, `opened` is what must appear; frames either side of the tap. */
  async function door(id, { go, door: find, opened, skip, under = 0, still }) {
    if (ONLY && !new RegExp(ONLY).test(id)) return;
    try {
      await go();
      const el = await find();
      if (!el || !(await el.count())) {
        const why = skip ?? "nothing to tap";
        results.push([id, "SKIP", why]);
        return console.log(`SKIP ${id}: ${why}`);
      }
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await wait(p, 500);
      await shot(id, "before");
      const was = await dialogs(p).count();
      await el.click();
      await opened(was);
      await wait(p, 900);
      await shot(id, "after");
      results.push([id, "PASS", ""]);
      console.log(`PASS ${id}`);
      // The phone's back: the level the door opened goes, nothing else; the surface (`still`) is there as it was.
      const url = p.url();
      await p.goBack();
      await wait(p, 900);
      const left = await dialogs(p).count();
      const ok = left === was && p.url() === url && (!still || (await p.locator(still).first().isVisible()));
      await shot(id, "back");
      results.push([`${id} back`, ok ? "PASS" : "FAIL", ok ? "" : `${left} sheets up (want ${was}), ${p.url()}`]);
      console.log(`${ok ? "BACK PASS" : "BACK FAIL"} ${id}${ok ? "" : `: ${left} sheets up (want ${was})`}`);
      // A sheet under it (the side bets under a caller's sheet): one more back takes that one down too, the page staying.
      if (ok && under) {
        await p.goBack();
        await wait(p, 900);
        const after = await dialogs(p).count();
        const ok2 = after === was - under && p.url() === url;
        results.push([`${id} back twice`, ok2 ? "PASS" : "FAIL", ok2 ? "" : `${after} sheets up (want ${was - under})`]);
        console.log(`${ok2 ? "BACK PASS" : "BACK FAIL"} ${id} twice${ok2 ? "" : `: ${after} sheets up (want ${was - under})`}`);
      }
    } catch (e) {
      results.push([id, "FAIL", e.message.split("\n")[0]]);
      console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
    }
  }
  const couchPerson = async () => p.locator("[data-person-sheet]").last().waitFor({ timeout: 15000 });
  const anotherSheet = async (was) => p.waitForFunction((n) => document.querySelectorAll('[role="dialog"]').length > n, was, { timeout: 15000 });

  await door("chat-face", {
    go: async () => {
      await p.goto(`${BASE}/show/${season}/chat`, { waitUntil: "domcontentloaded" });
      await p.locator("[data-chat]").first().waitFor({ timeout: 45000 });
      await wait(p, 1500);
    },
    door: async () => p.locator("[data-msg] [data-door-person]").last(),
    opened: couchPerson,
    still: "[data-chat]",
  });
  // The couch's pages open over the hub by their ?page= (couch-pages.tsx).
  const rankings = async () => {
    await p.goto(`${BASE}/home?page=rankings`, { waitUntil: "domcontentloaded" });
    await p.locator('[data-couch-page="rankings"]').waitFor({ timeout: 45000 });
    await wait(p, 1000);
  };
  await door("rank-row", { go: rankings, door: async () => p.locator("[data-rank-row]:not(:disabled)").nth(1), opened: couchPerson, still: '[data-couch-page="rankings"]' });
  await door("h2h-row", {
    go: async () => {
      await rankings();
      await p.locator('[data-couch-page="rankings"] button:has-text("Head to head")').first().click();
      await wait(p, 700);
    },
    door: async () => p.locator("[data-h2h]:not(:disabled)").first(),
    opened: couchPerson,
    still: "[data-h2h]",
  });
  await door("bet-caller", {
    go: async () => {
      await p.goto(`${BASE}/show/${season}/game/${lineup}`, { waitUntil: "domcontentloaded" });
      await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
      await wait(p, 1200);
      const row = p.locator("[data-side-bets-row]").first();
      if (await row.count()) {
        await row.click();
        await dialogs(p).last().waitFor({ timeout: 12000 });
        await wait(p, 900);
      }
    },
    door: async () => p.locator('[role="dialog"] [data-call-of] [data-door-person]:not(:disabled)').first(),
    opened: anotherSheet,
    under: 1,
    still: "[data-bet]",
    skip: "no side bet with calls on the test couch",
  });
  await door("matchup-head", {
    go: async () => {},
    door: async () => p.locator("[data-matchup-head] [data-door-person]").first(),
    opened: anotherSheet,
    skip: "the test couch has no head-to-head game (the bench's pilot has one)",
  });
  await door("morning-row", {
    go: async () => {},
    door: async () => p.locator("[data-morning-row]").first(),
    opened: anotherSheet,
    skip: "no final results due on the test couch",
  });
  // Castaways wherever they appear (the drill pass's step 2): each opens the one castaway sheet over the page, back to the page.
  const castSheet = async () => p.locator("[data-cast-sheet]").last().waitFor({ timeout: 20000 });
  const tonight = async () => {
    await p.goto(`${BASE}/show/${season}/tonight`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-last-time], [data-mini-ledger]").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
  };
  await door("tonight-out", { go: tonight, door: async () => p.locator("[data-last-out][data-door-cast]").first(), opened: castSheet, still: "[data-last-time]", skip: "nobody left in the episode Tonight shows" });
  await door("tonight-ledger", {
    go: async () => {
      await tonight();
      const t = p.locator('[data-mini-ledger="closed"]').first();
      if (await t.count()) {
        await t.scrollIntoViewIfNeeded();
        await t.click();
        await wait(p, 600);
      }
    },
    door: async () => p.locator("[data-ledger-row][data-door-cast]").first(),
    opened: castSheet,
    still: "[data-ledger]",
    skip: "no Who scored on Tonight",
  });
  const episode = async () => {
    await p.goto(`${BASE}/show/${season}/episodes?page=ep5`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-episode-page]").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
  };
  await door("episode-out", { go: episode, door: async () => p.locator("[data-episode-page] > div [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "nobody left in Episode 5" });
  await door("episode-winner", { go: episode, door: async () => p.locator("[data-ep-happened] [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "no person in What happened" });
  await door("episode-scorer", { go: episode, door: async () => p.locator("[data-ep-scorers] [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "no best this episode" });
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await b.close();
  const failed = results.filter((r) => r[1] === "FAIL").length;
  console.log(`${results.length} doors: ${results.filter((r) => r[1] === "PASS").length} pass, ${failed} fail, ${results.filter((r) => r[1] === "SKIP").length} skipped`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
