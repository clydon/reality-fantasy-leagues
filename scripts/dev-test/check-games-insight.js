// Dev-only check for what everyone's doing on the Games tab (the 2026-10-30 mock), in a real browser against the dev server, as
// new-fixture.js's alex (results through Episode 5, Episode 6 being set) and sam (behind, through 3):
//   - /games: every Weekly Lineup row carries its weeks (one per episode with results, adding up to the season); sam's stop at 3;
//   - the tables name their columns (Started Ep 5 · Season, Last picks · Streak, Team · Points); Weekly Lineup's rows show who
//     each player started last episode and that week's points;
//   - the chips: Season, Ep 6 · N/4 set, Ep 5 … Ep 1; an episode ranks the couch by that week with starters' points and the bench;
//     the one being set says Set / Not set yet as /games's progress does;
//   - a row opens that player's sheet on the same week: the bars (one per episode and the one being set), the week's starters and
//     bench as /games has them, a real touch swipe to the week before and back, a short drag springs back, a bar jumps, the arrow
//     keys step, the sheet never closes or moves down while swiping sideways, ‹ › step through the table on the same week, the
//     team's points add up to the season, and the once-a-device peek is remembered;
//   - reduced motion: the arrow keys still change the week;
//   - Tonight's "Your night" and an episode page's game lines open the Games tab at that game, on that episode;
//   - nothing wider than the screen, no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-games-insight.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. It shares
// the zt_nd_ fixture with the other check-new-* checks, so never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-games-insight runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-games-insight.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const round = (n) => Math.round(n * 10) / 10;
const signed = (n) => (n > 0 ? `+${round(n)}` : n < 0 ? `−${round(-n)}` : "0");

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new'), ($2, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex, fx.users.sam]);

    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() => {
      // Next's dev badge sits over the first tab.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    const dialog = () => page.getByRole("dialog");

    // ---- what the server sends ----
    const home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const couch = home.couches.filter((c) => c.games.some((g) => g.seasonId === sid)).sort((x, y) => y.games.length - x.games.length)[0];
    const games = async (p) => (await (await p.request.get(`${BASE}/api/seasons/${sid}/games?couch=${couch.id}`)).json()).games;
    const play = await games(page);
    const g = play.find((x) => x.gameType === "active-roster");
    check(!!g, "/games: alex's Weekly Lineup");
    check(
      g.table.every((r) => r.weeks.map((w) => w.episode).join() === "1,2,3,4,5" && round(r.weeks.reduce((t, w) => t + w.total, 0)) === r.total),
      "/games: every row's weeks, one per episode with results, add up to its season"
    );
    check(play.filter((x) => x.gameType !== "active-roster").every((x) => x.table.every((r) => r.weeks.length === 0)), "/games: other games carry no weeks");
    const next = g.progress;
    check(next?.label === "lineups set" && next.episode === 6, "/games: Episode 6 is being set", JSON.stringify(next && { label: next.label, episode: next.episode }));
    const sam = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(sam.close);
    const samG = (await games(sam.page)).find((x) => x.gameType === "active-roster");
    check(!!samG && samG.table.every((r) => r.weeks.length === 3 && r.weeks.at(-1).episode === 3), "sam (through 3): nobody's weeks past Episode 3");

    // ---- the Games tab ----
    await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "networkidle" });
    await page.locator(`[data-table="${g.leagueId}"] [data-week-chips]`).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const table = page.locator(`[data-table="${g.leagueId}"]`);
    const tableText = (await table.innerText()).toLowerCase();
    check(tableText.includes("started ep 5") && tableText.includes("season"), "Weekly Lineup names its columns: Started Ep 5 · Season");
    const pool_ = page.locator(`[data-table="${play.find((x) => x.gameType === "pickem").leagueId}"]`);
    check((await pool_.innerText()).toLowerCase().includes("streak"), "Survival Pool's number says it's a streak");
    const outlast = page.locator(`[data-table="${play.find((x) => x.gameType === "classic-draft").leagueId}"]`);
    check((await outlast.innerText()).toLowerCase().includes("team"), "Outlast names its columns");
    const rows = table.locator("[data-player]");
    check((await rows.count()) === g.table.length, "a row per player");
    let facesOk = true;
    for (const r of g.table) {
      const row = table.locator(`[data-player="${r.name}"]`);
      const imgs = await row.locator("img").count();
      const text = await row.innerText();
      if (imgs < r.weeks.at(-1).started.length || !text.includes(signed(r.weeks.at(-1).total))) facesOk = false;
    }
    check(facesOk, "each row shows who they started in Episode 5 and that week's points");
    const chips = await table.locator("[data-week-chip]").allInnerTexts();
    check(chips.join("|") === `Season|Ep 6 · ${next.done}/${next.of} set|Ep 5|Ep 4|Ep 3|Ep 2|Ep 1`, "chips: Season, the episode being set, then each episode newest first", chips.join("|"));
    await fits("Games · Season");
    await table.scrollIntoViewIfNeeded();
    await shot("games-season");

    // An episode: ranked by the week, starters' points, the bench.
    await table.locator('[data-week-chip="4"]').click();
    await page.waitForTimeout(400);
    const byWeek = [...g.table].sort((a, b) => b.weeks[3].total - a.weeks[3].total).map((r) => r.name);
    const shown = await table.locator("[data-player]").evaluateAll((els) => els.map((e) => e.dataset.player));
    check(shown.join() === byWeek.join(), "Ep 4: the couch ranked by that week", `${shown} vs ${byWeek}`);
    const riley = g.table.find((r) => r.name.endsWith("riley") || r.name === "riley") ?? g.table.find((r) => !r.you);
    const rileyRow = table.locator(`[data-player="${riley.name}"]`);
    const w4 = riley.weeks[3];
    const rowText = await rileyRow.innerText();
    check(
      w4.started.every((s) => rowText.includes(signed(s.points))) && (await rileyRow.locator("img").count()) === w4.started.length + w4.bench.length,
      `Ep 4: ${riley.name}'s starters with their points, and the bench`
    );
    await fits("Games · Ep 4");
    await shot("games-ep4");

    // The episode being set: who's set.
    await table.locator('[data-week-chip="next"]').click();
    await page.waitForTimeout(400);
    let setOk = true;
    for (const p of next.people) {
      const r = g.table.find((x) => x.playerId === p.playerId);
      if (!r || r.you) continue;
      const t = await table.locator(`[data-player="${r.name}"]`).innerText();
      if (p.done ? !/Set/.test(t) || /Not set/.test(t) : !/Not set yet/.test(t)) setOk = false;
    }
    check(setOk, "Ep 6: Set / Not set yet for each player, as /games's progress says");
    check(/private until/i.test(await table.innerText()), "Ep 6: says lineups stay private until it airs");
    await shot("games-ep6-next");

    // ---- a player's sheet ----
    await table.locator('[data-week-chip="5"]').click();
    await page.waitForTimeout(300);
    await rileyRow.click();
    await dialog().locator("[data-lineup-sheet]").waitFor();
    await page.waitForTimeout(500);
    const middle = () => page.locator('[data-pane="1"] [data-week-pane]').getAttribute("data-week-pane");
    const pressed = () => page.locator("[data-week-bar][aria-pressed=true]").getAttribute("data-week-bar");
    check((await middle()) === "5" && (await pressed()) === "4", "opened from Ep 5: the sheet is on Episode 5, its bar picked");
    check((await page.locator("[data-week-bar]").count()) === 6, "a bar per episode with results, and the one being set");
    const w5 = riley.weeks[4];
    const pane = page.locator('[data-pane="1"]');
    const starters = await pane.locator("[data-starter]").evaluateAll((els) => els.map((e) => e.dataset.starter));
    const bench = await pane.locator("[data-bench]").evaluateAll((els) => els.map((e) => e.dataset.bench));
    check(starters.join() === w5.started.map((s) => s.id).join() && bench.join() === w5.bench.map((s) => s.id).join(), "the week's starters and bench, as /games has them");
    check((await pane.innerText()).includes(signed(w5.total)), "the week's points");
    // Points for riley: the team's add up to the season.
    const earned = await dialog().locator("[data-team-row] b.type-num").allInnerTexts();
    check(round(earned.reduce((t, s) => t + Number(s.replace("−", "-")), 0)) === riley.total, "the team's points for them add up to the season", earned.join(","));
    await page.waitForTimeout(1500);
    check((await page.evaluate(() => localStorage.getItem("gys.lineup-weeks.peeked"))) === "1", "the next week peeked in once, and that's remembered");
    await shot("sheet-ep5");
    await dialog().locator("[data-team-row]").last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot("sheet-team");
    await dialog().locator("[data-weeks]").scrollIntoViewIfNeeded();

    // A real touch swipe: the week before, then back.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const box = await page.locator("[data-weeks]").boundingBox();
    const sheetTop = async () => (await dialog().boundingBox()).y;
    const swipe = async (from, to, steps = 12, midShot = null) => {
      const y = box.y + Math.min(120, box.height / 2);
      await touch("touchStart", from, y);
      for (let i = 1; i <= steps; i++) {
        await touch("touchMove", from + ((to - from) * i) / steps, y + i * 0.6);
        await page.waitForTimeout(16);
        if (midShot && i === Math.round(steps * 0.6)) await shot(midShot);
      }
      await touch("touchEnd");
      await page.waitForTimeout(700);
    };
    const top0 = await sheetTop();
    await swipe(80, 330, 12, "sheet-mid-swipe");
    check((await middle()) === "4" && (await pressed()) === "3", "a swipe right goes to the week before (Episode 4)", `${await middle()} / ${await pressed()}`);
    check(await dialog().isVisible(), "the sheet stays open through a sideways swipe (drifting down a little)");
    check(Math.abs((await sheetTop()) - top0) < 2, "and doesn't move down");
    await swipe(330, 80);
    check((await middle()) === "5", "a swipe left comes back to Episode 5");
    await swipe(200, 240, 4);
    check((await middle()) === "5", "a short drag springs back");
    await swipe(330, 80);
    check((await middle()) === "6" && /set/i.test((await pane.innerText()) || ""), "a swipe on to Episode 6: who's set, nothing else", await middle());
    await shot("sheet-ep6-next");
    await swipe(330, 80);
    check((await middle()) === "6", "past the last week it stretches and springs back");
    await page.locator('[data-week-bar="0"]').click();
    await page.waitForTimeout(800);
    check((await middle()) === "1" && (await pressed()) === "0", "a bar jumps to its week (Episode 1)");
    await page.locator("[data-weeks]").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    check((await middle()) === "2", "the arrow keys step through the weeks");

    // ‹ ›: the next player in the table, on the same week.
    const order = g.table.map((r) => r.name);
    const at = order.indexOf(riley.name);
    const title = async () => (await dialog().locator("h2").first().innerText()).toLowerCase();
    if (at < order.length - 1) {
      await dialog().locator("[data-sheet-next]").click();
      await page.waitForTimeout(600);
      check((await title()) === order[at + 1].toLowerCase() && (await middle()) === "2", `› steps to ${order[at + 1]}, still on Episode 2`, `${await title()} / ${await middle()}`);
      await shot("sheet-next-player");
      await dialog().locator("[data-sheet-prev]").click();
      await page.waitForTimeout(600);
      check((await title()) === riley.name.toLowerCase(), "‹ steps back");
    }
    for (let i = 0; i < order.length; i++) {
      if (await dialog().locator("[data-sheet-prev]").isDisabled()) break;
      await dialog().locator("[data-sheet-prev]").click();
      await page.waitForTimeout(400);
    }
    check((await title()) === order[0].toLowerCase() && (await dialog().locator("[data-sheet-prev]").isDisabled()), "the first on the table has nothing before it");
    await fits("the sheet");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ---- Tonight's Your night, and an episode page: a game's line opens its table, on that episode ----
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    const line = page.locator(`[data-night-line="${g.leagueId}"]`);
    await line.waitFor({ timeout: 30_000 });
    await line.scrollIntoViewIfNeeded();
    await shot("tonight-your-night");
    await line.click();
    await page.waitForURL(`**/show/${sid}/games?game=${g.leagueId}&ep=5`);
    await page.locator('[data-week-chip="5"][aria-pressed=true]').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1200);
    const landed = await page.locator(`[data-table="${g.leagueId}"]`).evaluate((el) => el.getBoundingClientRect().top);
    check(landed >= 0 && landed < 260, "Tonight's Weekly Lineup line lands on its table, on Episode 5", `top ${Math.round(landed)}`);
    await shot("games-from-tonight");
    await page.goto(`${BASE}/show/${sid}/episodes?page=ep4`, { waitUntil: "networkidle" });
    const gl = page.locator(`[data-game-line="${g.leagueId}"]`);
    await gl.waitFor({ timeout: 30_000 });
    await gl.click();
    await page.waitForURL(`**/show/${sid}/games?game=${g.leagueId}&ep=4`);
    await page.locator('[data-week-chip="4"][aria-pressed=true]').waitFor({ timeout: 15_000 });
    check(true, "an episode page's game line opens its table on that episode (Ep 4)");

    // ---- reduced motion: the weeks still change (a fade) ----
    const still = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, motion: "reduce" });
    closers.push(still.close);
    await still.page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "networkidle" });
    await still.page.locator(`[data-table="${g.leagueId}"] [data-player="${riley.name}"]`).click();
    await still.page.getByRole("dialog").locator("[data-weeks]").waitFor();
    await still.page.locator("[data-weeks]").focus();
    await still.page.keyboard.press("ArrowLeft");
    await still.page.waitForTimeout(500);
    check((await still.page.locator('[data-pane="1"] [data-week-pane]').getAttribute("data-week-pane")) === "4", "reduced motion: the arrow keys still change the week");

    check(errors.length === 0 && still.errors.length === 0, "no page errors", [...errors, ...still.errors].join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
