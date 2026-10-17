// Dev-only test bank: "Only when short" and a waiver window that replaces everyone (docs/PLAN-waivers-v2.md;
// the user's Weekly Start/Bench, 2026-10-17). In waivers-fixture.js's Waivers Roster (Active Roster,
// Only when short, down to 1), Sam has 2 out and 1 still in, so the rule lets him replace 1 of them, his
// choice. Then Kim, the commissioner, turns on "Replace everyone who's out" for the window, and Sam can
// replace both. Needs npm run dev.
//
//   node scripts/dev-test/check-window-replace.js <outDir> [width] [--dark] [--keep]
//
// Writes <outDir>/1-sam-rule.png, 2-kim-sheet.png, 3-kim-sheet-on.png, 4-sam-window.png, checks the
// words and the Replace buttons at each step, prints page errors, and takes the fixture down at the end
// unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./waivers-fixture");

let failed = 0;
function check(ok, what) {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
}

async function as(user, width, theme) {
  const s = await open({ user, pass: fixture.PASSWORD, width });
  await s.page.addInitScript((t) => {
    localStorage.setItem("rfl.theme", t);
    localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
  }, theme);
  return s;
}
async function dismissNew(page) {
  const go = page.locator("button", { hasText: /Let.s go!/ });
  if (await go.count()) await go.first().click();
  await page.waitForTimeout(300);
}
async function board(page, BASE, leagueId) {
  await page.goto(`${BASE}/waivers?league=${leagueId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await dismissNew(page);
}
const replaceButtons = (page) => page.getByRole("link", { name: "Replace", exact: true }).count();

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-window-replace.js <outDir> [width] [--dark] [--keep]");
  const width = parseInt(w, 10);
  const theme = flags.includes("--dark") ? "dark" : "light";
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const errors = [];
  try {
    const made = await fixture.up(pool, ["--phase=open"]);
    const { leagueId } = made.find((l) => l.slug === "zt-wv-roster");

    // Sam, under the rule: 1 of his 2 losses, either one.
    const sam = await as("zt_wplayer", width, theme);
    await board(sam.page, sam.BASE, leagueId);
    const text1 = await sam.page.locator("main").innerText();
    check(/Replace 1 of 2/i.test(text1), "Sam's plate: Replace 1 of 2");
    check((await replaceButtons(sam.page)) === 2, "Replace on both of Sam's losses (his choice)");
    await sam.page.screenshot({ path: `${out}/1-sam-rule.png` });
    errors.push(...sam.errors);
    await sam.close();

    // Kim opens the window's sheet: the switch is there under Only when short, off, and the preview says
    // only a short team replaces; on, everyone who's out.
    const kim = await as("zt_wcomm", width, theme);
    await board(kim.page, kim.BASE, leagueId);
    await kim.page.getByRole("button", { name: /^(Change|Open a waiver window)$/ }).first().click();
    await kim.page.waitForTimeout(500);
    const sw = kim.page.getByRole("switch", { name: /Replace everyone who's out/ });
    check((await sw.count()) === 1, "the sheet has Replace everyone who's out");
    check((await sw.getAttribute("aria-checked")) === "false", "...off: the rule decides");
    check(/Replace if short/i.test(await kim.page.getByRole("dialog").innerText()), "preview: Replace if short");
    await kim.page.screenshot({ path: `${out}/2-kim-sheet.png` });
    await sw.click();
    await kim.page.waitForTimeout(300);
    check(/Replace who.s out/i.test(await kim.page.getByRole("dialog").innerText()), "on: preview says Replace who's out");
    await kim.page.screenshot({ path: `${out}/3-kim-sheet-on.png` });
    await kim.page.getByRole("dialog").getByRole("button", { name: /^(Save|Open window)$/ }).click();
    await kim.page.waitForTimeout(1200);
    errors.push(...kim.errors);
    await kim.close();

    // Sam again: both.
    const sam2 = await as("zt_wplayer", width, theme);
    await board(sam2.page, sam2.BASE, leagueId);
    const text2 = await sam2.page.locator("main").innerText();
    check(!/Replace 1 of 2/i.test(text2) && /Replace 2\b/i.test(text2), "Sam's plate: Replace 2");
    check((await replaceButtons(sam2.page)) === 2, "Replace on both, and both go through");
    await sam2.page.screenshot({ path: `${out}/4-sam-window.png` });
    errors.push(...sam2.errors);
    await sam2.close();

    if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
    console.log(failed ? `${failed} failed` : "all ok");
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
