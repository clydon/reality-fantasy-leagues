// Dev-only browser check of Round 3's Games tab, archive, Tonight and Again (docs/PLAN-start-a-game-redo.md, B3; the design:
// docs/design-round/round3-short-games-spec.md), on short-games-fixture.js's busy season at a phone's width:
//   alex (caught up, Episode 20 next): the Games tab opens on Episode 20's three night rows (who's in, Answer), the season's games as
//     step 6's rows, Episode 19's results and the door; no finished game's row; the archive (record, kinds, an episode a section, the
//     next page by its button); a result row opens the finished game's page (read by itself: the running read doesn't carry it);
//     Tonight holds a mini per season game and the night's games as two compact parts; nothing wider than the screen.
//   sam (two behind): Episodes 18 and 19 folded to a line each, nothing past his mark (his results and his archive start at 17).
//   --no-next run (the next episode with no games yet): Again on the tab's results (one button a kind) and on the newest game's page.
//
//   node scripts/lane.js dev   (or npm run dev; BASE from .env.local)
//   node scripts/dev-test/check-whats-on.js [--width=390] [--keep]
//
// Brings the fixture up and takes it down twice (with and without the next episode's games); zt-nd rows only; refuses a non-local
// database. Shares new-fixture's zt_nd_ couch: never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const shortGames = require("./short-games-fixture");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-whats-on runs against a local database only");
const args = process.argv.slice(2);
const W = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").split("=")[1]);
const KEEP = args.includes("--keep");

let failed = 0;
const check = (ok, what, more) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) {
    failed++;
    if (more) console.log(`      ${more}`);
  }
};
const count = (page, sel) => page.locator(sel).count();
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => "");
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function as(who, go, fn) {
  const b = await open({ user: fixture.username(who), pass: fixture.PASSWORD, width: W, height: 844, motion: "reduce" });
  try {
    await b.page.goto(b.BASE + go, { waitUntil: "networkidle", timeout: 90000 });
    await fn(b.page);
    if (b.errors.length) check(false, `${who} · no page errors`, b.errors.slice(0, 3).join(" | "));
  } catch (e) {
    check(false, `${who} · ${go}`, e.message.split("\n")[0]);
  } finally {
    await b.close();
  }
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await shortGames.up(pool, { open: true });
    const S = fx.seasonId;
    await as("alex", `/show/${S}/games`, async (p) => {
      await p.locator("[data-whats-on]").waitFor({ timeout: 45000 });
      await p.locator('[data-results="19"] [data-result-row]').first().waitFor({ timeout: 30000 });
      check((await count(p, '[data-night="20"] [data-night-row]')) === 3, "alex · Episode 20's three night rows lead the tab");
      check((await count(p, '[data-night="20"] [data-night-move]')) === 3, "alex · each with Answer (nothing answered yet)");
      check((await count(p, '[data-night-row] [data-you][data-in="no"]')) === 3, "alex · his face marked as not in on each");
      check((await count(p, "[data-season-games] [data-game-row]")) === 3, "alex · Running: the three season games as step 6's rows");
      check((await count(p, "[data-game-row]")) === 3, "alex · no finished game has a row on the tab");
      check((await count(p, '[data-results="19"] [data-result-row]')) === 3, "alex · Episode 19's three results");
      const door = await text(p, "[data-archive-open]");
      check(/All finished games\s*57/.test(door), "alex · the door counts 57 finished games", door);
      check(!(await wide(p)), "alex · the tab fits the screen");
      await p.locator("[data-archive-open]").click();
      await p.locator("[data-archive] [data-record]").waitFor({ timeout: 30000 });
      check(/firsts? of 57/.test(await text(p, "[data-record]")), "alex · the archive's record: firsts of 57");
      check((await count(p, "[data-record-person]")) === 3, "alex · a split bar for each of the three others");
      check((await count(p, "[data-archive-kinds] button")) === 4, "alex · All and the three kinds");
      const first = await p.locator("[data-archive-ep]").first().getAttribute("data-archive-ep");
      const eps = await count(p, "[data-archive-ep]");
      check(first === "19", "alex · the archive's newest episode is 19", first);
      await p.locator("[data-archive-more]").click();
      await p.waitForFunction((n) => document.querySelectorAll("[data-archive-ep]").length > n, eps, { timeout: 30000 }).catch(() => {});
      check((await count(p, "[data-archive-ep]")) > eps, "alex · the next page comes under it");
      check(!(await wide(p)), "alex · the archive fits the screen");
      await p.locator("[data-archive] [data-result-row]").first().click();
      await p.locator("[data-game-page]").waitFor({ timeout: 30000 });
      check((await count(p, "[data-game-page]")) === 1, "alex · a finished game's page opens from the archive (read by itself)");
      check(!(await count(p, "[data-strip-ep]")), "alex · a one-episode game's page has no week by week");
    });
    await as("alex", `/show/${S}`, async (p) => {
      await p.locator("[data-your-games]").waitFor({ timeout: 45000 });
      await p.locator("[data-tonight-nights] [data-result-row]").first().waitFor({ timeout: 30000 });
      check((await count(p, "[data-game-mini]")) === 3, "alex · Tonight: a mini per season game, none per short game");
      check((await count(p, "[data-tonight-nights] [data-result-row]")) === 3, "alex · Tonight: Episode 19's results");
      check((await count(p, "[data-tonight-night]")) === 3, "alex · Tonight: Episode 20's games, a line each");
    });
    await as("sam", `/show/${S}/games`, async (p) => {
      await p.locator("[data-whats-on]").waitFor({ timeout: 45000 });
      await p.locator("[data-results] [data-result-row]").first().waitFor({ timeout: 30000 });
      check((await count(p, '[data-night="18"][data-night-folded="yes"]')) === 1 && (await count(p, '[data-night="19"][data-night-folded="yes"]')) === 1, "sam · Episodes 18 and 19 fold to a line each");
      check((await p.locator("[data-results]").getAttribute("data-results")) === "17", "sam · his results are Episode 17's");
      const words = await p.locator("[data-whats-on]").innerText();
      check(!/won/.test(words.split(/Episode 17's results/i)[0] ?? ""), "sam · no result above his own episode's", words.slice(0, 200));
      await p.locator("[data-archive-open]").click();
      await p.locator("[data-archive-ep]").first().waitFor({ timeout: 30000 });
      check((await p.locator("[data-archive-ep]").first().getAttribute("data-archive-ep")) === "17", "sam · his archive starts at Episode 17");
    });
    await shortGames.down(pool);

    const fx2 = await shortGames.up(pool, { open: true, next: false });
    const S2 = fx2.seasonId;
    const newest = fx2.games.filter((g) => g.episode === 19)[0];
    await as("alex", `/show/${S2}/games`, async (p) => {
      await p.locator("[data-again-line]").waitFor({ timeout: 45000 });
      check((await count(p, "[data-again-line] [data-again]")) === 3, "alex, no Episode 20 games yet · Again for each of Episode 19's three");
      check(/Again for Episode 20/.test(await text(p, "[data-again-line]")), "alex · Again names Episode 20");
    });
    await as("alex", `/show/${S2}/game/${newest.leagueId}`, async (p) => {
      await p.locator("[data-game-page]").waitFor({ timeout: 45000 });
      check((await count(p, `[data-again="${newest.leagueId}"]`)) === 1, "alex · Again on the newest finished game's page");
    });
  } finally {
    if (!KEEP) await shortGames.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
