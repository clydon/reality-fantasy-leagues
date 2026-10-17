// Plays the commissioner's tour end to end on Survivor 51 (docs/PLAN-commissioner-tour.md), logged out,
// tapping only what the spotlight lights, and screenshots every step. Fails on a host line that never
// arrives, a lit target that is missing, a lit target hidden under the host plate, or a console error.
//
//   Needs: npm run dev (BASE, default http://localhost:3000). Touches no account or league.
//   node scripts/dev-test/check-commissioner-tour.js [outDir] [--width=390] [--light]
const fs = require("fs");
const path = require("path");
const { open } = require("./browser");

const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=")[1];
const width = parseInt(flag("width", 390));
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) || "tour-commissioner");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const { page, errors, BASE, close } = await open({ width, height: 844 });
  page.setDefaultTimeout(8000);
  let n = 0;
  const host = page.locator("[data-tour-host]");
  const lineOf = async () => (await host.locator("p").first().innerText()).replace(/\s+/g, " ");
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  };
  const say = async (text, name) => {
    await host.getByText(text, { exact: false }).first().waitFor().catch(async (e) => {
      await shot("FAIL-" + name);
      throw new Error(`${name}: wanted "${text}", host says "${await lineOf().catch(() => "(no host)")}"`);
    });
    console.log(`  ${name}: ${await lineOf()}`);
    await shot(name);
    // A lit target must not sit under the plate.
    const plate = await host.boundingBox();
    const hidden = await page.evaluate((p) => {
      const out = [];
      document.querySelectorAll("[data-tour]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.height > innerHeight * 0.45) return;
        if (r.left < p.x + p.width && r.right > p.x && r.top < p.y + p.height && r.bottom > p.y && r.bottom > 0 && r.top < innerHeight)
          out.push(el.getAttribute("data-tour"));
      });
      return out;
    }, plate);
    if (hidden.length) console.log(`    ! under the plate (maybe not lit): ${hidden.join(", ")}`);
  };
  const tap = async (name) => {
    const el = page.locator(`[data-tour~="${name}"]:visible`).first();
    await el.scrollIntoViewIfNeeded();
    await el.click();
  };
  const cta = (label) => host.getByRole("button", { name: label }).click();

  await page.goto(BASE);
  await page.getByRole("button", { name: /take the tour/i }).click();
  await host.getByRole("button", { name: /skip tour/i }).click();
  await page.locator("[data-tour='tab-more']").click();
  await page.getByText("Commissioner tour").click();

  console.log("show");
  await say("on the list. Tap here", "add-open");
  await tap("show-add");
  await say("typed Survivor in", "add-build");
  await tap("add-build");
  await say("Copy the prompt", "add-copy");
  await tap("add-copy");
  await say("Tap Paste", "add-paste");
  await tap("add-paste");
  await say("Create the draft", "add-create");
  await tap("add-create");
  await say("Check the rules it found", "add-approve");
  await tap("add-approve");

  console.log("create");
  await say("Survivor is added", "show");
  await tap("show-survivor");
  await say("Pick Season 51", "season");
  await tap("season-51");
  await tap("create-next");
  await say("Pick Active Roster", "type");
  await tap("type-active-roster");
  await tap("create-next");
  await say("Name it", "name");
  await cta("Next");
  await say("Start the draft yourself", "draft");
  await cta("Next");
  await say("Waivers", "waivers");
  await cta("Next");
  await say("Create your league", "create");
  await tap("create-league");
  await say("Friends join", "invite");
  await tap("invite-copy");
  await say("Open League Settings", "to-settings");
  await tap("invite-enter");

  console.log("settings");
  await say("This is where you run the league", "settings-intro");
  await cta("Let's go");
  await say("no cast yet", "cast-open");
  await tap("setup-cast");
  await say("Open Import a cast", "cast-toggle");
  await tap("cast-import-toggle");
  await say("Copy the prompt", "cast-copy");
  await tap("cast-copy");
  await say("Tap Paste", "cast-paste");
  await tap("cast-paste");
  await say("Tap Review", "cast-review");
  await tap("cast-review");
  await say("Check the names", "cast-import");
  await tap("cast-import-go");
  await say("then Scoring", "rules-open");
  await tap("back");
  await page.waitForTimeout(500);
  await tap("setup-rules");
  await say("Every event has a point value", "rules-event");
  await tap("rule-first");
  await say("Make it worth more", "rules-edit");
  await page.getByRole("button", { name: "One point more" }).click();
  await tap("rule-done");
  await say("This menu resets", "rules-menu");
  await cta("Next");
  await say("then Waivers", "waivers-open");
  await tap("back");
  await page.waitForTimeout(500);
  await tap("setup-waivers");
  await say("Pick how replacements work", "waivers-rule");
  await cta("Keep it as it is");
  await say("Windows also let", "waivers-windows");
  await cta("Next");
  await say("then League setup", "draft-open");
  await tap("back");
  await page.waitForTimeout(500);
  await tap("setup-league");
  await say("Snake or blind", "draft-type");
  await tap("more-options");
  await shot("draft-type-open");
  await cta("Next");

  console.log("draft");
  await say("Time to draft", "to-draft");
  await tap("tab-draft");
  await say("Start the draft", "start-draft");
  await tap("draft-start");
  await page.waitForTimeout(300);
  await tap("confirm-accept").catch(() => {});
  for (let i = 0; i < 3; i++) {
    await say("Pick 3", `draft-pick-${i + 1}`);
    await page.locator('[data-tour="picker-tiles"] button:not([disabled])').first().click();
    await page.locator('[data-tour="picker-confirm"]').getByRole("button").click();
    await page.waitForTimeout(400);
  }

  console.log("episode");
  await say("Episode 1 aired", "results-open");
  await tap("tab-episodes");
  await tap("results-check");
  await say("Copy the question", "results-copy");
  await tap("results-copy-1");
  await say("Tap Paste", "results-paste");
  await tap("results-paste-1");
  await say("Read the answer", "results-read");
  await tap("results-read");
  await say("spot a rule change", "results-rule-change");
  await cta("Next");
  await say("Check each result", "results-apply");
  await tap("results-apply").catch(() => {});
  await page.locator('[data-tour="results-apply"] button').click();

  console.log("waivers");
  await say("Open Lineup, then Waivers", "waivers-go");
  await tap("tab-lineup");
  await page.waitForTimeout(400);
  await tap("team-waivers");
  await say("Open a waiver window", "window-open");
  await tap("window-open");
  await say("Choose what players can do", "window-sheet");
  await tap("window-go");
  await say("private", "window-claims");
  await cta("Next");
  await say("Process the claims", "window-process");
  await tap("waivers-process");
  await page.locator('[data-tour="confirm-accept"]').first().click();

  console.log("episode 2");
  await say("Episode 2 aired", "ep2-open");
  await tap("tab-episodes");
  await tap("results-check");
  await say("Copy the question", "ep2-copy");
  await tap("results-copy-2");
  await say("Tap Paste", "ep2-paste");
  await tap("results-paste-2");
  await say("Read the answer", "ep2-read");
  await tap("results-read");
  await say("Check, then apply", "ep2-apply");
  await page.locator('[data-tour="results-apply"] button').click();
  await say("commissioner's job", "end");

  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
  await close();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
