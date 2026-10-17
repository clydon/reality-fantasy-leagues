// Dev-only test bank: what Up next leaves out, and what you can wave away. Needs npm run dev.
//
//   node scripts/dev-test/check-up-next-scope.js <outDir> [width] [--dark] [--keep]
//
// Three checks, each printing ok / FAIL (exit code 2 on any FAIL):
//   1. The control room only holds the open game's and its linked games' commissioner jobs. up-next-fixture.js
//      with `unlink`: Pool leaves the "Couch Crew" group but the tester still runs it, with a results job due.
//      Classic's Overview must not list Pool's job; Pool's own Overview must.
//   2. "All set" can be dismissed. The fixture with --clear --member (nothing to do anywhere): Classic's Overview
//      shows "All set"; its x hides it, a reload keeps it hidden, and Active Roster's still shows.
//   3. Page text doesn't select (body user-select none), but a text box does.
// Writes <outDir>/scope-<step>-<width>[-dark].png. Takes the fixture down at the end unless --keep. All zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const world = require("./up-next-fixture");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-up-next-scope.js <outDir> [width] [--dark] [--keep]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const suffix = `${width}${dark ? "-dark" : ""}`;
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let failed = false;
  const check = (ok, what) => {
    if (!ok) failed = true;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
  };
  try {
    const session = async () => {
      const s = await open({ user: world.USERNAME, pass: world.PASSWORD, width });
      await s.page.addInitScript((t) => {
        localStorage.setItem("rfl.theme", t);
        localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
      }, dark ? "dark" : "light");
      s.go = async (league, path = "/") => {
        await s.page.goto(`${s.BASE}${path}?league=${league.leagueId}`, { waitUntil: "networkidle" });
        await s.page.waitForTimeout(900);
        const go = s.page.locator("button", { hasText: /Let.s go!/ });
        if (await go.count()) await go.first().click().catch(() => {});
        await s.page.waitForTimeout(600);
      };
      // The control room's jobs, every one: "+N more" opened if it's there.
      s.jobs = async () => {
        const more = s.page.locator("[data-control-room] button[aria-expanded=false]");
        if (await more.count()) await more.first().click();
        await s.page.waitForTimeout(250);
        return s.page.evaluate(() => {
          const room = document.querySelector("[data-control-room]");
          if (!room) return [];
          return [room.querySelector("button"), ...room.querySelectorAll("ul li")].map((el) => el.innerText.replace(/\s*\n+\s*/g, " / "));
        });
      };
      s.allSet = () => s.page.locator("[data-up-next] [role=status]", { hasText: "All set" });
      return s;
    };

    // 1. The control room's scope.
    {
      const { classic, roster, pickem } = await world.up(pool, { unlink: true });
      const s = await session();
      console.log(`\n1. commissioner jobs (Pool unlinked: "${pickem.name}")`);
      await s.go(classic);
      const here = await s.jobs();
      console.log(`  Classic's control room: ${here.length ? here.join(" | ") : "(none)"}`);
      await s.page.screenshot({ path: `${out}/scope-classic-jobs-${suffix}.png` });
      check(!here.some((j) => j.includes(pickem.name)), "Classic doesn't list the unlinked league's job");
      await s.go(roster);
      const linked = await s.jobs();
      console.log(`  Active Roster's control room: ${linked.length ? linked.join(" | ") : "(none)"}`);
      check(!linked.some((j) => j.includes(pickem.name)), "Active Roster doesn't either");
      await s.go(pickem);
      const own = await s.jobs();
      console.log(`  Pool's control room: ${own.length ? own.join(" | ") : "(none)"}`);
      await s.page.screenshot({ path: `${out}/scope-pool-jobs-${suffix}.png` });
      check(own.length > 0, "Pool lists its own job");
      await s.close();
    }

    // 2 and 3. "All set" dismissed; text selection.
    {
      const { classic, roster } = await world.up(pool, { clear: true, member: true });
      const s = await session();
      console.log("\n2. All set");
      await s.go(classic);
      check((await s.allSet().count()) > 0, "Classic shows All set");
      await s.page.locator("[data-up-next]").screenshot({ path: `${out}/scope-allset-${suffix}.png` }).catch(() => {});
      await s.allSet().locator("button[aria-label=Dismiss]").click();
      await s.page.waitForTimeout(300);
      check((await s.allSet().count()) === 0, "the x hides it");
      await s.page.screenshot({ path: `${out}/scope-allset-gone-${suffix}.png` });
      await s.go(classic);
      check((await s.allSet().count()) === 0, "still hidden after a reload");
      await s.go(roster);
      check((await s.allSet().count()) > 0, "Active Roster's own All set still shows");

      console.log("\n3. text selection");
      const sel = await s.page.evaluate(() => {
        const input = document.createElement("input");
        document.querySelector("main").appendChild(input);
        const r = { body: getComputedStyle(document.body).userSelect, input: getComputedStyle(input).userSelect };
        input.remove();
        return r;
      });
      check(sel.body === "none", `page text: user-select ${sel.body}`);
      check(sel.input !== "none", `a text box: user-select ${sel.input}`);
      // A real drag across the page's text selects nothing.
      const box = await s.page.locator("main").boundingBox();
      await s.page.mouse.move(box.x + 20, box.y + 40);
      await s.page.mouse.down();
      await s.page.mouse.move(box.x + box.width - 20, box.y + 300, { steps: 8 });
      await s.page.mouse.up();
      const picked = await s.page.evaluate(() => window.getSelection().toString());
      check(picked.trim() === "", `a drag across the page selects ${picked.trim() ? `"${picked.trim().slice(0, 40)}"` : "nothing"}`);
      if (s.errors.length) console.log("\nerrors:", s.errors.slice(0, 5));
      await s.close();
    }
  } finally {
    if (!flags.includes("--keep")) await world.down(pool);
    await pool.end();
  }
  if (failed) process.exitCode = 2;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
