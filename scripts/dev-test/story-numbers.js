// Dev-only test bank: the Cast tab's "The numbers" in a game's lens (GameTable, src/new/show/game-week.tsx), for a screenshot story.
// new-fixture.js's couch, its shared Weekly Lineup ("Lineup League") widened from four seats to eight (four seats nobody signs in to:
// taylor, morgan, quinn, drew), so one castaway is held by all eight, one by six, one by five without you, one by two, and one by
// a single other person; with --clash, a second Kristin (Linnea Capobianco renamed Kristin Capobianco, in that game only) for the
// last-initial rule. It shoots, as alex, at --width:
//   numbers-top     the Cast tab at The numbers, the game's lens, All (the table opens on the latest episode)
//   numbers-crowd   the same, scrolled to the crowded rows
//   numbers-early   the table scrolled back to the first episodes (the pinned names and total over what scrolls)
//   numbers-free / numbers-yours   the Free and Yours filters
//   sheet-table     the game page's "Everyone in this game" sheet (the same table on a sheet's panel)
//   person-season   your sheet's week-by-week table (PersonSeason), which opens on the latest weeks the same way
//   episodes-faces  the Episodes tab's who's-here faces (the same face stack: ui/bars.tsx Faces)
// each with its words (.txt) and an overlap report (OVERLAP lines). The fixture's people are zt_nd_ usernames, which a face draws
// its initial from (every face would read Z), so the page is shown its reads without the prefix, as a couch's own names would be;
// nothing in the database changes for it.
//
//   node scripts/dev-test/story-numbers.js [--out=.ui-atlas/stories/numbers-holders/before] [--width=390 --height=844]
//                                          [--theme=night|studio] [--clash] [--keep]
//   node scripts/dev-test/story-numbers.js down
//
// Needs the dev server (npm run dev). Brings new-fixture.js up (refreshing it) and takes it down at the end unless --keep. Touches
// only new-fixture.js's zt-nd rows and zt_nd_ people; refuses a non-local database. Never run beside another check on new-fixture.js.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/numbers-holders/before"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const THEME = opt("theme", "night");
const CLASH = args.includes("--clash");
const BASE = process.env.BASE || "http://localhost:3000";

// The four seats added, and who holds what: castaway name -> the seats on it (alex's first, where alex has them).
const EXTRA = ["taylor", "morgan", "quinn", "drew"];
const HELD = {
  "Devin Way": ["alex", "riley", "jordan", "sam", ...EXTRA], // all eight
  "Jelly Loblack": ["alex", "riley", "jordan", "taylor", "morgan", "quinn"], // six, yours among them
  "Eric Macksoud": ["riley", "jordan", "sam", "morgan", "drew"], // five, not yours
  "Maggie Nestor": ["alex", "quinn"], // two
  "Lewis Kelly": ["taylor"], // one, someone else's
};

/** Widens the fixture's lineup league: four more seats, the holdings above, and (--clash) a second Kristin. */
async function widen(pool) {
  const { rows } = await pool.query(`SELECT id, state FROM leagues WHERE slug = 'zt-nd-lineup'`);
  if (!rows.length) throw new Error("new-fixture.js's lineup league isn't there");
  const state = rows[0].state;
  state.settings.ownershipMode = "shared";
  for (const key of EXTRA) if (!state.players.some((p) => p.id === `demo_p_${key}`)) state.players.push({ id: `demo_p_${key}`, name: key, color: "#888", active: true });
  for (const [name, who] of Object.entries(HELD)) {
    const c = state.castaways.find((x) => x.name === name);
    if (c) c.ownerIds = who.map((k) => `demo_p_${k}`);
  }
  if (CLASH) {
    const c = state.castaways.find((x) => x.name === "Linnea Capobianco");
    if (c) c.name = "Kristin Capobianco";
  }
  await pool.query(`UPDATE leagues SET state = $2 WHERE id = $1`, [rows[0].id, JSON.stringify(state)]);
}

async function shoot(page, id) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${id}.png`) });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  const over = await overlapsIn(page, H).catch(() => []);
  for (const o of over) console.log(`OVERLAP ${id}: ${JSON.stringify(o)}`);
  console.log(`shot ${id}`);
}

(async () => {
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-numbers runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  if (args[0] === "down") {
    await fixture.down(pool);
    await pool.end();
    return console.log("down");
  }
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [];
  let close = null;
  try {
    const up = await fixture.up(pool);
    await widen(pool);
    // The theme is the account's (user_settings.theme: the server puts its cookie back to it), so alex's account wears it.
    await pool.query(`INSERT INTO user_settings (user_id, theme) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET theme = $2`, [up.users.alex, THEME]);
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width: W, height: H });
    close = b.close;
    const { page } = b;
    page.on("pageerror", (e) => errors.push(e.message));
    // People's names as a couch's own would read (see the header): the prefix off every name the app's reads carry.
    await page.route("**/api/**", async (route) => {
      const res = await route.fetch().catch(() => null);
      if (!res) return route.abort();
      if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
      return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_nd_([a-z]+)"/g, '"$1"') });
    });
    await page.context().addCookies([{ name: "gys_theme", value: THEME, url: BASE }]);
    await page.context().addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      })
    );

    // The Cast tab, the lineup game's lens.
    await page.goto(`${BASE}/show/${up.seasonId}/cast`, { waitUntil: "networkidle" });
    await page.locator("[data-explorer]").waitFor({ timeout: 30_000 });
    await page.locator(`[data-lens-option="${up.leagues.lineup}"]`).click();
    await page.locator("[data-game-table]").waitFor();
    await page.waitForTimeout(800);
    const toTable = async (offset = 0) => {
      await page.evaluate((o) => {
        const el = document.querySelector("[data-lens-head]");
        window.scrollBy(0, el.getBoundingClientRect().top - 112 + o);
      }, offset);
    };
    await toTable();
    await shoot(page, "numbers-top");
    // The crowded rows: Jelly (six) and Devin (eight) sit near the top by points; Eric (five, not yours) further down.
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("[data-table-row]")].find((r) => r.textContent.includes("Eric"));
      if (row) window.scrollBy(0, row.getBoundingClientRect().top - 420);
    });
    await shoot(page, "numbers-crowd");
    await toTable();
    await page.locator("[data-game-table] .overflow-x-auto").last().evaluate((el) => el.scrollTo({ left: 0 }));
    await shoot(page, "numbers-early");
    for (const f of ["free", "mine"]) {
      await page.locator(`[data-table-filter="${f}"]`).click();
      await toTable();
      await shoot(page, `numbers-${f === "mine" ? "yours" : f}`);
    }
    await page.locator(`[data-table-filter="all"]`).click();

    // The Episodes tab's who's-here faces (the same face stack, ui/bars.tsx Faces).
    await page.goto(`${BASE}/show/${up.seasonId}/episodes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector("[data-ep-who]")?.scrollIntoView({ block: "center" }));
    await shoot(page, "episodes-faces");

    // The game page's "Everyone in this game" sheet.
    await page.goto(`${BASE}/show/${up.seasonId}/game/${up.leagues.lineup}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const everyone = page.locator(":is(button,a):has-text('Everyone in this game')").first();
    if (await everyone.count()) {
      await everyone.scrollIntoViewIfNeeded();
      await everyone.click();
      await page.locator("[role=dialog] [data-game-table]").waitFor({ timeout: 10_000 });
      await shoot(page, "sheet-table");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    } else console.log("NOTE no 'Everyone in this game' row on the game page");
    // Your own season in this game (the person sheet's week-by-week table, which opens on the latest weeks the same way).
    const yourSheet = page.locator(":is(button,a):has-text('Your sheet'), :is(button,a):has-text('Week by week')").first();
    if (await yourSheet.count()) {
      await yourSheet.scrollIntoViewIfNeeded();
      await yourSheet.click();
      const matrix = page.locator("[role=dialog] [data-lineup-matrix]");
      if (await matrix.count().then((n) => n > 0, () => false)) {
        await matrix.first().scrollIntoViewIfNeeded();
        await page.evaluate(() => {
          const m = document.querySelector("[role=dialog] [data-lineup-matrix]");
          m?.scrollIntoView({ block: "center" });
        });
        await shoot(page, "person-season");
      } else console.log("NOTE no week-by-week table in your sheet");
    } else console.log("NOTE no 'Your sheet' or 'Week by week' on the game page");
  } finally {
    if (close) await close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  for (const e of errors) console.log(`PAGE ERROR ${e}`);
  console.log(`frames in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
