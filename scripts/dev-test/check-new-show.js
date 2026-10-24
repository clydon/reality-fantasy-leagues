// Dev-only check for step 0d's show space (docs/PLAN-new-design.md), in a real browser against the dev server, as
// new-fixture.js's alex (who plays all three games on the zt Survivor 51 and runs them):
//   - Tonight: the phase heading from the schedule, one card per required move due in this couch's games (as
//     /api/me/home lists them; "You're set" when none), one yellow button, no dock before airtime; a card opens
//     "Your moves", whose segments switch (data-try) while Save only says Coming soon;
//   - Episodes: the dock (Set when moves are due, else Edit), an episode row opens its page (?page=epN) and back
//     closes it; the dock holds still while the tabs move (its own view-transition group);
//   - Games: the tables, a row opens that person's sheet, Rules opens a game's rules, the How it works row opens the
//     page, whose jump bar scrolls to What scores;
//   - Cast: Faces, Rank and By episode switch, a face opens their story, ?rank=<stat> opens Rank;
//   - Chat: the messages and the composer, no dock;
//   - a show alex doesn't play (the fixture's Traitors): Play it in place of the tables, no dock;
//   - every show.* entry of the Preview registry (src/new/preview.ts) renders somewhere, a Preview tap says Coming
//     soon, nothing is wider than the screen, and no page errors.
// Screenshots of each tab (a screen at a time down the page), each sheet and page go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-show.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-show runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-show.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
// Pages pushed over the show have their own placeholders, checked by check-new-shell.js.
const ELSEWHERE = ["show.draft", "show.blind"];
const REQUIRED = ["lineup", "pickup", "pick", "draftTurn", "blindDraft"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);

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
      // Next's dev badge sits over the first tab.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });

    const seen = new Set();
    const collect = async () => (await page.$$eval("[data-preview]", (els) => els.map((e) => e.dataset.preview))).forEach((id) => seen.add(id));
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    async function shoot(name, scroller = null) {
      const height = await page.evaluate((s) => (s ? document.querySelector(s).scrollHeight : document.documentElement.scrollHeight), scroller);
      for (let k = 0, y = 0; y < height - 120 && k < 8; k++, y += 760) {
        await page.evaluate(([s, top]) => (s ? (document.querySelector(s).scrollTop = top) : window.scrollTo(0, top)), [scroller, y]);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(out, `${name}-${k}.png`) });
      }
      await page.evaluate((s) => (s ? (document.querySelector(s).scrollTop = 0) : window.scrollTo(0, 0)), scroller);
    }
    const tabTo = async (tab) => {
      await page.locator("nav[aria-label=Show] a", { hasText: new RegExp(`^${tab}`, "i") }).click();
      await page.waitForURL(`**/show/${sid}/${tab.toLowerCase()}`);
      await page.locator(`[data-tab=${tab.toLowerCase()}]`).waitFor();
      await page.waitForTimeout(700);
    };
    const closeSheet = async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    };

    // What the server says: the moves due in this couch's games here, and the next episode.
    const home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const couch = home.couches.find((c) => c.games.some((g) => g.seasonId === sid));
    const space = await (await page.request.get(`${BASE}/api/seasons/${sid}/space?couch=${couch.id}`)).json();
    const mine = new Set(space.games.filter((g) => g.yourRole).map((g) => g.leagueId));
    const moves = home.moves.filter((m) => mine.has(m.leagueId));
    const required = moves.filter((m) => REQUIRED.includes(m.kind));
    const up = space.schedule?.upNext;

    // ---- Tonight ----
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    check(!!up && (await page.getByText(`Episode ${up.number}`, { exact: true }).first().isVisible()), `the heading is the next episode (${up && up.number})`);
    const cards = await page.locator("[data-move]").count();
    if (required.length) {
      check(cards === required.length, `one card per required move due here (${required.length}: ${required.map((m) => m.kind).join(", ")})`, `${cards} cards`);
      const yellow = await page.locator("[data-tab=tonight] .bg-chyron").count();
      check(yellow === 1, "one yellow button: the first card's", `${yellow}`);
    } else {
      check(await page.getByText(/You're set for Episode/).isVisible(), "no moves due: You're set");
    }
    check((await page.locator(".nd-dock").count()) === 0, "no dock on Tonight before airtime");
    await collect();
    await fits("Tonight");
    await shoot("tonight");

    // A card opens Your moves; its segments switch, Save only says Coming soon.
    const opener = required.length ? page.locator("[data-move]").first().getByRole("button") : page.getByRole("button", { name: "Change" });
    if ((await opener.count()) && !(await page.locator("[data-move] a").first().count())) {
      await opener.first().click();
      await page.getByRole("dialog").getByText("Your moves").waitFor();
      await page.waitForTimeout(500);
      check(await page.locator('[data-preview="show.moves"]').isVisible(), "a move card opens Your moves (on its fixture)");
      await page.screenshot({ path: path.join(out, "moves-sheet.png") });
      await page.getByRole("tab", { name: "Survival Pool" }).click();
      check((await page.getByRole("tab", { name: "Survival Pool" }).getAttribute("aria-selected")) === "true", "its segments switch (data-try)");
      await page.screenshot({ path: path.join(out, "moves-pool.png") });
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
      check(await page.getByText("Coming soon: Your moves").isVisible(), "Save only says Coming soon");
      await collect();
      await closeSheet();
    }

    // A Preview tap says Coming soon.
    await page.locator('[data-preview="show.watch-along"] button').click();
    check(await page.getByText("Coming soon: Watch along").first().isVisible(), "a Preview tap says Coming soon");

    // ---- Episodes ----
    await page.evaluate(() => (window.__vt.length = 0));
    await tabTo("Episodes");
    const dock = page.locator(".nd-dock");
    check(await dock.isVisible(), "the dock sits over Episodes");
    check(((await dock.textContent()) || "").includes(moves.length ? "Set" : "Edit"), `the dock says ${moves.length ? "Set" : "Edit"} (${moves.length} moves due)`, await dock.textContent());
    check(await page.getByText("you're on Ep 5").isVisible(), "the guard chip says where you are");
    await collect();
    await fits("Episodes");
    await shoot("episodes");
    await page.locator("[data-ep='4']").click();
    await page.waitForURL(/\?page=ep4/);
    await page.waitForTimeout(600);
    check(await page.locator('[data-preview="show.episode"]').isVisible(), "an episode row opens its page");
    await collect();
    await shoot("episode-4", "[role=dialog][aria-hidden=false]");
    await page.goBack();
    await page.waitForTimeout(600);
    check(!page.url().includes("page=") && !(await page.locator('[data-preview="show.episode"]').isVisible()), "back closes it");
    // The guard chip's Change: where you are (a later step).
    await page.getByRole("button", { name: /Spoiler-safe/ }).click();
    await page.waitForTimeout(400);
    await collect();
    await closeSheet();

    // ---- Games ----
    await tabTo("Games");
    const vt = await page.evaluate(() => window.__vt.at(-1) || null);
    check(!!vt && vt.anims.some((a) => a.includes("nd-dock")), "the dock holds still while the tabs move", JSON.stringify(vt));
    await collect();
    await fits("Games");
    await shoot("games");
    await page.locator("[data-player=riley]").first().click();
    await page.getByRole("dialog").getByText(/of 4/).first().waitFor();
    await page.waitForTimeout(400);
    check(await page.getByRole("dialog").locator('[data-preview="show.standings"]').isVisible(), "a standings row opens that person's sheet");
    await page.screenshot({ path: path.join(out, "player-sheet.png") });
    await closeSheet();
    await page.getByRole("button", { name: "Rules" }).first().click();
    await page.getByRole("dialog").locator("ol").waitFor();
    check(true, "Rules opens the game's rules");
    await page.screenshot({ path: path.join(out, "rules-sheet.png") });
    await closeSheet();
    await page.getByRole("button", { name: /^How .* works/ }).click();
    await page.waitForURL(/\?page=how-it-works/);
    await page.waitForTimeout(600);
    check(await page.locator('[data-preview="show.how-it-works"]').isVisible(), "the Games tab's row opens How it works");
    check(await page.locator("[role=dialog][aria-hidden=false]").getByText("Each episode", { exact: true }).first().isVisible(), "How it works draws the rulebook's rundown");
    await collect();
    await shoot("how-it-works", "[role=dialog][aria-hidden=false]");
    await page.locator("[role=dialog][aria-hidden=false] nav[aria-label='Jump to'] button").last().click();
    await page.waitForTimeout(900);
    const jumped = await page.evaluate(() => document.querySelector("[role=dialog][aria-hidden=false]").scrollTop);
    check(jumped > 400, "its jump bar scrolls the page", `${jumped}`);
    await page.goBack();
    await page.waitForTimeout(600);

    // ---- Cast ----
    await tabTo("Cast");
    check((await page.locator("[data-cast]").count()) > 10, "Faces shows the cast");
    await collect();
    await fits("Cast");
    await shoot("cast-faces");
    await page.locator("[data-cast]").first().click();
    await page.getByRole("dialog").getByText(/up to Episode/).waitFor();
    await page.waitForTimeout(400);
    check(true, "a face opens their story");
    await page.screenshot({ path: path.join(out, "cast-story.png") });
    await closeSheet();
    await page.locator("[data-view=rank]").click();
    await page.waitForTimeout(500);
    check(await page.getByText("Ranked by").isVisible(), "Rank switches in (data-try)");
    await shoot("cast-rank");
    const firstRanked = () => page.locator("[data-cast]").first().getAttribute("data-cast");
    const top = await firstRanked();
    await page.evaluate(() => (window.__vt.length = 0));
    await page.locator('select[aria-label="Ranked by"]').selectOption("clean");
    await page.waitForTimeout(700);
    const sorted = await page.evaluate(() => window.__vt.at(-1) || null);
    check((await firstRanked()) !== top, "ranking by another stat re-sorts the cast", `${top} stayed first`);
    check(!!sorted && sorted.anims.some((a) => a.includes("nd-flip")), "each face moves to its new place (Flip)", JSON.stringify(sorted && sorted.anims.slice(0, 4)));
    await page.locator("[data-view=heat]").click();
    await page.waitForTimeout(500);
    check(await page.locator("table").isVisible(), "By episode switches in");
    await fits("Cast, By episode");
    await page.screenshot({ path: path.join(out, "cast-heat.png") });
    await page.goto(`${BASE}/show/${sid}/cast?rank=majority`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=cast]").waitFor();
    check((await page.locator("[data-view=rank]").getAttribute("aria-selected")) === "true", "?rank= opens Rank (Tonight's Stats card)");

    // ---- Chat ----
    await tabTo("Chat");
    check(await page.getByPlaceholder(/Message the/).isVisible(), "Chat has its composer");
    check((await page.locator(".nd-dock").count()) === 0, "no dock on Chat");
    await collect();
    await fits("Chat");
    await shoot("chat");

    // ---- a show alex doesn't play: Play it, and no dock ----
    await page.goto(`${BASE}/show/${fx.traitorsSeasonId}/games`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=games]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    check(await page.locator('[data-preview="show.make-it-a-game"]').isVisible(), "a show you don't play: Play it, in place of the tables");
    check((await page.locator(".nd-dock").count()) === 0 && (await page.locator('[data-preview="show.standings"]').count()) === 0, "no tables and no dock there");
    await collect();
    await fits("Games, a show you don't play");
    await page.screenshot({ path: path.join(out, "games-not-playing.png") });
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor();

    // ---- the ⋯ menu's rows, then every show entry ----
    await page.getByRole("button", { name: "Show menu" }).click();
    await page.getByRole("dialog").getByText("How it works").waitFor();
    await page.waitForTimeout(400);
    await collect();
    await closeSheet();
    const missing = Object.keys(PREVIEWS).filter((id) => id.startsWith("show.") && !ELSEWHERE.includes(id) && !seen.has(id));
    check(missing.length === 0, "every show.* Preview entry renders", missing.join(", "));

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    await close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
