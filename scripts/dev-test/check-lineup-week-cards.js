// Dev-only check: a lineup game's week, its Started cards in line (src/new/show/lineup-sheet.tsx WeekPane). Each starter is a face
// card (face, name and points, then what scored, 0 to 2 lines); the cards in one row must share one top edge whatever each says
// under its name. The user, 2026-11-22: a starter who scored 0 (no line under him) sat lower than the two beside him, because a
// card is a button stretched to the row's height and a browser centres a button's content. Any two starters whose lines differ
// in height (one line against two) were pushed apart the same way.
//
// Opens a lineup game's page as one of its seats, then the person sheet (Week by week), and steps through every person (the
// sheet's ‹ ›) and every played week (the bars). For each week in view it measures each row of cards: the faces' top edges must
// be within 1px. A line per person and week (PASS, FAIL with the spread, or SKIP when nobody started), a frame of each FAIL and
// of the first week whose lines were uneven, and a summary that says whether any week had uneven lines at all (with none, a pass
// proves nothing, and it says so).
//
// Needs the dev server (npm run dev; BASE= for another) and a lineup game: new-fixture.js's Lineup League by default
// (node scripts/dev-test/new-fixture.js up; down afterwards). Reads only. Refuses a non-local database.
//
//   node scripts/dev-test/check-lineup-week-cards.js [--user=zt_nd_alex] [--league=zt-nd-lineup] [--width=390 --height=844]
//                                                    [--out=.ui-atlas/stories/lineup-week-cards] [--label=after]
// Frames: <out>/<label>/<person>-ep<n>.jpg; summary: <out>/<label>/report.json. Exit 1 on any FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const USER = opt("user", "zt_nd_alex");
const PASS = opt("pass", "zt-pass-12345");
const LEAGUE = opt("league", "zt-nd-lineup");
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/lineup-week-cards"), opt("label", "run"));
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-lineup-week-cards runs against a local database only");

const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  // A league's season: its settings name the show by slug and the season by number.
  const row = (
    await pool.query(
      `SELECT l.id, ss.id AS season_id FROM leagues l
         JOIN shows sh ON sh.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = sh.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE l.slug = $1 OR l.id::text = $1`,
      [LEAGUE]
    )
  ).rows[0];
  await pool.end();
  if (!row) throw new Error(`no league ${LEAGUE} (new-fixture.js up?)`);

  const b = await open({ user: USER, pass: PASS, width: W, height: H, motion: "reduce" });
  const p = b.page;
  p.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.split("\n")[0]}`));
  // The dev server's badge sits over a sheet's foot in the frames; zt_ usernames read without the prefix (as check-drill-doors.js).
  await p.addInitScript(() => {
    const hide = () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }));
    if (document.head) hide();
    else document.addEventListener("DOMContentLoaded", hide);
  });
  await p.route("**/api/**", async (route) => {
    const res = await route.fetch().catch(() => null);
    if (!res) return route.abort();
    if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
    return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_[a-z]+_([a-z]+)"/g, '"$1"') });
  });

  const results = [];
  let framedUneven = false;
  try {
    await p.goto(`${BASE}/show/${row.season_id}/game/${row.id}`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
    await wait(p, 1200);
    await p.locator("[data-door-you]").first().click();
    await p.locator("[data-sheet-player]").last().waitFor({ timeout: 15000 });
    await wait(p, 900);
    const sheet = () => p.locator('[role="dialog"]').last();
    // From the first person on the table.
    for (let i = 0; i < 20 && (await sheet().locator("[data-sheet-prev]:not(:disabled)").count()); i++) {
      await sheet().locator("[data-sheet-prev]").click();
      await wait(p, 700);
    }
    for (let person = 0; person < 20; person++) {
      const who = (await sheet().locator("[data-sheet-player]").getAttribute("data-sheet-player")) ?? `person${person}`;
      const name = ((await sheet().locator("h2").first().textContent().catch(() => null)) || who).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const bars = sheet().locator("[data-week-bar]");
      const n = await bars.count();
      for (let i = 0; i < n; i++) {
        await bars.nth(i).click();
        await wait(p, 650);
        // The pager keeps every week's pane side by side: the one in view.
        const m = await p.evaluate((width) => {
          const panes = [...document.querySelectorAll('[role="dialog"] [data-week-pane]')];
          const pane = panes.reverse().find((x) => {
            const r = x.getBoundingClientRect();
            return r.left >= -1 && r.left < width - 1 && r.width > 0;
          });
          if (!pane) return null;
          const cards = [...pane.querySelectorAll("[data-starter]")];
          const rows = new Map();
          for (const c of cards) {
            const top = Math.round(c.getBoundingClientRect().top);
            const face = c.firstElementChild?.getBoundingClientRect().top ?? top;
            const line = c.querySelector("small")?.getBoundingClientRect().height ?? 0;
            const key = [...rows.keys()].find((k) => Math.abs(k - top) <= 2) ?? top;
            rows.set(key, [...(rows.get(key) ?? []), { face, line: Math.round(line) }]);
          }
          const spreads = [...rows.values()].map((r) => Math.max(...r.map((x) => x.face)) - Math.min(...r.map((x) => x.face)));
          const uneven = [...rows.values()].some((r) => new Set(r.map((x) => x.line)).size > 1);
          return { episode: pane.getAttribute("data-week-pane"), starters: cards.length, spread: Math.max(0, ...spreads), uneven };
        }, W);
        if (!m) continue;
        const id = `${name} ep${m.episode}`;
        if (!m.starters) {
          results.push({ id, verdict: "SKIP", why: "nobody started (or the week to come)" });
          console.log(`SKIP ${id}: nobody started (or the week to come)`);
          continue;
        }
        const ok = m.spread <= 1;
        results.push({ id, verdict: ok ? "PASS" : "FAIL", spread: Math.round(m.spread * 10) / 10, uneven: m.uneven });
        console.log(`${ok ? "PASS" : "FAIL"} ${id}: faces ${ok ? "in line" : `${Math.round(m.spread * 10) / 10}px apart`}${m.uneven ? " (lines under the names differ)" : ""}`);
        if (!ok || (m.uneven && !framedUneven)) {
          if (m.uneven) framedUneven = true;
          await sheet().locator(`[data-week-pane="${m.episode}"] [data-starter]`).first().scrollIntoViewIfNeeded().catch(() => {});
          await wait(p, 300);
          await p.screenshot({ path: path.join(OUT, `${name}-ep${m.episode}.jpg`), type: "jpeg", quality: 86 });
        }
      }
      if (!(await sheet().locator("[data-sheet-next]:not(:disabled)").count())) break;
      await sheet().locator("[data-sheet-next]").click();
      await wait(p, 800);
    }
  } finally {
    await b.close();
  }
  const fails = results.filter((r) => r.verdict === "FAIL").length;
  const exercised = results.some((r) => r.uneven);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ league: LEAGUE, user: USER, width: W, results, fails, exercised }, null, 2));
  console.log(`\n${results.filter((r) => r.verdict === "PASS").length} pass, ${fails} fail, ${results.filter((r) => r.verdict === "SKIP").length} skip`);
  if (!exercised) console.log("No week had starters whose lines under the name differ: this run can't show the misalignment either way.");
  console.log(`Frames and report: ${OUT}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
