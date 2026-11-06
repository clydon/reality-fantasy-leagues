// Dev-only check for what everyone's doing on the Games tab (the 2026-10-30 mock), in a real browser against the dev server, as
// new-fixture.js's alex (results through Episode 5, Episode 6 being set) and sam (behind, through 3):
//   - /games: every Weekly Lineup row carries its weeks (one per episode with results, adding up to the season); sam's stop at 3;
//   - the tables name their columns (Started Ep 5 · Season, Last picks · Streak, Team · Points); Weekly Lineup's rows show who
//     each player started last episode and that week's points; no episode chips (the user dropped them 2026-10-31);
//   - a row opens that player's sheet on the latest week: the bars (one per episode and the one being set), the week's starters and
//     bench as /games has them, a real touch swipe to the week before and back, a short drag springs back, a bar jumps, the arrow
//     keys step, the sheet never closes or moves down while swiping sideways, ‹ › step through the table on the same week, a swipe
//     on the sheet's header does too (the next one's name coming in at the edge; nobody before the first), the team's points add
//     up to the season, and the once-a-device peek is remembered;
//   - Your moves: the games swipe by (a real touch swipe, the tabs' highlight following the finger and landing under the tab), a
//     tab further off slides there, a short drag springs back and picks nothing, the ends stretch, the peek is remembered;
//   - reduced motion: the arrow keys still change the week; Your moves' tabs still change the game;
//   - Tonight's "Your night" and an episode page's game lines open the Games tab at that game;
//   - each game's card under its name (your-move.ts) says your move as /games and /waivers have it (a lineup set or due, a pick, a
//     mid-season draft due), a dot on the pill of each game whose card is due, no dock on Games; a card opens Your moves on its
//     game, or its game's page (Waivers, the draft room); the dock still sits over Episodes while a move's due;
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
    await page.locator(`[data-table="${g.leagueId}"] [data-player]`).first().waitFor({ timeout: 30_000 });
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
    check((await table.locator("[data-week-chip]").count()) === 0, "no episode chips: a player's sheet has the weeks");
    await fits("Games · Season");
    await table.scrollIntoViewIfNeeded();
    await shot("games-season");
    const riley = g.table.find((r) => r.name.endsWith("riley") || r.name === "riley") ?? g.table.find((r) => !r.you);
    const rileyRow = table.locator(`[data-player="${riley.name}"]`);

    // ---- a player's sheet ----
    await rileyRow.click();
    await dialog().locator("[data-lineup-sheet]").waitFor();
    await page.waitForTimeout(500);
    const middle = () => page.locator('[data-pane="1"] [data-week-pane]').getAttribute("data-week-pane");
    const pressed = () => page.locator("[data-week-bar][aria-pressed=true]").getAttribute("data-week-bar");
    check((await middle()) === "5" && (await pressed()) === "4", "it opens on the latest week, Episode 5, its bar picked");
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

    // A swipe on the sheet's header: the next player, still on the same week; nobody before the first.
    const weekNow = await middle();
    const head = await dialog().locator("h2").first().boundingBox();
    const swipeHead = async (from, to, midShot = null) => {
      const y = head.y + head.height / 2;
      await touch("touchStart", from, y);
      for (let i = 1; i <= 12; i++) {
        await touch("touchMove", from + ((to - from) * i) / 12, y + i * 0.4);
        await page.waitForTimeout(16);
        if (midShot && i === 8) await shot(midShot);
      }
      await touch("touchEnd");
      await page.waitForTimeout(800);
    };
    // Who's next, as the sheet has it (a tie can order the table differently from the read at the start).
    const nextName = ((await dialog().locator("[data-sheet-next]").getAttribute("aria-label")) || "").replace(/^Next: /, "");
    await swipeHead(320, 70, "sheet-header-swipe");
    check((await title()) === nextName.toLowerCase() && (await middle()) === weekNow, `a swipe left on the header: ${nextName}, on the same week`, `${await title()} / ${await middle()}`);
    check(await dialog().isVisible(), "and the sheet stays open");
    await swipeHead(70, 320);
    check((await title()) === order[0].toLowerCase(), "a swipe right comes back", await title());
    await swipeHead(70, 320);
    check((await title()) === order[0].toLowerCase(), "nobody before the first: it stretches and springs back", await title());
    const ghostOff = await dialog().locator("[data-sheet-player]").evaluate((el) => getComputedStyle(el).transform);
    check(ghostOff === "none" || ghostOff === "matrix(1, 0, 0, 1, 0, 0)", "and settles where it was", ghostOff);
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
    await page.locator(`[data-table="${g.leagueId}"] [data-player]`).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1800);
    const landed = await page.locator(`[data-table="${g.leagueId}"]`).evaluate((el) => el.getBoundingClientRect().top);
    check(landed >= 0 && landed < 260, "Tonight's Weekly Lineup line lands on its table", `top ${Math.round(landed)}`);
    await shot("games-from-tonight");
    await page.goto(`${BASE}/show/${sid}/episodes?page=ep4`, { waitUntil: "networkidle" });
    const gl = page.locator(`[data-game-line="${g.leagueId}"]`);
    await gl.waitFor({ timeout: 30_000 });
    await gl.click();
    await page.waitForURL(`**/show/${sid}/games?game=${g.leagueId}&ep=4`);
    await page.locator(`[data-table="${g.leagueId}"] [data-player]`).first().waitFor({ timeout: 15_000 });
    check(true, "an episode page's game line opens the Games tab at its table");

    // ---- Your moves: the games swipe by ----
    // From a move of alex's on Tonight (which game it opens on depends on what's due), then from the first game.
    const openMovesSheet = async (p) => {
      await p.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
      await p.locator("[data-move] button").first().click();
      await p.getByRole("dialog").getByText("Your moves").waitFor();
      // Past the once-a-device peek.
      await p.waitForTimeout(1800);
    };
    await openMovesSheet(page);
    const tabNames = (await dialog().getByRole("tab").allTextContents()).map((t) => t.trim());
    const selected = async () => (await dialog().locator('[role="tab"][aria-selected="true"]').innerText()).trim();
    const tabAt = (i) => dialog().getByRole("tab").nth(i);
    /** How far the tabs' highlight is from sitting exactly under tab i (0: under it). */
    const litOff = async (i) => {
      const lit = await dialog().locator("[data-tabs-lit]").boundingBox();
      const t = await tabAt(i).boundingBox();
      return Math.round(Math.abs(lit.x - t.x) + Math.abs(lit.width - t.width));
    };
    check(tabNames.length >= 3, "Your moves: a tab per game, at least three here", tabNames.join("|"));
    check(tabNames.includes(await selected()) && (await litOff(tabNames.indexOf(await selected()))) <= 2, "it opens with the highlight under its game", await selected());
    await tabAt(0).click();
    await page.waitForTimeout(900);
    check((await selected()) === tabNames[0] && (await litOff(0)) <= 2, `a tab slides to its game (${tabNames[0]}), the highlight with it`, await selected());
    const gamesBox = await dialog().locator("[data-moves-games]").boundingBox();
    const swipeGames = async (from, to, steps = 12, mid = null) => {
      const y = gamesBox.y + Math.min(160, gamesBox.height / 2);
      await touch("touchStart", from, y);
      let midAt = null;
      for (let i = 1; i <= steps; i++) {
        await touch("touchMove", from + ((to - from) * i) / steps, y + i * 0.5);
        await page.waitForTimeout(16);
        if (mid && i === Math.round(steps * 0.6)) {
          midAt = (await dialog().locator("[data-tabs-lit]").boundingBox()).x;
          await shot(mid);
        }
      }
      await touch("touchEnd");
      await page.waitForTimeout(800);
      return midAt;
    };
    const x0 = (await tabAt(0).boundingBox()).x;
    const x1 = (await tabAt(1).boundingBox()).x;
    const midX = await swipeGames(330, 60, 12, "moves-mid-swipe");
    check(midX > x0 + 4 && midX < x1 - 4, "mid-swipe the highlight is on its way between the two tabs", `${Math.round(x0)} < ${Math.round(midX)} < ${Math.round(x1)}`);
    check((await selected()) === tabNames[1] && (await litOff(1)) <= 2, `a swipe left: ${tabNames[1]}, the highlight landed under it`, await selected());
    const pressedNow = () => dialog().locator('[data-moves-games] [data-pane="1"] [aria-pressed="true"]').count();
    const pressedBefore = await pressedNow();
    // Slow and short: neither far enough nor fast enough to count (a fast one is a flick, which does).
    await swipeGames(200, 230, 6);
    check((await selected()) === tabNames[1] && (await pressedNow()) === pressedBefore, "a short drag over the game springs back and picks nothing");
    const last = tabNames.length - 1;
    await tabAt(last).click();
    await page.waitForTimeout(900);
    check((await selected()) === tabNames[last] && (await litOff(last)) <= 2, `a tab further along slides straight there (${tabNames[last]})`, await selected());
    await swipeGames(330, 60);
    check((await selected()) === tabNames[last], "past the last game it stretches and springs back", await selected());
    await swipeGames(60, 330);
    check((await selected()) === tabNames[last - 1], "a swipe right: the game before", await selected());
    check((await page.evaluate(() => localStorage.getItem("gys.moves-games.peeked"))) === "1", "the peek is remembered");
    await fits("Your moves");
    await shot("moves-swiped");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ---- each game's card: your move under its name (your-move.ts); no dock on Games, the dock on Episodes while one's due ----
    await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "networkidle" });
    await page.locator("[data-your-move]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const cardIn = (leagueId) => page.locator(`[data-table="${leagueId}"] [data-your-move]`);
    const kindOf = async (leagueId) => ((await cardIn(leagueId).count()) ? await cardIn(leagueId).getAttribute("data-your-move") : null);
    const dueOf = async (leagueId) => (await cardIn(leagueId).getAttribute("data-due")) === "true";
    check((await page.locator(".nd-dock").count()) === 0, "no dock on Games: each game's card says your move");
    const wlGame = play.find((x) => x.gameType === "active-roster");
    const poolGame = play.find((x) => x.gameType === "pickem");
    const outlastGame = play.find((x) => x.gameType === "classic-draft");
    const wvGames = (await (await page.request.get(`${BASE}/api/seasons/${sid}/waivers?couch=${couch.id}`)).json()).games ?? [];
    const claimDue = (leagueId) => {
      const w = wvGames.find((x) => x.leagueId === leagueId);
      return !!w && !w.revealFirst && w.stage === "open" && w.replace.length > 0 && !w.nobodyFree && !w.replace.every((id) => w.spots.find((sp) => sp.dropId === id)?.addIds.length);
    };
    if (wlGame.lineup && !claimDue(wlGame.leagueId)) {
      check((await kindOf(wlGame.leagueId)) === "lineup" && (await dueOf(wlGame.leagueId)) === !wlGame.lineup.set, `Weekly Lineup's card: your lineup, ${wlGame.lineup.set ? "set (Edit)" : "due (Set)"}`, await cardIn(wlGame.leagueId).innerText());
    }
    if (poolGame?.pick?.open && !claimDue(poolGame.leagueId)) {
      check((await kindOf(poolGame.leagueId)) === "pick" && (await dueOf(poolGame.leagueId)) === !poolGame.pick.pick, `Survival Pool's card: your pick, ${poolGame.pick.pick ? "made" : "due"}`, await cardIn(poolGame.leagueId).innerText());
    }
    if (outlastGame && claimDue(outlastGame.leagueId)) {
      check((await kindOf(outlastGame.leagueId)) === "waivers" && (await dueOf(outlastGame.leagueId)) && /^Replace /.test(await cardIn(outlastGame.leagueId).innerText()), "Outlast's card: someone of yours to replace, due (the mid-season draft)", await cardIn(outlastGame.leagueId).innerText());
    }
    const dueCards = await page.locator('[data-your-move][data-due="true"]').count();
    check((await page.locator("[data-pill-due]").count()) === dueCards, "a dot on the pill of each game whose card is due", `${await page.locator("[data-pill-due]").count()} dots, ${dueCards} due`);
    await shot("games-your-move-cards");
    await fits("Games with the cards");
    // A card opens Your moves on its game, or its game's page.
    const opensSheetOn = async (leagueId, tabName) => {
      await cardIn(leagueId).click();
      await dialog().getByText("Your moves").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(500);
      const on = (await dialog().locator('[role="tab"][aria-selected="true"]').innerText().catch(() => "")).trim();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      return on === tabName;
    };
    if ((await kindOf(wlGame.leagueId)) === "lineup") check(await opensSheetOn(wlGame.leagueId, "Weekly Lineup"), "Weekly Lineup's card opens Your moves on Weekly Lineup");
    if (poolGame && (await kindOf(poolGame.leagueId)) === "pick") check(await opensSheetOn(poolGame.leagueId, "Survival Pool"), "Survival Pool's card opens Your moves on Survival Pool");
    const paged = page.locator('[data-your-move="waivers"], [data-your-move="draft"], [data-your-move="swaps"]').first();
    if (await paged.count()) {
      const leagueId = await paged.evaluate((el) => el.closest("[data-table]").dataset.table);
      await paged.click();
      await page.waitForURL((u) => /\/(waivers|draft|blind)$/.test(u.pathname), { timeout: 15_000 }).catch(() => {});
      check(page.url().includes(`game=${leagueId}`), "a draft or mid-season draft card opens its game's own page", page.url());
      await page.goBack();
      await page.locator("[data-your-move]").first().waitFor({ timeout: 15_000 });
    }
    const dueNow = (await (await page.request.get(`${BASE}/api/me/home`)).json()).moves.filter((m) => play.some((x) => x.leagueId === m.leagueId)).length;
    await page.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check((await page.locator(".nd-dock").count()) === (dueNow ? 1 : 0), dueNow ? "the dock still sits over Episodes while a move's due" : "all set: no dock over Episodes", `${dueNow} due`);

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
    await still.page.keyboard.press("Escape");
    await openMovesSheet(still.page);
    const stillTabs = still.page.getByRole("dialog").getByRole("tab");
    const other = (await stillTabs.nth(0).getAttribute("aria-selected")) === "true" ? 1 : 0;
    await stillTabs.nth(other).click();
    await still.page.waitForTimeout(500);
    check((await stillTabs.nth(other).getAttribute("aria-selected")) === "true", "reduced motion: Your moves' tabs still change the game");

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
