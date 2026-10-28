// Dev-only check: tier 3's hold to confirm (HoldSheet, src/new/ui/guards.tsx) pressed with a finger. The other checks press
// [data-hold] with the mouse; this one sends real touch events (CDP, as check-sheet-swipe.js does) at a phone width, on
// Backstage › Game settings › Delete a game, where a hold "did nothing" for the user (2026-10-28). Each try gets a fresh
// new-fixture.js and its own browser, so a try that deletes doesn't change the next:
//   1. a tap deletes nothing, and the sheet then says to keep it held down until the bar fills
//   2. letting go early (0.8 s) deletes nothing, and says the same
//   3. a still hold deletes once the bar fills
//   4. a hold whose finger rolls as it presses (20 px in the first 0.3 s, then still) still deletes: a phone hands a
//      touch that moves about 8 px before it's a long press (0.5 s) to scrolling (headless Chromium: 15 px), and that
//      cancels a button's hold unless the button says touch-action: none
//   5. a finger that slides off the button (120 px up; it's the screen's width, 56 px tall) lets go: nothing is deleted,
//      and the sheet says to keep it held down
//   6. a mouse held down deletes, as on a computer
// Prints the pointer events the button got in each try, so a failure says why. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-hold-touch.js <outDir> [--width=390] [--only=tap,roll] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves the last try's); touches zt-nd rows only; refuses a
// non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-hold-touch runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-hold-touch.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const TRIES = [
  { name: "tap", ms: 120, deletes: false, hint: true, what: "a tap deletes nothing" },
  { name: "early", ms: 800, deletes: false, hint: true, what: "letting go at 0.8 s deletes nothing" },
  { name: "still", ms: 2000, deletes: true, what: "a still hold deletes" },
  { name: "roll", ms: 2000, roll: 14, deletes: true, what: "a hold whose finger rolls 20 px as it presses still deletes" },
  { name: "slide-off", ms: 2000, slide: 120, deletes: false, hint: true, what: "sliding 120 px up off the button lets go" },
  { name: "mouse", ms: 2000, mouse: true, deletes: true, what: "a mouse held down deletes" },
];

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const t of TRIES.filter((x) => !only.length || only.includes(x.name))) {
      const fx = await fixture.up(pool);
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);
      const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
      try {
        const { page, errors, BASE } = b;
        // Every pointer event that reaches the hold button, in order (capture phase, so pointerleave shows too).
        await page.addInitScript(() => {
          window.__hold = [];
          for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave", "lostpointercapture", "contextmenu"])
            document.addEventListener(type, (e) => {
              if (!(e.target instanceof Element) || !e.target.closest("[data-hold]")) return;
              const last = window.__hold[window.__hold.length - 1];
              if (type === "pointermove" && last && last.startsWith("pointermove")) window.__hold[window.__hold.length - 1] = `pointermove×${(Number(last.split("×")[1]) || 1) + 1}`;
              else window.__hold.push(type);
            }, true);
        });
        await page.goto(`${BASE}/show/${fx.seasonId}/backstage/settings`, { waitUntil: "load" });
        await page.locator("[data-end-games]").waitFor();
        await page.locator("[data-end-toggle]").click();
        await page.locator('[data-end="delete"]').click();
        await page.locator('[data-end-pick="delete"]').waitFor();
        await page.locator(`[data-end-pick="delete"] [data-end-game="${fx.leagues.lineup}"]`).click();
        await page.locator("[data-hold]:not([disabled])").waitFor();
        await page.waitForTimeout(600); // the sheet's rise
        const box = await page.locator("[data-hold]").boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.evaluate(() => (window.__hold = []));

        const cdp = await page.context().newCDPSession(page);
        const touch = t.mouse
          ? (type, px, py) => (type === "touchStart" ? page.mouse.move(px, py).then(() => page.mouse.down()) : type === "touchEnd" ? page.mouse.up() : page.mouse.move(px, py))
          : (type, px, py) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py }] });
        // The finger goes down, moves a step every 100 ms (rolling `roll` down and `roll` right over the first 0.3 s, 20 px
        // for 14, or sliding `slide` up over the first half), and lifts at `ms`.
        await touch("touchStart", x, y);
        const steps = Math.max(1, Math.round(t.ms / 100));
        for (let i = 1; i <= steps; i++) {
          await page.waitForTimeout(t.ms / steps);
          if (i === Math.round(steps / 2) && t.name !== "tap") await page.screenshot({ path: path.join(out, `hold-touch-${t.name}-mid.png`) });
          if (t.roll) await touch("touchMove", x + (t.roll * Math.min(i, 3)) / 3, y + (t.roll * Math.min(i, 3)) / 3);
          if (t.slide) await touch("touchMove", x, y - t.slide * Math.min(1, (2 * i) / steps));
        }
        await touch("touchEnd", 0, 0);
        await page.waitForTimeout(t.deletes ? 2500 : 1600);

        const gone = !!(await pool.query("SELECT deleted_at FROM leagues WHERE id = $1", [fx.leagues.lineup])).rows[0]?.deleted_at;
        const events = await page.evaluate(() => window.__hold.join(" "));
        check(gone === t.deletes, `${t.what}`, `${gone ? "deleted" : "not deleted"}; events: ${events || "none"}`);
        console.log(`      events: ${events || "none"}`);
        if (t.hint) {
          const hint = (await page.locator("[data-hold-hint]").count()) ? await page.locator("[data-hold-hint]").innerText() : "";
          check(/until the bar fills/.test(hint), `${t.name}: then the sheet says to keep it held down`, hint || "no [data-hold-hint]");
        }
        await page.screenshot({ path: path.join(out, `hold-touch-${t.name}-after.png`) });
        check(!errors.length, `${t.name}: no page errors`, errors.join(" | "));
      } finally {
        await b.close();
      }
    }
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
