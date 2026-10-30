// Dev-only check for the show's ⋯ menu (the casual-player redesign): the menu holds only what has no other home, in a real
// browser against the dev server, on new-fixture.js's zt Survivor 51:
//   - sam (plays three games, runs none): the menu leads with the spoiler card (a player's Tonight has no chip), then
//     Notifications, Invite a friend, How it works and Everything else. Nothing the tabs already carry is repeated: no Start a
//     game, Make it a game, Add to my shows or Where you are row; no Backstage, no Admin; and what's rarely wanted (Plan a watch
//     along, Recent changes, Watch privately, Leave) isn't on the first sheet;
//   - Notifications says what this phone really does (never a flat "On"), with the needs-you dot only when no phone of his gets
//     them, and its sheet leads with Turn on in that case (never tapped here: the permission prompt isn't ours to answer);
//   - Everything else: Plan a watch along, Recent changes, Watch privately and Leave these games, a back arrow to the menu, and
//     Leave opens its hold (a preview: nothing is left);
//   - alex (runs them): Backstage is a plate naming the job while something needs him (the fixture leaves Episode 6 open), with
//     the dot on ⋯, and it opens Backstage; a show he doesn't play (the fixture's Traitors) has no spoiler card and none of what
//     its Tonight carries;
//   - an admin (jordan, given the admin role): This season in Admin, to the desk's season page; not on sam's or alex's menu;
//   - nothing wider than the screen at --width; no page errors.
// Screenshots of each state go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-show-menu.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-show-menu runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-show-menu.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// What the first sheet must not repeat from the tabs, and what only Everything else holds.
const FROM_THE_TABS = [/^Start a game/, /^Make it a game/, /^Add to my shows/, /^Where you are/];
const THE_REST = [/^Plan a watch along/, /^Recent changes/, /^Watch privately/, /^Leave these games/];
const PHONE_LINES = /^(On for this phone|On for your other phone|Off on this phone|Add it to your Home Screen first|Blocked on this phone|Not available in this browser)/;

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    // jordan is the site admin for this check (his role is read at sign-in; the fixture's down removes him with the rest).
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [fx.users.jordan]);

    let n = 0;
    /** One signed-in browser per person; `go` opens a show's Tonight and the ⋯ menu on it. */
    const as = async (who) => {
      const b = await open({ user: fixture.username(who), pass: fixture.PASSWORD, width, height: 844 });
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
      const shot = async (name) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where) => {
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${who}, ${where}: nothing wider than the screen`, `${wide}px`);
      };
      const menu = async (season) => {
        await page.goto(`${BASE}/show/${season}/tonight`);
        const button = page.locator("button[aria-label^='Show menu']").first();
        await button.waitFor({ timeout: 30_000 });
        await page.waitForTimeout(800);
        await button.click();
        await page.locator("[data-menu-main]").waitFor({ timeout: 15_000 });
      };
      /** The first sheet's rows, as the names a tap would read (a button or a link). */
      const rows = () => page.locator("[data-menu-main]").locator("button, a").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean));
      return { page, BASE, errors, shot, fits, menu, rows, who };
    };
    const has = (list, re) => list.some((r) => re.test(r));

    // ---- sam: a player ----
    const sam = await as("sam");
    await sam.menu(sid);
    const samRows = await sam.rows();
    check(await sam.page.locator("[data-menu-main] [data-guard-card]").isVisible(), "sam: the menu leads with the spoiler card");
    check(/Spoiler-safe/.test(await sam.page.locator("[data-guard-card]").innerText()) && /You're on Ep 3/.test(await sam.page.locator("[data-guard-card]").innerText()), "the card says where he is (Episode 3)", await sam.page.locator("[data-guard-card]").innerText());
    check(["Notifications", "Invite a friend", "How it works", "Everything else"].every((t) => has(samRows, new RegExp(`^${t}`))), "then Notifications, Invite a friend, How it works and Everything else", samRows.join(" | "));
    check(FROM_THE_TABS.every((re) => !has(samRows, re)), "nothing the tabs already carry: no Start a game, Make it a game, Add to my shows or Where you are row", samRows.join(" | "));
    check(!has(samRows, /^Backstage/) && !has(samRows, /This season in Admin/) && (await sam.page.locator("[data-backstage-plate]").count()) === 0, "a player: no Backstage, no Admin");
    check(THE_REST.every((re) => !has(samRows, re)), "what's rarely wanted isn't on the first sheet", samRows.join(" | "));
    const elseLine = samRows.find((r) => /^Everything else/.test(r)) ?? "";
    check(/Watch along/.test(elseLine) && /history/.test(elseLine) && /privacy/.test(elseLine) && /leave/.test(elseLine), "Everything else says what's in it", elseLine);
    // Notifications: this phone's own state, once the profile has said whether any phone of his gets them.
    await sam.page
      .waitForFunction(() => /turn on|other phone|^On for this phone|Blocked|Not available|Home Screen/.test(document.querySelector("[data-menu-main]")?.textContent?.match(/Notifications(.*?)Invite/)?.[1] ?? ""), null, { timeout: 15_000 })
      .catch(() => {});
    const noteRow = (await sam.rows()).find((r) => /^Notifications/.test(r)) ?? "";
    const phoneLine = noteRow.replace(/^Notifications\s*/, "");
    check(PHONE_LINES.test(phoneLine), "Notifications says what this phone does", noteRow);
    const off = /^Off on this phone · turn on/.test(phoneLine);
    const dot = await sam.page.locator("[data-menu-main] [aria-label='Needs you']").count();
    check(off ? dot === 1 : dot === 0, off ? "no phone of his gets them: the needs-you dot is on" : "a phone gets them: no dot", `${phoneLine} · dots ${dot}`);
    await sam.fits("the menu");
    await sam.shot("player");
    await sam.page.locator("[data-menu-main]").getByRole("button", { name: /^Notifications/ }).click();
    await sam.page.locator("[data-show-notify] [data-setting]").first().waitFor({ timeout: 15_000 });
    await sam.page.waitForTimeout(500);
    const phoneBlock = await sam.page.locator("[data-show-notify-phone]").count();
    check(off ? phoneBlock === 1 && (await sam.page.locator("[data-show-notify-on]").isVisible()) : phoneBlock === 0, off ? "its sheet leads with Turn on" : "its sheet has no Turn on to offer", `blocks ${phoneBlock}`);
    check((await sam.page.locator("[data-show-notify] [data-setting]").count()) === 6, "and the show's six moments are as they were");
    await sam.shot("notifications");
    await sam.page.keyboard.press("Escape");
    // Everything else.
    await sam.menu(sid);
    await sam.page.locator("[data-menu-main]").getByRole("button", { name: /^Everything else/ }).click();
    await sam.page.locator("[data-menu-else]").waitFor({ timeout: 15_000 });
    await sam.page.waitForTimeout(500);
    const elseText = await sam.page.locator("[data-menu-else]").innerText();
    const elseLines = elseText.split("\n").map((l) => l.trim()).filter(Boolean);
    check(THE_REST.every((re) => elseLines.some((l) => re.test(l))), "Everything else: Plan a watch along, Recent changes, Watch privately and Leave these games", elseLines.join(" | "));
    check((await sam.page.locator("[data-menu-main]").count()) === 0, "the first sheet is gone while it's open");
    await sam.fits("Everything else");
    await sam.shot("everything-else");
    await sam.page.locator("[data-sheet-back]").click();
    await sam.page.locator("[data-menu-main]").waitFor({ timeout: 15_000 });
    await sam.page.locator("[data-menu-else]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
    check((await sam.page.locator("[data-menu-else]").count()) === 0, "the back arrow returns to the menu");
    await sam.page.locator("[data-menu-main]").getByRole("button", { name: /^Everything else/ }).click();
    await sam.page.locator("[data-menu-else]").waitFor({ timeout: 15_000 });
    await sam.page.waitForTimeout(500);
    await sam.page.locator("[data-menu-else]").getByText("Leave these games").click();
    await sam.page.waitForFunction(() => /You leave/.test(document.querySelector("[data-guard='3']")?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
    check(/You leave/.test(await sam.page.locator("[data-guard='3']").innerText().catch(() => "")), "Leave opens its hold (a preview: nothing is left yet)");
    await sam.page.keyboard.press("Escape");
    check((await pool.query("SELECT count(*)::int AS n FROM league_memberships WHERE user_id = $1", [fx.users.sam])).rows[0].n >= 3, "and sam is still in his games");

    // ---- alex: runs the games ----
    // Episode 6 aired two days ago with nothing in (the fixture has it three days off): Backstage has a job for him.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
    const alex = await as("alex");
    await alex.page.goto(`${alex.BASE}/show/${sid}/tonight`);
    await alex.page.locator("[data-menu-dot]").waitFor({ timeout: 60_000 });
    await alex.menu(sid);
    // Backstage's needs arrive after the page does; the dot and the plate come together.
    const plate = alex.page.locator("[data-backstage-plate]");
    await plate.waitFor({ timeout: 60_000 }).catch(() => {});
    check((await alex.page.locator("[data-menu-dot]").count()) === 1, "alex: the ⋯ carries Backstage's dot");
    check(await plate.isVisible(), "Backstage is a plate while something needs him");
    // (innerText is the plate's caps: the condensed caption type sets the case in CSS.)
    check(/backstage/i.test(await plate.innerText()) && /who went home in episode 6\?/i.test(await plate.innerText()), "naming the job (Episode 6's who went home)", (await plate.innerText()).replace(/\n+/g, " | "));
    const alexRows = await alex.rows();
    check(!has(alexRows, /^Backstage\s*You run/), "and no second Backstage row repeats it", alexRows.join(" | "));
    check(has(alexRows, /^Notifications/) && has(alexRows, /^Invite a friend/) && has(alexRows, /^Everything else/), "the player's rows follow it");
    await alex.fits("the menu");
    await alex.shot("commissioner");
    await plate.getByText("Backstage").first().click();
    await alex.page.waitForURL((u) => u.pathname === `/show/${sid}/backstage`, { timeout: 20_000 }).catch(() => {});
    check(new URL(alex.page.url()).pathname === `/show/${sid}/backstage`, "the plate opens Backstage", alex.page.url());
    // A show he doesn't play.
    await alex.menu(fx.traitorsSeasonId);
    const trRows = await alex.rows();
    check((await alex.page.locator("[data-guard-card]").count()) === 0, "a show he doesn't play: no spoiler card (its Tonight has the chip or the Add card)");
    check(FROM_THE_TABS.every((re) => !has(trRows, re)), "and none of what its Tonight and Games tab carry", trRows.join(" | "));
    // Only Plan a watch along is left for him there: one row doesn't earn an Everything else, so it sits in the menu.
    check(has(trRows, /^Plan a watch along/) && !has(trRows, /^Everything else/), "one row left over sits in the menu itself, with no Everything else to open for it", trRows.join(" | "));
    await alex.fits("a show he doesn't play");
    await alex.shot("not-playing");

    // ---- jordan: a site admin ----
    const jordan = await as("jordan");
    await jordan.menu(sid);
    const adminRow = jordan.page.locator("[data-menu-main] a", { hasText: "This season in Admin" });
    check((await adminRow.count()) === 1 && (await adminRow.getAttribute("href")) === `/desk/season/${sid}`, "jordan (admin): This season in Admin, to the desk's season page", await adminRow.getAttribute("href").catch(() => "none"));
    await jordan.fits("the menu");
    await jordan.shot("admin");
    check(!has(await alex.rows().catch(() => []), /This season in Admin/) && !has(samRows, /This season in Admin/), "not on alex's or sam's menu");

    for (const p of [sam, alex, jordan]) check(p.errors.length === 0, `${p.who}: no page errors`, p.errors.join(" | ").slice(0, 400));
  } catch (e) {
    check(false, "the check ran to the end", String(e && e.stack ? e.stack : e).slice(0, 700));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool).catch((e) => console.log("down failed:", e.message));
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
