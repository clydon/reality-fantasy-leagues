// Dev-only check of the drill pass's doors (docs/design-round/drill-audit.md): each face, name or row that now opens a level is
// tapped on new-fixture.js's couch as alex, and the level it opens must appear over the surface. One frame before the tap and one
// after for each (<out>/<door>.before.jpg, .after.jpg), for the round's screenshot story, and a PASS, FAIL or SKIP line each:
//   chat-face        the show's Chat: someone else's face opens them on the couch (couch/person-sheet.tsx)
//   rank-row         the hub's Power rankings: a row opens that person on the couch
//   h2h-row          the same page's Head to head: a row opens that person on the couch
//   bet-caller       a game page's Side bets: who called it opens their sheet in the game
//   matchup-head     a head-to-head matchup's two heads open each person in the game (SKIP: the test couch has no head to head)
//   morning-row      the final results' morning sheet: a standings row opens that person in the game (SKIP unless one is due)
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
  async function door(id, { go, door: find, opened, skip }) {
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
  });
  // The couch's pages open over the hub by their ?page= (couch-pages.tsx).
  const rankings = async () => {
    await p.goto(`${BASE}/home?page=rankings`, { waitUntil: "domcontentloaded" });
    await p.locator('[data-couch-page="rankings"]').waitFor({ timeout: 45000 });
    await wait(p, 1000);
  };
  await door("rank-row", { go: rankings, door: async () => p.locator("[data-rank-row]:not(:disabled)").nth(1), opened: couchPerson });
  await door("h2h-row", {
    go: async () => {
      await rankings();
      await p.locator('[data-couch-page="rankings"] button:has-text("Head to head")').first().click();
      await wait(p, 700);
    },
    door: async () => p.locator("[data-h2h]:not(:disabled)").first(),
    opened: couchPerson,
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
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await b.close();
  const failed = results.filter((r) => r[1] === "FAIL").length;
  console.log(`${results.length} doors: ${results.filter((r) => r[1] === "PASS").length} pass, ${failed} fail, ${results.filter((r) => r[1] === "SKIP").length} skipped`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
