// Dev-only browser check of Round 4's Game settings (docs/PLAN-start-a-game-redo.md, B4; the design:
// docs/design-round/round4-game-settings-spec.md), each game's page called Manage this game since settings Round 3a
// (docs/design-round/settings-r3-spec.md), at a phone's width:
//   new-fixture.js's couch: alex's Games you run (Backstage's address; /backstage/settings lands there too: a row each for the three
//     games he runs, nothing open), a row opening that game's Manage this game (the title card, this episode's lock, the rules as
//     lines, one opened at a time; Who's playing, Freeze rules and joining, the rulebook and Recent changes lines, its name),
//     renaming it with the toast's Undo, the game's ⋯ row "Manage this game" and the bar's gear opening it over the game (Back
//     named for the game), a link opening a rule (&line=joining), a change saved with Undo on the toast; riley (a Helper): one
//     notice, the lines with nothing to open but Replacing people who leave (the week is hers; how waivers work reads as a
//     value), no rename, Freeze not hers, the lock's action live.
//   The waiver week on Manage this game (settings Round 3a's pick, no Waivers page of its own): Outlast's open week as a job
//     that opens in place (who's picked, Pick for them, Run now), Replacing people who leave's value naming how windows come
//     and opening in place to the week and the feel, and Pick for them on sam's sheet in Who's playing.
//   short-games-fixture.js's busy season: Episode 20's games and the 57 finished folded; Archive all 57 in one tap, every one
//     archived, and the toast's Undo bringing them all back.
//   Nothing wider than the screen; no page errors.
//
//   node scripts/lane.js dev   (or npm run dev; BASE from .env.local)
//   node scripts/dev-test/check-game-settings.js [--width=390] [--keep]
//
// Brings the fixtures up and takes them down; zt-nd rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch:
// never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");
const shortGames = require("./short-games-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-game-settings runs against a local database only");
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
  const state = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
  try {
    const fx = await fixture.up(pool);
    const S = fx.seasonId;
    const L = fx.leagues;
    await as("alex", `/show/${S}/backstage/settings`, async (p) => {
      await p.locator("[data-settings-list]").waitFor({ timeout: 45000 });
      check((await p.locator("[data-games-you-run] [data-settings-list]").count()) === 1, "alex · /backstage/settings lands on Games you run");
      check((await p.locator("[data-settings-list] [data-settings-row]").count()) === 3, "alex · a row for each of the three games he runs");
      check((await p.locator("[data-settings-list] [data-join], [data-settings-list] [data-settings=pace]").count()) === 0, "alex · nothing open on the list");
      check(!(await wide(p)), "alex · the list fits the screen");
      await p.locator(`[data-settings-row="${L.lineup}"]`).click();
      await p.locator(`[data-game-settings="${L.lineup}"]`).waitFor({ timeout: 20000 });
      check((await p.locator("[data-game-settings] [data-gallery-title]").count()) === 1, "alex · the game's page opens on its title card");
      check((await p.locator("[data-game-settings] [data-settings-lock]").count()) === 1, "alex · this episode's lock, first");
      const lines = await p.locator("[data-game-settings] [data-setting-line]").count();
      check(lines >= 5, `alex · the rules as lines (${lines})`);
      await p.locator('[data-setting-line="pace"] button').click();
      await p.locator('[data-setting-line="pace"] [data-settings="pace"]').waitFor({ timeout: 10000 });
      await p.locator('[data-setting-line="lineup"] button').click();
      await p.locator('[data-setting-line="lineup"] [data-settings="lineup"]').waitFor({ timeout: 10000 });
      check((await p.locator('[data-setting-line="pace"] [data-settings="pace"]').count()) === 0, "alex · one line open at a time");
      // Round 3a's new parts of the page.
      const page = p.locator(`[data-game-settings="${L.lineup}"]`);
      check((await p.getByText("Manage this game", { exact: true }).count()) >= 1, "alex · the page is titled Manage this game");
      check((await page.locator(`[data-who-plays="${L.lineup}"] [data-person]`).count()) === 4, "alex · Who's playing: the game's four people");
      check((await page.locator("[data-freeze] [data-setting=freeze]").count()) === 1 && !(await page.locator("[data-freeze] [data-setting=freeze]").isDisabled()), "alex · Freeze rules and joining, his to switch");
      check((await page.locator('[data-setting-line="rulebook"] a, [data-setting-line="changes"] a').count()) === 2, "alex · the rulebook and Recent changes, as links");
      check(/Fixed: the draft has started/.test((await page.locator('[data-setting-line="team"]').innerText().catch(() => "")) || "") || (await page.locator('[data-setting-line="team"]').count()) === 0, "alex · Team size, fixed once the draft has started");
      // Rename (A13): the Commissioner's, with the toast's Undo.
      const was = (await pool.query("SELECT name FROM leagues WHERE id = $1", [L.lineup])).rows[0].name;
      await page.locator('[data-setting-line="rename"] button').first().click();
      await page.locator("[data-rename] input").fill("ZT Tuesday League");
      await page.locator("[data-rename] button[type=submit]").click();
      await p.getByText("Renamed ZT Tuesday League").first().waitFor({ timeout: 15000 });
      const renamed = (await pool.query("SELECT name FROM leagues WHERE id = $1", [L.lineup])).rows[0].name;
      check(renamed === "ZT Tuesday League", "alex · renamed, saved at once", renamed);
      await p.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      await p.getByText(`Back to ${was}`).first().waitFor({ timeout: 15000 }).catch(() => {});
      check((await pool.query("SELECT name FROM leagues WHERE id = $1", [L.lineup])).rows[0].name === was, "alex · the toast's Undo puts the name back");
      check(!(await wide(p)), "alex · the game's page fits the screen");
    });
    await as("alex", `/show/${S}/game/${L.lineup}`, async (p) => {
      await p.locator("[data-game-page]").waitFor({ timeout: 45000 });
      await p.locator("[data-game-title] [data-game-menu-open]").click();
      await p.locator('[data-game-menu] :text-is("Manage this game")').click();
      await p.locator(`[data-game-settings="${L.lineup}"]`).waitFor({ timeout: 20000 });
      check(/Lineup League/.test(await p.locator("[data-pushed-back], button:has-text('Lineup League')").first().innerText().catch(() => "")), "alex · from the game's ⋯ menu (Manage this game), Back named for the game");
    });
    await as("alex", `/show/${S}/game/${L.lineup}`, async (p) => {
      await p.locator("[data-game-page]").waitFor({ timeout: 45000 });
      await p.locator("[data-game-title] [data-game-manage]").click();
      await p.locator(`[data-game-settings="${L.lineup}"]`).waitFor({ timeout: 20000 });
      check(true, "alex · the gear on the game's bar opens Manage this game");
    });
    await as("jordan", `/show/${S}/game/${L.lineup}`, async (p) => {
      await p.locator("[data-game-page]").waitFor({ timeout: 45000 });
      check((await p.locator("[data-game-manage]").count()) === 0, "jordan (a player) · no gear on the game's bar");
    });
    await as("alex", `/show/${S}/backstage/settings?page=game-settings&game=${L.outlast}&line=joining`, async (p) => {
      await p.locator('[data-settings-game="Outlast"] [data-join=locked]').waitFor({ timeout: 45000 });
      check(true, "alex · a link opens Outlast's settings with Who can join open");
      await p.locator('[data-settings-game="Outlast"] [data-join=locked]').click();
      await p.getByText(/Nobody new/).first().waitFor({ timeout: 10000 });
      await p.waitForTimeout(800);
      check((await state(L.outlast)).settings.allowLateJoiners === false, "alex · Nobody new, saved at once");
      await p.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      await p.waitForTimeout(1500);
      check((await state(L.outlast)).settings.allowLateJoiners !== false, "alex · the toast's Undo puts it back");
    });
    await as("riley", `/show/${S}/backstage/settings?page=game-settings&game=${L.lineup}`, async (p) => {
      await p.locator(`[data-game-settings="${L.lineup}"]`).waitFor({ timeout: 45000 });
      check(/You help run this game/.test(await p.locator("[data-game-settings] [data-gallery-about]").innerText()), "riley · the title card says she helps run it (a Helper), once");
      check((await p.locator("[data-game-settings] [data-setting-line]:not([data-setting-line=waivers]) button").count()) === 0, "riley · the rules have nothing to open but the waivers");
      await p.locator("[data-setting-line=waivers] > button").click();
      await p.locator("[data-waiver-rule]").waitFor({ timeout: 20000 });
      check((await p.locator("[data-waiver-rule] [data-bs-feel-read]").count()) === 1 && (await p.locator("[data-waiver-rule] [data-feel]").count()) === 0, "riley · how waivers work reads as a value, the Commissioner's");
      await p.locator("[data-setting-line=waivers] > button").click();
      check((await p.getByText("Only the Commissioner changes this").count()) === 0, "riley · no refusal repeated on the lines");
      check((await p.locator("[data-game-settings] [data-settings-override]").count()) === 1, "riley · the lock's action is hers");
      check((await p.locator('[data-game-settings] [data-setting-line="rename"]').count()) === 0, "riley · no rename (the Commissioner's)");
      // A Helper reads Freeze as a value (no switch to tap), saying whose it is.
      const freeze = p.locator("[data-game-settings] [data-freeze]");
      check((await freeze.locator("[data-setting=freeze]:not([disabled])").count()) === 0 && /Freeze rules and joining/i.test(await freeze.innerText()), "riley · Freeze rules and joining isn't hers to switch", await freeze.innerText().catch(() => ""));
    });
    await as("alex", `/show/${S}/backstage/settings?page=game-settings&game=${L.outlast}`, async (p) => {
      await p.locator(`[data-game-settings="${L.outlast}"] [data-job=waivers]`).waitFor({ timeout: 45000 });
      check(/have picks in/.test(await p.locator("[data-job=waivers]").innerText()), "alex · Outlast's open week is a job on Manage this game, with how many picks are in");
      await p.locator("[data-job=waivers] [data-job-toggle]").click();
      await p.locator("[data-waiver-week]").waitFor({ timeout: 10000 });
      check((await p.locator("[data-waiver-week] [data-claim]").count()) >= 2 && (await p.locator("[data-waiver-week] [data-bs-run]").count()) === 1, "alex · it opens in place: who's picked and Run now");
      check((await p.locator("[data-waiver-week] [data-claim-for-open]").count()) >= 1, "alex · Pick for them beside someone with no picks in");
      check(!(await wide(p)), "alex · the week fits the screen");
      const value = await p.locator("[data-setting-line=waivers] > button").innerText();
      check(/every \d+ episodes|a window every episode|you open windows/.test(value), "alex · Replacing people who leave says how windows come", value.replace(/\n/g, " | "));
      await p.locator("[data-setting-line=waivers] > button").click();
      await p.locator("[data-waiver-rule] [data-bs-feel-sheet]").waitFor({ timeout: 10000 });
      check((await p.locator("[data-waiver-rule] [data-feel]").count()) === 3, "alex · it opens in place to the three feels");
      check(!(await wide(p)), "alex · Replacing people who leave, opened, fits the screen");
      await p.locator('[data-who-plays] [data-person="sam"]').click();
      await p.locator('[data-person-pick-for="sam"]').click({ timeout: 10000 });
      await p.locator("[role=dialog][data-open] [data-claim-for]").waitFor({ timeout: 10000 });
      check(true, "alex · Pick for them on sam's sheet in Who's playing opens his pick");
    });
    await fixture.down(pool);

    const busy = await shortGames.up(pool, { open: true });
    await as("alex", `/show/${busy.seasonId}/backstage/settings`, async (p) => {
      await p.locator("[data-settings-list]").waitFor({ timeout: 45000 });
      check((await p.locator('[data-settings-fold^="ep-"]').count()) === 1 && (await p.locator('[data-settings-fold="done"]').count()) === 1, "busy · Episode 20's games and the finished folded");
      check((await p.locator("[data-settings-list] > section:first-child [data-settings-row]").count()) === 3, "busy · Running: the three season games");
      await p.locator('[data-settings-fold="done"] button').first().click();
      await p.locator("[data-archive-all]").waitFor({ timeout: 20000 });
      check(/Archive all 57/.test(await p.locator("[data-archive-all]").innerText()), "busy · Archive all 57");
      await p.locator("[data-archive-all]").click();
      await p.getByText(/Archived 57 finished games/).first().waitFor({ timeout: 30000 });
      const archived = async () => (await pool.query("SELECT count(*)::int AS n FROM leagues WHERE slug LIKE 'zt-nd-short-%' AND (state->'settings'->>'archivedAt') IS NOT NULL")).rows[0].n;
      check((await archived()) === 57, "busy · every finished game archived, at once");
      await p.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      for (let i = 0; i < 40 && (await archived()) > 0; i++) await p.waitForTimeout(500);
      check((await archived()) === 0, "busy · the toast's Undo brings them all back");
      check(!(await wide(p)), "busy · the list fits the screen");
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
