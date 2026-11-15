// The strip settling (src/new/show/strip.tsx; the design round's step 3, the user's B3): a move made through the strip turns it
// from due (yellow) to "All set for Ep N" with its one-off settle moment, and the behind question (behind-ask.tsx, the user's pick
// B) asks on a show you're behind on. On the zt_nd couch: riley has one Survival Pool pick due (alex's and jordan's lead with a
// replacement, which opens the waivers screen); sam is two behind with results in.
// Needs: the app on :3000 (npm run dev). Brings the couch up and takes it down (new-fixture.js); zt_nd rows only, never a real
// account. Run: node scripts/dev-test/check-strip-settle.js [--out=.ui-atlas/stories/step3-tonight/settle] [--keep]
// Never beside another check on the zt_nd couch.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open, BASE } = require("./browser");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/step3-tonight/settle"));
const PASS = "zt-pass-12345";
let bad = 0;
const check = (ok, what, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` ${extra}`}`);
  if (!ok) bad++;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  execFileSync("node", [path.join(__dirname, "new-fixture.js"), "up"], { stdio: "inherit" });
  const tonightOf = async (p) => {
    await p.goto(BASE + "/home");
    await p.waitForTimeout(2000);
    const u = await p.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.href).find((h) => /\/show\/[^/]+\/tonight/.test(h)));
    await p.goto(u);
    await p.locator("[data-progress]").first().waitFor({ timeout: 45000 });
    await p.waitForTimeout(1500);
  };
  // Riley: one pick due; make it through the strip and watch it settle.
  const a = await open({ user: "zt_nd_riley", pass: PASS, motion: "on" });
  try {
    await tonightOf(a.page);
    const p = a.page;
    check((await p.locator('[data-strip="due"]').count()) === 1, "riley's strip is due (yellow)");
    for (let i = 0; i < 3 && (await p.locator('[data-strip="due"]').count()); i++) {
      await p.locator("[data-strip] button").first().click();
      // The Your moves sheet (pushed pages are dialogs too, hidden: wait on the sheet's own picks).
      await p.locator("[data-pick]:visible").first().waitFor({ timeout: 10000 });
      await p.waitForTimeout(600);
      const pick = p.locator("[data-pick]:visible:not([disabled])").first();
      if (await pick.count()) await pick.click();
      await p.locator('button:visible:has-text("Save")').last().click();
      await p.waitForTimeout(1200);
      await p.keyboard.press("Escape").catch(() => {});
      await p.waitForTimeout(400);
    }
    const settled = await p.locator("[data-strip-settled]").count();
    await p.screenshot({ path: path.join(OUT, "riley-settling.jpg"), type: "jpeg", quality: 82 });
    check((await p.locator('[data-strip="set"]').count()) === 1, "after the pick, the strip says all set");
    check(settled === 1, "the settle moment ran (data-strip-settled)");
    await p.waitForTimeout(1600);
    check((await p.locator("[data-strip-settled]").count()) === 0, "the moment ends: the quiet strip stays");
    await p.screenshot({ path: path.join(OUT, "riley-all-set.jpg"), type: "jpeg", quality: 82 });
  } finally {
    await a.close();
  }
  // Sam: two behind, results in: the behind question on the control's line, Yes in yellow (the pick waits on the reveal).
  const s = await open({ user: "zt_nd_sam", pass: PASS, motion: "reduce" });
  try {
    await tonightOf(s.page);
    const p = s.page;
    check((await p.locator("[data-ask-line]").count()) === 1, "sam's control asks: Seen Ep 4 and 5?", await p.locator("[data-progress]").innerText());
    const yes = p.locator("[data-ask-yes]");
    check((await yes.getAttribute("class"))?.includes("bg-chyron") === true, "Yes holds the yellow (the pick waits on the reveal)");
    await p.screenshot({ path: path.join(OUT, "sam-asks.jpg"), type: "jpeg", quality: 82 });
    await p.locator("[data-ask-later]").click();
    await p.waitForTimeout(500);
    check((await p.locator("[data-ask-line]").count()) === 0 && /Catching up/.test(await p.locator("[data-progress]").innerText()), "Not yet: catching up, no question");
    await p.reload();
    await p.locator("[data-progress]").first().waitFor({ timeout: 45000 });
    await p.waitForTimeout(1500);
    check((await p.locator("[data-ask-line]").count()) === 0, "Not yet is remembered until a new episode airs");
  } finally {
    await s.close();
  }
  if (!args.includes("--keep")) execFileSync("node", [path.join(__dirname, "new-fixture.js"), "down"], { stdio: "inherit" });
  console.log(bad ? `${bad} FAILED` : "ALL PASS");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
