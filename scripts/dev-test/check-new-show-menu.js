// Dev-only check for the show's ⋯ menu and the gear beside it (settings Round 2: the ⋯ is things to do, the gear is your settings
// for this show), in a real browser against the dev server, on new-fixture.js's zt Survivor 51:
//   - sam (plays three games, runs none): the ⋯ is one sheet of things to do: Invite a friend, Plan a watch along, How it works,
//     his drafts (no dot: they're done; check-new-draft.js has the dot on his turn) and Recent changes, then the foot line saying
//     where the settings went, which opens the show's settings page. Nothing the tabs already carry is repeated (no Start a game,
//     Make it a game or Add to my shows row); no Backstage, no Admin; and no settings rows any more: no Notifications, Where you
//     are, Watch privately, Leave or Remove, and no Everything else sheet;
//   - the gear (left of the ⋯, "Your settings for this show") opens the show's settings page (?page=you): Episodes you've watched
//     says where he is and that it moves as he reveals, and opens where he is, read-only for a player; no When a new episode airs
//     (he plays it); When results show here; Notifications says what this show sends and opens its sheet (the six moments, and
//     Turn on first while no phone of his gets them: never tapped here, the permission prompt isn't ours to answer); Hide this show
//     from my couch, off; and last, Leave all my games here, which opens its hold (a preview: nothing is left), never Remove;
//   - alex (runs them): Backstage is a plate naming the job while something needs him (the fixture leaves Episode 6 open), with
//     the dot on ⋯, and it opens Backstage; a show he doesn't play or follow (the fixture's Traitors): Plan a watch along and the
//     foot line, none of what its Tonight carries, and its settings page offers no Leave or Remove;
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

// What the menu must not repeat from the tabs, and the settings that moved behind the gear (settings Round 2).
const FROM_THE_TABS = [/^Start a game/, /^Make it a game/, /^Add to my shows/];
const SETTINGS_ROWS = [/^Notifications/, /^Where you are/, /^Watch privately/, /^Leave/, /^Remove from my shows/, /^Everything else/];
const DOT = "[aria-label='Needs you']";

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
    /** One signed-in browser per person; `menu` opens a show's Tonight and the ⋯ menu on it, `settings` its settings page. */
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
      const settings = async (season) => {
        await page.goto(`${BASE}/show/${season}/tonight?page=you`);
        await page.locator(`[data-show-settings="${season}"]`).waitFor({ timeout: 30_000 });
      };
      /** The menu's rows, as the names a tap would read (a button or a link); the foot line isn't a row. */
      const rows = () =>
        page
          .locator("[data-menu-main]")
          .locator("button:not([data-menu-gear-line]), a")
          .evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean));
      return { page, BASE, errors, shot, fits, menu, settings, rows, who };
    };
    const has = (list, re) => list.some((r) => re.test(r));

    // ---- sam: a player ----
    const sam = await as("sam");
    await sam.menu(sid);
    const samRows = await sam.rows();
    const order = ["Invite a friend", "Plan a watch along", "How it works", "Recent changes"].map((t) => samRows.findIndex((r) => r.startsWith(t)));
    check(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), "sam: Invite a friend, Plan a watch along, How it works, Recent changes", samRows.join(" | "));
    check(SETTINGS_ROWS.every((re) => !has(samRows, re)), "no settings rows in the ⋯ (Notifications, Where you are, Watch privately, Leave, Remove), no Everything else", samRows.join(" | "));
    check((await sam.page.locator("[data-menu-else]").count()) === 0, "and no Everything else sheet to open");
    check((await sam.page.locator("[data-guard-card]").count()) === 0, "no spoiler card any more");
    check(FROM_THE_TABS.every((re) => !has(samRows, re)), "nothing the tabs already carry: no Start a game, Make it a game or Add to my shows row", samRows.join(" | "));
    check(!has(samRows, /^Backstage/) && !has(samRows, /This season in Admin/) && (await sam.page.locator("[data-backstage-plate]").count()) === 0, "a player: no Backstage, no Admin");
    // His drafts are read as the menu opens, and they're done: the row is there with nothing waiting on it.
    const draftRow = sam.page.locator("[data-menu-main] a").filter({ hasText: /^(Draft room|Blind draft)/ }).first();
    await draftRow.waitFor({ timeout: 15_000 }).catch(() => {});
    check((await draftRow.count()) === 1 && (await draftRow.locator(DOT).count()) === 0, "his drafts are in the menu itself, with no dot (they're done)", await draftRow.innerText().catch(() => "no draft row"));
    // The foot line, last: where the settings went.
    const foot = sam.page.locator("[data-menu-main] [data-menu-gear-line]");
    const footText = (await foot.innerText().catch(() => "")).replace(/\s+/g, " ");
    check(/^Your settings for this show Notifications, how far you.ve watched, leaving/.test(footText), "the last row says where the settings went: Your settings for this show", footText);
    check(await foot.evaluate((el) => !el.nextElementSibling).catch(() => false), "and it comes last");
    await sam.fits("the menu");
    await sam.shot("player-menu");
    await foot.click();
    await sam.page.locator(`[data-show-settings="${sid}"]`).waitFor({ timeout: 15_000 }).catch(() => {});
    check((await sam.page.locator(`[data-show-settings="${sid}"]`).isVisible().catch(() => false)) && new URL(sam.page.url()).searchParams.get("page") === "you", "the foot line opens the show's settings page", sam.page.url());
    await sam.page.locator("[data-menu-main]").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    check((await sam.page.locator("[data-menu-main]").count()) === 0, "and the menu closes");

    // The gear, beside the ⋯.
    await sam.page.goto(`${sam.BASE}/show/${sid}/tonight`);
    const gear = sam.page.locator("[data-show-gear]");
    await gear.waitFor({ timeout: 30_000 });
    const gearBox = await gear.boundingBox();
    const dotsBox = await sam.page.locator("button[aria-label^='Show menu']").first().boundingBox();
    check((await gear.getAttribute("aria-label")) === "Your settings for this show" && !!gearBox && !!dotsBox && gearBox.x < dotsBox.x, "the gear sits left of the ⋯: Your settings for this show", JSON.stringify({ gearBox, dotsBox }));
    await sam.page.waitForTimeout(800);
    await gear.click();
    const pageRoot = sam.page.locator(`[data-show-settings="${sid}"]`);
    await pageRoot.waitFor({ timeout: 15_000 });
    check(new URL(sam.page.url()).searchParams.get("page") === "you", "the gear opens the show's settings page (?page=you)", sam.page.url());
    // A player's mark moves as he reveals each episode on Tonight (the air date comes with the episodes' read).
    await sam.page.waitForFunction(() => /· \w{3}, \w{3}\s\d+ ·/.test(document.querySelector('[data-show-row="watched"] [data-row-value]')?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
    const watched = (await sam.page.locator('[data-show-row="watched"] [data-row-value]').innerText().catch(() => "")).replace(/\u00a0/g, " ");
    check(/^Through Ep 3( · \w{3}, \w{3} \d+)? · moves as you reveal$/.test(watched), "Episodes you've watched: through Ep 3, moving as he reveals", watched);
    check((await sam.page.locator('[data-fold="new-episode"]').count()) === 0, "no When a new episode airs: he plays it");
    check((await sam.page.locator('[data-fold="results-here"]').count()) === 1, "When results show here");
    const priv = sam.page.locator('[data-setting="private"]');
    check((await priv.count()) === 1 && (await priv.getAttribute("aria-checked")) === "false" && /Hide this show from my couch/.test(await priv.innerText()), "Hide this show from my couch, off (he's on a couch)");
    check((await sam.page.locator("[data-show-leave]").count()) === 1 && (await sam.page.locator("[data-show-remove]").count()) === 0, "a player: Leave all my games here, never Remove from my shows");
    check(await sam.page.locator("[data-show-leave]").evaluate((el) => !el.parentElement.nextElementSibling).catch(() => false), "and leaving comes last");
    await sam.fits("the show's settings page");
    await sam.shot("player-settings");
    await sam.page.locator('[data-show-row="watched"]').click();
    // A player's is read-only: it moves as he reveals each episode on Tonight.
    check(await sam.page.locator("[role=dialog][data-open] [data-where-plays]").waitFor({ timeout: 15_000 }).then(() => true, () => false), "Episodes you've watched opens where he is (it moves as he reveals)");
    await sam.page.keyboard.press("Escape");
    await sam.page.locator("[role=dialog][data-open]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    // Notifications: what this show sends, once its read is back; then its sheet.
    await sam.page.waitForFunction(() => (document.querySelector('[data-show-row="notify"] [data-row-value]')?.textContent || "…") !== "…", null, { timeout: 15_000 }).catch(() => {});
    const noteValue = (await sam.page.locator('[data-show-row="notify"] [data-row-value]').innerText()).replace(/\u00a0/g, " ");
    // The phone's fact first while nothing rings (the check's fix): "Off on this phone · this show's are on".
    check(/^(On|(Off|Blocked) on this phone · this show's are on)$/.test(noteValue), "Notifications says what this show sends (nothing muted or off here), the phone first when nothing rings", noteValue);
    await sam.page.locator('[data-show-row="notify"]').click();
    await sam.page.locator("[data-show-notify] [data-setting]").first().waitFor({ timeout: 15_000 });
    await sam.page.waitForTimeout(500);
    const phoneBlock = sam.page.locator("[data-show-notify-phone]");
    const blocks = await phoneBlock.count();
    const phoneAttr = blocks ? await phoneBlock.getAttribute("data-show-notify-phone") : null;
    check(
      !blocks || (/(off|blocked) on this phone/i.test(noteValue) && (phoneAttr !== "off" || (await sam.page.locator("[data-show-notify-on]").isVisible()))),
      blocks ? "no phone of his gets them: the row said so, and its sheet leads with Turn on" : "its sheet has no Turn on to offer",
      `${noteValue} · ${phoneAttr}`
    );
    // A show's kinds since Round 1: reminders, results, your couch's activity and couch chat.
    check((await sam.page.locator("[data-show-notify] [data-setting]").count()) === 4, "and the show's four kinds are as they were", String(await sam.page.locator("[data-show-notify] [data-setting]").count()));
    await sam.shot("notifications");
    await sam.page.keyboard.press("Escape");
    await sam.page.locator("[data-show-notify]").waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    // Leave: the hold, as a preview.
    await sam.settings(sid);
    await sam.page.locator("[data-show-leave]").click();
    await sam.page.waitForFunction(() => /You leave/.test(document.querySelector("[data-guard='3']")?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
    check(/You leave/.test(await sam.page.locator("[data-guard='3']").innerText().catch(() => "")), "Leave all my games here opens its hold (a preview: nothing is left yet)");
    check((await sam.page.locator("[role=dialog][data-open]").getByText("Leave all your games here?").count()) >= 1, "titled Leave all your games here?");
    await sam.shot("leave-hold");
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
    check(has(alexRows, /^Invite a friend/) && (await alex.page.locator("[data-menu-main] [data-menu-gear-line]").count()) === 1, "the things to do follow it, and the foot line");
    check(SETTINGS_ROWS.every((re) => !has(alexRows, re)), "no settings rows for him either", alexRows.join(" | "));
    await alex.fits("the menu");
    await alex.shot("commissioner");
    await plate.getByText("Backstage").first().click();
    await alex.page.waitForURL((u) => u.pathname === `/show/${sid}/backstage`, { timeout: 20_000 }).catch(() => {});
    check(new URL(alex.page.url()).pathname === `/show/${sid}/backstage`, "the plate opens Backstage", alex.page.url());
    // A show he doesn't play or follow.
    await alex.menu(fx.traitorsSeasonId);
    const trRows = await alex.rows();
    check(SETTINGS_ROWS.every((re) => !has(trRows, re)), "a show he doesn't play: no settings rows (no Where you are: its Tonight has the chip or the Add card)", trRows.join(" | "));
    check(FROM_THE_TABS.every((re) => !has(trRows, re)), "and none of what its Tonight and Games tab carry", trRows.join(" | "));
    check(has(trRows, /^Plan a watch along/) && (await alex.page.locator("[data-menu-main] [data-menu-gear-line]").count()) === 1, "Plan a watch along sits in the menu itself, then the foot line", trRows.join(" | "));
    await alex.fits("a show he doesn't play");
    await alex.shot("not-playing");
    await alex.settings(fx.traitorsSeasonId);
    check((await alex.page.locator("[data-show-leave], [data-show-remove]").count()) === 0, "its settings page: nothing to leave or remove (he neither plays nor follows it)");
    await alex.fits("the settings page of a show he doesn't play");
    await alex.shot("not-playing-settings");

    // ---- jordan: a site admin ----
    const jordan = await as("jordan");
    await jordan.menu(sid);
    const adminRow = jordan.page.locator("[data-menu-main] a", { hasText: "This season in Admin" });
    check((await adminRow.count()) === 1 && (await adminRow.getAttribute("href")) === `/desk/season/${sid}`, "jordan (admin): This season in Admin, to the desk's season page", await adminRow.getAttribute("href").catch(() => "none"));
    await jordan.fits("the menu");
    await jordan.shot("admin");
    check(!has(alexRows, /This season in Admin/) && !has(samRows, /This season in Admin/), "not on alex's or sam's menu");

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
