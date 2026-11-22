// Dev-only test bank: a castaway's sheet opened from a week (BACKLOG 251; docs/design-round/week-door-spec.md), every way a week
// hands it, for the round's screenshot story. Run once on the code before the change (--out=.../before) and once after; a frame a
// build doesn't have (the week block's steps, its night door) is skipped with a SKIP line.
//
// couch set: new-fixture.js's couch as alex (Survivor 51's real castaways and photos; the couch's demo names), Lineup League:
//   week        alex's person sheet (Week by week) on a week with a 0 among its starters: the cards you tap
//   start       that week's top starter, tapped: their sheet (after: the week first, its moments adding up to the card's number)
//   start-back  the phone's back: alex's sheet again, on the same week
//   zero        the starter who scored 0, tapped
//   bench       a bench row, tapped: scored, didn't count
//   step        (after) the block's ‹: the week before, in place
//   night       (after) the block's episode: the night over the sheet
//   season-cell alex's season table, a number: that castaway at that week, for alex
//   table-cell  Everyone in this game, a number: that castaway at that week, nobody's lineup (no holder)
//   pool-pick   Survival Pool, alex's sheet, the week's pick: lands on that episode of the story (no game arithmetic to show)
//   cast-wall   the Cast tab's face wall, a face: no week handed, the sheet as it always opens
// captain set: play-pieces-fixture.js's captain case as Ann (a Weekly Lineup whose captain scores double; Ann named one for Ep 2):
//   captain     Ann's sheet, Episode 2, the captain tapped: the moments, then "Captain ×2" adding the rest
//
// Each frame is the first phone view (<id>.jpg), the whole sheet when it scrolls (<id>.full.jpg), its words (<id>.txt) and an
// overlap report (OVERLAP lines, overlaps.json: docs/DESIGN-PROCESS.md, "No words over words").
//
//   node scripts/dev-test/story-week-door.js [--set=couch,captain] [--out=.ui-atlas/stories/week-door/after] [--width=390 --height=844]
//                                            [--only=<regex on frame id>] [--up] [--down]
//   --up    brings the fixtures up first (new-fixture.js up --art; play-pieces-fixture.js up --only=captain);  --down  takes them down.
//
// Needs the dev server (npm run dev; BASE= for another). Touches only new-fixture.js's zt-nd rows and play-pieces' zt-gb rows; refuses a
// non-local database. Never run it beside another check on new-fixture.js.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/week-door/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const SETS = opt("set", "couch,captain").split(",");
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-week-door runs against a local database only");
const OVERLAPS = [];
const wait = (p, ms) => p.waitForTimeout(ms);
const top = (p) => p.locator('[role="dialog"]').last();
const wanted = (id) => !ONLY || new RegExp(ONLY).test(id);
const node = (file, ...a) => execFileSync(process.execPath, [path.join(__dirname, file), ...a], { stdio: "inherit" });

async function browser(user, pass) {
  const b = await open({ user, pass, width: W, height: H, motion: "reduce" });
  const p = b.page;
  p.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.split("\n")[0]}`));
  await p.addInitScript(() => {
    const hide = () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }));
    if (document.head) hide();
    else document.addEventListener("DOMContentLoaded", hide);
  });
  // zt_ usernames read without the prefix, as a couch's own names would (story-person-sheet.js's way).
  await p.route("**/api/**", async (route) => {
    const res = await route.fetch().catch(() => null);
    if (!res) return route.abort();
    if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
    return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_[a-z]+_([a-z]+)"/g, '"$1"') });
  });
  return b;
}

/** A frame: the first phone view, the whole top sheet when it scrolls, its words, its overlapping words. */
async function shoot(p, id) {
  if (!wanted(id)) return;
  const base = path.join(OUT, id);
  await wait(p, 500);
  const face = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!face) throw new Error("Archivo never loaded (is the dev server mid-recompile?)");
  const hits = await overlapsIn(p, H).catch(() => []);
  OVERLAPS.push({ frame: id, hits });
  for (const h of hits) console.log(`OVERLAP ${id}: "${h[0]}" over "${h[1]}"`);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 84 });
  fs.writeFileSync(base + ".txt", (await top(p).count()) ? await top(p).innerText() : await p.evaluate(() => document.body.innerText));
  const scroller = () => { const d = [...document.querySelectorAll('[role="dialog"]')].at(-1); return d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)); };
  const tall = await p.evaluate(`(${scroller})() && (() => { const d = [...document.querySelectorAll('[role="dialog"]')].at(-1); const sc = (${scroller})(); return sc.scrollHeight > sc.clientHeight + 4 ? d.getBoundingClientRect().height + (sc.scrollHeight - sc.clientHeight) : 0; })()`);
  if (tall) {
    const at = await p.evaluate(`((${scroller})() || {}).scrollTop || 0`);
    await p.setViewportSize({ width: W, height: Math.ceil(tall) + 80 });
    const style = await p.addStyleTag({ content: '[role="dialog"]{max-height:none!important} [role="dialog"] .overflow-y-auto{overflow:visible!important}' });
    await wait(p, 600);
    const box = await top(p).boundingBox();
    if (box) await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 80, clip: { x: 0, y: Math.max(0, box.y), width: W, height: Math.ceil(box.height) } });
    await style.evaluate((e) => e.remove());
    await p.setViewportSize({ width: W, height: H });
    await wait(p, 400);
    await p.evaluate(`(() => { const sc = (${scroller})(); if (sc) sc.scrollTop = ${at}; })()`);
  }
  console.log(`SHOT ${id}${tall ? " (+ whole sheet)" : ""}`);
}
const skip = (id, why) => wanted(id) && console.log(`SKIP ${id}: ${why}`);

/** The pane of a person's week in view (the pager keeps every week's pane side by side). */
const paneInView = (p) => p.evaluate((width) => {
  const panes = [...document.querySelectorAll('[role="dialog"] [data-week-pane]')];
  const x = panes.reverse().find((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.left < width - 1 && r.width > 0; });
  return x ? x.getAttribute("data-week-pane") : null;
}, W);
const castSheet = (p) => p.locator("[data-cast-sheet]").last().waitFor({ timeout: 20000 });

async function couch() {
  const pool = new Pool({ connectionString: DB });
  const one = async (sql, ps) => (await pool.query(sql, ps)).rows[0];
  const season = (await one(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'zt-nd-survivor' AND ss.season_number = 51`))?.id;
  const lineup = (await one(`SELECT id FROM leagues WHERE slug = 'zt-nd-lineup'`))?.id;
  const poolLeague = (await one(`SELECT id FROM leagues WHERE slug = 'zt-nd-pool'`))?.id;
  await pool.end();
  if (!season || !lineup) throw new Error("new-fixture.js isn't up: --up, or node scripts/dev-test/new-fixture.js up --art");
  const b = await browser("zt_nd_alex", "zt-pass-12345");
  const p = b.page;
  const gamePage = async (id = lineup) => {
    await p.goto(`${BASE}/show/${season}/game/${id}`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
  };
  const yourSheet = async (id) => {
    await gamePage(id);
    await p.locator("[data-door-you]").first().click();
    await p.locator("[data-sheet-player]").last().waitFor({ timeout: 15000 });
    await wait(p, 900);
  };
  try {
    // alex's week with a 0 among the starters (else the latest).
    await yourSheet();
    const bars = top(p).locator("[data-week-bar]");
    let ep = null, zero = null;
    for (let i = (await bars.count()) - 1; i >= 0; i--) {
      await bars.nth(i).click();
      await wait(p, 600);
      const n = await paneInView(p);
      if (!n) continue;
      const z = await p.evaluate((n) => [...document.querySelectorAll(`[role="dialog"] [data-week-pane="${n}"] [data-starter]`)].find((c) => c.querySelector("b.type-num")?.textContent?.trim() === "0")?.getAttribute("data-starter") ?? null, n);
      const hasStarters = await p.locator(`[role="dialog"] [data-week-pane="${n}"] [data-starter]`).count();
      if (hasStarters && ep === null) ep = n;
      if (z) { ep = n; zero = z; break; }
    }
    if (ep === null) throw new Error("no played week in alex's lineup");
    const toWeek = async () => {
      await yourSheet();
      const bar = top(p).locator("[data-week-bar]").filter({ hasText: new RegExp(`(^|\\D)${ep}$`) });
      const all = top(p).locator("[data-week-bar]");
      for (let i = 0; i < (await all.count()); i++) {
        await all.nth(i).click();
        await wait(p, 500);
        if ((await paneInView(p)) === ep) break;
      }
      void bar;
    };
    await toWeek();
    await shoot(p, "week");
    const pane = () => p.locator(`[role="dialog"] [data-week-pane="${ep}"]`).last();
    // The top starter (biggest first), tapped; then the phone's back.
    await pane().locator("[data-starter]").first().click();
    await castSheet(p);
    await wait(p, 900);
    await shoot(p, "start");
    if (await top(p).locator("[data-week-prev]").count()) {
      await top(p).locator("[data-week-prev]").first().click();
      await wait(p, 700);
      await shoot(p, "step");
    } else skip("step", "no ‹ on this build");
    if (await top(p).locator("[data-week-night]").count()) {
      await top(p).locator("[data-week-night]").first().click();
      await p.locator("[data-night-sheet]").last().waitFor({ timeout: 15000 }).catch(() => {});
      await wait(p, 900);
      await shoot(p, "night");
      await p.goBack();
      await wait(p, 900);
    } else skip("night", "no week block on this build");
    await p.goBack();
    await wait(p, 1000);
    await shoot(p, "start-back");
    if (zero) {
      await toWeek();
      await pane().locator(`[data-starter="${zero}"]`).click();
      await castSheet(p);
      await wait(p, 900);
      await shoot(p, "zero");
    } else skip("zero", "no starter scored 0 in alex's weeks");
    await toWeek();
    if (await pane().locator("[data-bench]").count()) {
      await pane().locator("[data-bench]").first().click();
      await castSheet(p);
      await wait(p, 900);
      await shoot(p, "bench");
    } else skip("bench", "nobody on alex's bench that week");
    // The season table's number (under the week), for alex.
    await yourSheet();
    const cell = top(p).locator("[data-season-cell]").last();
    if (await cell.count()) {
      await cell.scrollIntoViewIfNeeded();
      await cell.click();
      await castSheet(p);
      await wait(p, 900);
      await shoot(p, "season-cell");
    } else skip("season-cell", "no numbers in alex's season");
    // Everyone in this game: a number, no holder.
    await gamePage();
    const everyone = p.locator('[data-game-page] button:has-text("Everyone in this game")').first();
    if (await everyone.count()) {
      await everyone.click();
      await p.locator("[data-game-table]").last().waitFor({ timeout: 15000 });
      await wait(p, 900);
      // A number that isn't 0 (a week with moments to add up), else the first.
      const cells = p.locator("[data-game-table] [data-table-cell]");
      const scored = cells.filter({ hasNotText: /^0$/ });
      await ((await scored.count()) ? scored.first() : cells.first()).click();
      await castSheet(p);
      await wait(p, 900);
      await shoot(p, "table-cell");
    } else skip("table-cell", "no Everyone in this game on the page");
    // Survival Pool: a pick (no game arithmetic): lands on the story at that episode.
    if (poolLeague) {
      await yourSheet(poolLeague);
      const pick = top(p).locator("[data-episode-block] [data-door-cast]").first();
      if (await pick.count()) {
        await pick.click();
        await castSheet(p);
        await wait(p, 1600);
        await shoot(p, "pool-pick");
      } else skip("pool-pick", "no pick in alex's latest pool night");
    }
    // The Cast tab's wall: no week handed.
    await p.goto(`${BASE}/show/${season}/cast`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-door-cast], [data-face-wall] button").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
    await p.locator("[data-face-wall] button, [data-cast-wall] button").first().click().catch(async () => p.locator("[data-door-cast]").first().click());
    await castSheet(p);
    await wait(p, 900);
    await shoot(p, "cast-wall");
  } finally {
    await b.close();
  }
}

async function captain() {
  const file = path.resolve(".ui-atlas/play-pieces.json");
  if (!fs.existsSync(file)) return skip("captain", "play-pieces-fixture.js isn't up (--up)");
  // { captain: { seasonId, user (the viewer, Ann), pages: { captain: "/show/<season>/game/<id>" } } } (play-pieces-fixture.js).
  const c = JSON.parse(fs.readFileSync(file, "utf8")).captain;
  if (!c?.pages?.captain) return skip("captain", "no captain case in .ui-atlas/play-pieces.json");
  const b = await browser(c.user, "zt-pass-12345");
  const p = b.page;
  try {
    await p.goto(`${BASE}${c.pages.captain}`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
    await p.locator("[data-door-you]").first().click();
    await p.locator("[data-sheet-player]").last().waitFor({ timeout: 15000 });
    await wait(p, 900);
    const capCard = top(p).locator("[data-week-captain]");
    for (let i = 0; i < 6 && !(await capCard.first().isVisible().catch(() => false)); i++) {
      const bars = top(p).locator("[data-week-bar]");
      await bars.nth(i).click().catch(() => {});
      await wait(p, 600);
    }
    if (!(await capCard.count())) return skip("captain", "no captain in Ann's weeks");
    await capCard.first().click();
    await castSheet(p);
    await wait(p, 900);
    await shoot(p, "captain");
  } finally {
    await b.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (has("up")) {
    if (SETS.includes("couch")) node("new-fixture.js", "up", "--art");
    if (SETS.includes("captain")) node("play-pieces-fixture.js", "up", "--only=captain");
  }
  try {
    if (SETS.includes("couch")) await couch();
    if (SETS.includes("captain")) await captain();
  } finally {
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
    if (has("down")) {
      if (SETS.includes("captain")) node("play-pieces-fixture.js", "down");
      if (SETS.includes("couch")) node("new-fixture.js", "down");
    }
  }
  console.log(`Frames: ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
